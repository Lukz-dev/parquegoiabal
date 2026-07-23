import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'
import { FocusNfeClient, getFocusNfeClientConfig } from '@/lib/nfe/focusNfeClient'
import type { NfeAuthorizationResult } from '@/lib/nfe/types'
import { NfeIntegrationError } from '@/lib/nfe/types'

function normalizeStatus(status: string | undefined): 'PROCESSANDO' | 'AUTORIZADO' | 'REJEITADO' {
  const normalized = String(status ?? '').toLowerCase().trim()
  if (['autorizado', 'autorizada', 'authorized'].includes(normalized)) return 'AUTORIZADO'
  if (['rejeitado', 'rejeitada', 'rejected'].includes(normalized)) return 'REJEITADO'
  return 'PROCESSANDO'
}

function computeProductStatus(newQty: number, minStock: number) {
  if (newQty === 0) return 'Esgotado'
  if (newQty <= minStock * 0.5) return 'Crítico'
  if (newQty <= minStock) return 'Baixo'
  return 'Normal'
}

export async function syncSaleNfe(saleId: string): Promise<{ saleId: string; nfe: NfeAuthorizationResult }> {
  const companyId = await getActiveCompanyId()

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, companyId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  })

  if (!sale) {
    throw new NfeIntegrationError('Venda não encontrada.', { code: 'SALE_NOT_FOUND' })
  }

  const client = new FocusNfeClient(getFocusNfeClientConfig())
  const snapshot = await client.getNfe(sale.code)
  const status = normalizeStatus(snapshot.status)

  if (status === 'REJEITADO') {
    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        nfeStatus: 'REJEITADO',
        nfeErrorCode: (snapshot.codigo_sefaz as string) ?? null,
        nfeErrorMessage: (snapshot.mensagem_sefaz as string) ?? (snapshot.mensagem as string) ?? null,
        nfeRawResponse: snapshot as any,
        nfeLastAttemptAt: new Date(),
      } as any,
    })

    return {
      saleId: sale.id,
      nfe: {
        status: 'REJEITADO',
        sefazCode: (snapshot.codigo_sefaz as string) ?? null,
        sefazMessage: (snapshot.mensagem_sefaz as string) ?? (snapshot.mensagem as string) ?? null,
        raw: snapshot,
      },
    }
  }

  if (status !== 'AUTORIZADO') {
    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        nfeStatus: 'PROCESSANDO',
        nfeRawResponse: snapshot as any,
        nfeLastAttemptAt: new Date(),
      } as any,
    })

    return {
      saleId: sale.id,
      nfe: {
        status: 'PROCESSANDO',
        raw: snapshot,
      },
    }
  }

  const nfe: NfeAuthorizationResult = {
    status: 'AUTORIZADO',
    accessKey: (snapshot.chave_nfe as string) ?? null,
    protocol: (snapshot.protocolo as string) ?? null,
    danfeUrl: (snapshot.url_danfe as string) ?? (snapshot.caminho_danfe as string) ?? null,
    raw: snapshot,
  }

  if (sale.stockCommittedAt) {
    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        nfeStatus: 'AUTORIZADO',
        nfeAccessKey: nfe.accessKey,
        nfeProtocol: nfe.protocol,
        nfeDanfeUrl: nfe.danfeUrl,
        nfeRawResponse: nfe.raw as any,
        nfeIssuedAt: sale.nfeIssuedAt ?? new Date(),
        nfeLastAttemptAt: new Date(),
      } as any,
    })

    return { saleId: sale.id, nfe }
  }

  await prisma.$transaction(async (tx) => {
    for (const item of sale.items) {
      const updated = await tx.product.updateMany({
        where: {
          id: item.productId,
          companyId,
          stockQty: { gte: item.quantity },
        },
        data: {
          stockQty: { decrement: item.quantity },
        },
      })

      if (updated.count !== 1) {
        throw new NfeIntegrationError('Estoque insuficiente ou alterado para commit após autorização.', {
          code: 'INSUFFICIENT_STOCK_POST_AUTH',
          details: { productId: item.productId },
        })
      }

      const fresh = await tx.product.findUnique({
        where: { id: item.productId },
        select: { stockQty: true, minStock: true },
      })

      await tx.product.update({
        where: { id: item.productId },
        data: {
          status: computeProductStatus(fresh?.stockQty ?? 0, fresh?.minStock ?? 0),
        },
      })

      await tx.movement.create({
        data: {
          type: 'SAIDA',
          quantity: item.quantity,
          reason: `Venda ${sale.code} (NF-e autorizada - sync)`,
          productId: item.productId,
          companyId,
        },
      })
    }

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        nfeStatus: 'AUTORIZADO',
        nfeAccessKey: nfe.accessKey,
        nfeProtocol: nfe.protocol,
        nfeDanfeUrl: nfe.danfeUrl,
        nfeRawResponse: nfe.raw as any,
        nfeIssuedAt: sale.nfeIssuedAt ?? new Date(),
        nfeLastAttemptAt: new Date(),
        stockCommittedAt: new Date(),
      } as any,
    })
  })

  return { saleId: sale.id, nfe }
}
