import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getActiveCompanyId } from '@/lib/access'
import { issueNfeForSale } from '@/lib/nfe/issueFocusNfe'
import type { NfeAuthorizationResult } from '@/lib/nfe/types'
import { NfeIntegrationError } from '@/lib/nfe/types'
import { getLatestProductCosts } from '@/lib/product-costs'

export type ProcessSaleInput = {
  items: Array<{ productId: string; quantity: number }>
  paymentMethod?: string
  paymentBreakdown?: Array<{ method: string; amount: number }>
  discount?: number
  amountReceived?: number
  notes?: string
  details?: string
  isPending?: boolean
  customerId?: string | null
}

export type ProcessSaleResult = {
  sale: {
    id: string
    code: string
    subtotal: number
    discount: number
    total: number
    amountReceived: number | null
    change: number
    isPending: boolean
    nfeEnabled: boolean
    nfe: NfeAuthorizationResult
  }
}

function computeProductStatus(newQty: number, minStock: number) {
  if (newQty === 0) return 'Esgotado'
  if (newQty <= minStock * 0.5) return 'Crítico'
  if (newQty <= minStock) return 'Baixo'
  return 'Normal'
}

async function applyInventoryChanges(
  tx: Prisma.TransactionClient,
  companyId: string,
  items: Array<{ product: { id: string; minStock: number }; quantity: number }>,
  stockErrorMessage: string,
) {
  const stockResults = await Promise.all(
    items.map((item) =>
      tx.product.updateMany({
        where: {
          id: item.product.id,
          companyId,
          stockQty: { gte: item.quantity },
        },
        data: {
          stockQty: { decrement: item.quantity },
        },
      }),
    ),
  )

  if (stockResults.some((result) => result.count !== 1)) {
    throw new NfeIntegrationError(stockErrorMessage, { code: 'STOCK_CHANGED' })
  }

  const updatedProducts = await tx.product.findMany({
    where: { id: { in: items.map((item) => item.product.id) } },
    select: { id: true, stockQty: true, minStock: true },
  })

  await Promise.all(
    updatedProducts.map((product) =>
      tx.product.update({
        where: { id: product.id },
        data: { status: computeProductStatus(product.stockQty, product.minStock) },
      }),
    ),
  )
}

