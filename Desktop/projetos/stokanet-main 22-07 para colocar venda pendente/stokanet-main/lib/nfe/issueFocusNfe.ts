import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'
import { buildFocusNfePayload } from '@/lib/nfe/buildFocusPayload'
import { FocusNfeClient, getFocusNfeClientConfig } from '@/lib/nfe/focusNfeClient'
import type { NfeAuthorizationResult } from '@/lib/nfe/types'
import { NfeIntegrationError } from '@/lib/nfe/types'

function normalizeStatus(status: string | undefined): 'PROCESSANDO' | 'AUTORIZADO' | 'REJEITADO' {
  const normalized = String(status ?? '').toLowerCase().trim()
  if (['autorizado', 'autorizada', 'authorized'].includes(normalized)) return 'AUTORIZADO'
  if (['rejeitado', 'rejeitada', 'rejected'].includes(normalized)) return 'REJEITADO'
  return 'PROCESSANDO'
}

async function waitForFinalStatus(client: FocusNfeClient, reference: string, maxWaitMs: number) {
  const startedAt = Date.now()
  let attempt = 0
  // Poll curto; evita estourar timeouts de função.
  while (Date.now() - startedAt < maxWaitMs) {
    attempt += 1
    const snapshot = await client.getNfe(reference)
    const status = normalizeStatus(snapshot.status)
    if (status !== 'PROCESSANDO') return snapshot

    const delayMs = Math.min(1500 + attempt * 400, 2500)
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  return null
}

export async function issueNfeForSale(saleId: string): Promise<NfeAuthorizationResult> {
  const companyId = await getActiveCompanyId()

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, companyId },
    include: {
      company: true,
      items: {
        include: {
          product: true,
        },
      },
      customer: true,
    },
  })

  if (!sale) {
    throw new NfeIntegrationError('Venda não encontrada para emissão de NF-e.', { code: 'SALE_NOT_FOUND' })
  }

  if (!sale.nfeEnvironment || !sale.nfeModel || !sale.nfeSeries || !sale.nfeNumber) {
    throw new NfeIntegrationError('Configuração fiscal incompleta na venda (ambiente/modelo/série/número).', {
      code: 'NFE_SALE_SETTINGS_MISSING',
    })
  }

  const settings = await prisma.nfeSettings.findUnique({
    where: { companyId },
    select: { defaultCfop: true, naturezaOperacao: true, taxRegime: true, defaultTaxProfile: true },
  })

  const reference = sale.code

  const payload = buildFocusNfePayload({
    reference,
    environment: sale.nfeEnvironment,
    model: sale.nfeModel,
    series: sale.nfeSeries,
    number: sale.nfeNumber,
    defaultCfop: settings?.defaultCfop ?? null,
    naturezaOperacao: settings?.naturezaOperacao ?? 'Venda',
    taxRegime: settings?.taxRegime ?? 'SIMPLES_NACIONAL',
    defaultTaxProfile: (settings?.defaultTaxProfile as any) ?? null,
    company: {
      name: sale.company.legalName || sale.company.name,
      cnpj: sale.company.cnpj,
      ie: sale.company.ie,
      address: sale.company.fiscalAddress as any,
    },
    customer: sale.customer
      ? {
          name: sale.customer.name,
          cpfCnpj: sale.customer.cpfCnpj,
          address: sale.customer.address as any,
        }
      : null,
    items: sale.items.map((item) => ({
      productId: item.productId,
      description: item.productName,
      sku: item.sku,
      ncm: (item.product as any).ncm,
      cfop: (item.product as any).cfop,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
      taxProfile: (item.product as any).taxProfile,
    })),
    paymentMethod: sale.paymentMethod,
    notes: sale.notes,
  })

  const client = new FocusNfeClient(getFocusNfeClientConfig())

  const initial = await client.issueNfe(reference, payload)
  const status = normalizeStatus(initial.status)

  const maxWaitMs = Number(process.env.FOCUS_NFE_POLL_MAX_MS ?? 8000)
  const finalSnapshot = status === 'PROCESSANDO' ? await waitForFinalStatus(client, reference, maxWaitMs) : initial
  const snapshot = finalSnapshot ?? initial

  const finalStatus = normalizeStatus(snapshot.status)

  if (finalStatus === 'REJEITADO') {
    return {
      status: 'REJEITADO',
      sefazCode: (snapshot.codigo_sefaz as string) ?? null,
      sefazMessage: (snapshot.mensagem_sefaz as string) ?? snapshot.mensagem ?? null,
      raw: snapshot,
    }
  }

  if (finalStatus === 'AUTORIZADO') {
    return {
      status: 'AUTORIZADO',
      accessKey: (snapshot.chave_nfe as string) ?? null,
      protocol: (snapshot.protocolo as string) ?? null,
      danfeUrl: (snapshot.url_danfe as string) ?? (snapshot.caminho_danfe as string) ?? null,
      raw: snapshot,
    }
  }

  return {
    status: 'PROCESSANDO',
    raw: snapshot,
  }
}