function normalizePaymentMethod(method: string) {
  return method.trim().toUpperCase()
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function paymentMethodLabel(method: string) {
  const normalized = normalizePaymentMethod(method)
  const labels: Record<string, string> = {
    PIX: 'PIX',
    DINHEIRO: 'Dinheiro',
    CASH: 'Dinheiro',
    CARTAO_CREDITO: 'Cartão de crédito',
    CREDIT_CARD: 'Cartão de crédito',
    CARTAO_DEBITO: 'Cartão de débito',
    DEBIT_CARD: 'Cartão de débito',
  }

  return labels[normalized] ?? method.trim()
}

function formatPaymentBreakdown(breakdown: Array<{ method: string; amount: number }>) {
  return breakdown.map((item) => `${paymentMethodLabel(item.method)} ${formatCurrency(item.amount)}`).join(' + ')
}

export async function processSaleWithNfe(input: ProcessSaleInput): Promise<ProcessSaleResult> {
  const companyId = await getActiveCompanyId()
  const isPending = input.isPending ?? false
  const saleDetails = input.details?.trim() || null

  try {
    const nfeSettings = await prisma.nfeSettings.findUnique({
      where: { companyId },
      select: {
        enabled: true,
        environment: true,
        model: true,
        series: true,
        nextNumber: true,
        defaultCfop: true,
      },
    })

    // If no NF-e settings or disabled, process as manual sale (no fiscal note)
    const nfeEnabled = nfeSettings?.enabled ?? false

    if (!input.items || input.items.length === 0) {
      throw new NfeIntegrationError('Adicione pelo menos um item para finalizar a venda.', { code: 'SALE_EMPTY' })
    }

    const sanitizedItems = input.items
      .map((item) => ({
        productId: item.productId,
        quantity: Math.max(1, Math.floor(item.quantity)),
      }))
      .filter((item) => item.productId)

    if (sanitizedItems.length === 0) {
      throw new NfeIntegrationError('Itens inválidos para venda.', { code: 'SALE_INVALID_ITEMS' })
    }

    const productIds = [...new Set(sanitizedItems.map((item) => item.productId))]
    const products = await prisma.product.findMany({
      where: { companyId, id: { in: productIds } },
      select: { id: true, name: true, sku: true, price: true, stockQty: true, minStock: true },
    })

    if (products.length !== productIds.length) {
      throw new NfeIntegrationError('Um ou mais produtos não foram encontrados para esta empresa.', { code: 'PRODUCT_NOT_FOUND' })
    }

    const productMap = new Map(products.map((product) => [product.id, product]))
    const productCosts = await getLatestProductCosts(companyId, productIds)

    let subtotal = 0
    const resolvedItems = sanitizedItems.map((item) => {
      const product = productMap.get(item.productId)
      if (!product) {
        throw new NfeIntegrationError('Produto inválido na venda.', { code: 'PRODUCT_INVALID' })
      }

      if (product.stockQty < item.quantity) {
        throw new NfeIntegrationError(`Estoque insuficiente para ${product.name}. Disponível: ${product.stockQty}.`, {
          code: 'INSUFFICIENT_STOCK',
          details: { productId: product.id, available: product.stockQty, requested: item.quantity },
        })
      }

      const lineTotal = product.price * item.quantity
      subtotal += lineTotal

      return {
        ...item,
        product,
        unitPrice: product.price,
        unitCost: productCosts.get(product.id) ?? 0,
        total: lineTotal,
      }
    })

    const discount = Number.isFinite(input.discount) ? Math.max(0, Number(input.discount)) : 0
    // Normalize monetary values to 2 decimal places to avoid floating point
    // precision issues when comparing sums (e.g. 25 + 4.99 vs 29.99).
    subtotal = Number(subtotal.toFixed(2))
    const boundedDiscount = Math.min(discount, subtotal)
    const total = Number(Math.max(0, subtotal - boundedDiscount).toFixed(2))
    const saleCode = `VD-${Date.now().toString().slice(-8)}`
    const normalizedPaymentMethod = input.paymentMethod?.trim() || null
    const normalizedBreakdown = (input.paymentBreakdown ?? [])
      .map((item) => ({
        method: item.method?.trim() || '',
        amount: Number.isFinite(item.amount) ? Math.max(0, Number(item.amount)) : 0,
      }))
      .filter((item) => item.method.length > 0 && item.amount > 0)

    const hasPaymentBreakdown = normalizedBreakdown.length > 0
    const normalizedPaymentLabel = hasPaymentBreakdown
      ? formatPaymentBreakdown(normalizedBreakdown)
      : normalizedPaymentMethod
    const totalPaid = hasPaymentBreakdown
      ? Number(normalizedBreakdown.reduce((acc, item) => acc + item.amount, 0).toFixed(2))
      : null
    const normalizedAmountReceived = hasPaymentBreakdown
      ? totalPaid
      : normalizedPaymentMethod === 'DINHEIRO' && Number.isFinite(input.amountReceived)
        ? Math.max(0, Number(input.amountReceived))
        : null

    if (hasPaymentBreakdown) {
      if (totalPaid === null || totalPaid < total) {
        throw new NfeIntegrationError('A soma dos pagamentos é menor que o total da venda.', { code: 'SALE_AMOUNT_INSUFFICIENT' })
      }

      if (totalPaid > total) {
        throw new NfeIntegrationError('A soma dos pagamentos é maior que o total da venda.', { code: 'SALE_AMOUNT_EXCESS' })
      }
    } else {
      if (normalizedPaymentMethod === 'DINHEIRO' && normalizedAmountReceived === null) {
        throw new NfeIntegrationError('Informe o valor recebido para pagamentos em dinheiro.', { code: 'SALE_AMOUNT_REQUIRED' })
      }

      if (normalizedPaymentMethod === 'DINHEIRO' && normalizedAmountReceived !== null && normalizedAmountReceived < total) {
        throw new NfeIntegrationError('O valor recebido é menor que o total da venda.', { code: 'SALE_AMOUNT_INSUFFICIENT' })
      }
    }

    const change = hasPaymentBreakdown
      ? 0
      : normalizedPaymentMethod === 'DINHEIRO' && normalizedAmountReceived !== null
        ? Number((normalizedAmountReceived - total).toFixed(2))
        : 0
    if (isPending) {
      const pendingSale = await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({
          data: {
            code: saleCode,
            subtotal,
            discount: boundedDiscount,
            total,
            paymentMethod: normalizedPaymentLabel,
            notes: input.notes?.trim() || null,
            details: saleDetails,
            isPending: true,
            companyId,
            customerId: input.customerId ?? null,
            nfeStatus: 'PENDENTE',
          } as any,
        })

        await tx.saleItem.createMany({
          data: resolvedItems.map((item) => ({
            saleId: sale.id,
            productId: item.product.id,
            productName: item.product.name,
            sku: item.product.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        })

        return sale
      })

      return {
        sale: {
          id: pendingSale.id,
          code: pendingSale.code,
          subtotal,
          discount: boundedDiscount,
          total,
          amountReceived: normalizedAmountReceived,
          change,
          isPending: true,
          nfeEnabled: false,
          nfe: { status: 'PENDENTE' },
        },
      }
    }

    if (!nfeEnabled) {
      const manualSale = await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({
          data: {
            code: saleCode,
            subtotal,
            discount: boundedDiscount,
            total,
            paymentMethod: normalizedPaymentLabel,
            notes: input.notes?.trim() || null,
            details: saleDetails,
            isPending: false,
            companyId,
            customerId: input.customerId ?? null,
            nfeStatus: 'PENDENTE',
            stockCommittedAt: new Date(),
          } as any,
        })

        // Create all SaleItems in a single batch operation
        await tx.saleItem.createMany({
          data: resolvedItems.map((item) => ({
            saleId: sale.id,
            productId: item.product.id,
            productName: item.product.name,
            sku: item.product.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        })

        await applyInventoryChanges(tx, companyId, resolvedItems, 'Estoque alterado durante a venda. Tente novamente.')

        // Create all movements in a single batch operation
        await tx.movement.createMany({
          data: resolvedItems.map((item) => ({
            type: 'SAIDA' as const,
            quantity: item.quantity,
            reason: `Venda ${sale.code} (sem emissao fiscal automatica)`,
            productId: item.product.id,
            companyId,
          })),
        })

        return sale
      })

      return {
        sale: {
          id: manualSale.id,
          code: manualSale.code,
          subtotal,
          discount: boundedDiscount,
          total,
          amountReceived: normalizedAmountReceived,
          change,
            isPending: false,
          nfeEnabled: false,
          nfe: { status: 'PENDENTE' },
        },
      }
    }

    const draftSale = await prisma.$transaction(async (tx) => {
      // `nfeSettings` may be null in some environments; assert non-null here
      // because this block only runs when NF-e is enabled (`nfeEnabled === true`).
      const settings = nfeSettings!

      const reservedNumber = settings.nextNumber

      const sale = await tx.sale.create({
        data: {
          code: saleCode,
          subtotal,
          discount: boundedDiscount,
          total,
          paymentMethod: normalizedPaymentLabel,
          notes: input.notes?.trim() || null,
          details: saleDetails,
          isPending: false,
          companyId,
          customerId: input.customerId ?? null,
          nfeStatus: 'PROCESSANDO',
          nfeEnvironment: settings.environment,
          nfeModel: settings.model,
          nfeSeries: settings.series,
          nfeNumber: reservedNumber,
          nfeLastAttemptAt: new Date(),
        } as any,
      })

      await tx.nfeSettings.update({
        where: { companyId },
        data: { nextNumber: { increment: 1 } },
      })

      // Create all SaleItems in a single batch operation
      await tx.saleItem.createMany({
        data: resolvedItems.map((item) => ({
          saleId: sale.id,
          productId: item.product.id,
          productName: item.product.name,
          sku: item.product.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      })

      return sale
    })

    let nfe: NfeAuthorizationResult
    try {
      nfe = await issueNfeForSale(draftSale.id)
    } catch (error) {
      const details = error instanceof NfeIntegrationError ? error.details : undefined

      await prisma.sale.update({
        where: { id: draftSale.id },
        data: {
          nfeStatus: 'ERRO',
          nfeErrorCode: error instanceof NfeIntegrationError ? error.code : 'NFE_UNKNOWN',
          nfeErrorMessage: error instanceof Error ? error.message : String(error),
          nfeRawResponse: details as any,
          nfeLastAttemptAt: new Date(),
        } as any,
      })

      throw error
    }

    if (nfe.status !== 'AUTORIZADO') {
      await prisma.sale.update({
        where: { id: draftSale.id },
        data: {
          nfeStatus: nfe.status,
          nfeErrorCode: nfe.sefazCode,
          nfeErrorMessage: nfe.sefazMessage,
          nfeRawResponse: nfe.raw as any,
          nfeLastAttemptAt: new Date(),
        } as any,
      })

      return {
        sale: {
          id: draftSale.id,
          code: draftSale.code,
          subtotal,
          discount: boundedDiscount,
          total,
          amountReceived: normalizedAmountReceived,
          change,
          isPending: false,
          nfeEnabled: true,
          nfe,
        },
      }
    }

    await prisma.$transaction(async (tx) => {
      await applyInventoryChanges(tx, companyId, resolvedItems, 'Estoque alterado durante a emissão. Tente novamente.')

      // Create all movements in a single batch operation
      await tx.movement.createMany({
        data: resolvedItems.map((item) => ({
          type: 'SAIDA' as const,
          quantity: item.quantity,
          reason: `Venda ${draftSale.code} (NF-e autorizada)`,
          productId: item.product.id,
          companyId,
        })),
      })

      await tx.sale.update({
        where: { id: draftSale.id },
        data: {
          nfeStatus: 'AUTORIZADO',
          nfeAccessKey: nfe.accessKey,
          nfeProtocol: nfe.protocol,
          nfeDanfeUrl: nfe.danfeUrl,
          nfeRawResponse: nfe.raw as any,
          nfeIssuedAt: new Date(),
          nfeLastAttemptAt: new Date(),
          stockCommittedAt: new Date(),
        } as any,
      })
    })

    return {
      sale: {
        id: draftSale.id,
        code: draftSale.code,
        subtotal,
        discount: boundedDiscount,
        total,
        amountReceived: normalizedAmountReceived,
        change,
        isPending: false,
        nfeEnabled: true,
        nfe,
      },
    }
  } catch (error) {
    try {
      console.error('[processSaleWithNfe] Error processing sale', { companyId, input, error })
      await prisma.auditLog.create({
        data: {
          action: 'SALE_PROCESS_ERROR',
          entity: 'SALE',
          entityId: null,
          details: JSON.stringify({ message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, input }),
          companyId,
        },
      })
    } catch (e) {
      console.error('[processSaleWithNfe] Failed to write audit log', e)
    }

    throw error
  }
}
