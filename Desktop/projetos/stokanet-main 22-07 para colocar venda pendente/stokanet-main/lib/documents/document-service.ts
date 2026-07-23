import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'
import {
  DOCUMENT_KINDS,
  DOCUMENT_PROVIDERS,
  DOCUMENT_STATUS,
  type DocumentKind,
  type DocumentModel,
  type DocumentPrintFormat,
  type DocumentProvider,
  getDefaultPrintFormat,
  getDocumentKind,
  isFiscalDocument,
} from './document-types'

type DocumentItemInput = {
  productId?: string | null
  description: string
  sku?: string | null
  quantity?: number
  unitPrice?: number
  total?: number
  metadata?: Record<string, unknown> | null
}

type EmitDocumentInput = {
  saleId?: string | null
  purchaseOrderId?: string | null
  model: DocumentModel
  provider?: DocumentProvider
  notes?: string | null
}

type DocumentSource = {
  sourceType: 'SALE' | 'PURCHASE_ORDER'
  code: string
  subtotal: number
  discount: number
  total: number
  companyId: string
  customerId?: string | null
  notes?: string | null
  items: DocumentItemInput[]
  company: {
    name: string
    legalName?: string | null
    cnpj?: string | null
    ie?: string | null
    fiscalAddress?: unknown
  }
  customer?: {
    name: string
    cpfCnpj: string
    email?: string | null
    phone?: string | null
    address?: unknown
  } | null
  supplier?: {
    name: string
    email?: string | null
    phone?: string | null
  } | null
  paymentMethod?: string | null
}

type EmitDocumentResult = {
  document: {
    id: string
    code: string
    kind: DocumentKind
    model: DocumentModel
    status: string
    provider: DocumentProvider | null
    printFormat: DocumentPrintFormat
    saleId: string | null
    purchaseOrderId: string | null
    customerId: string | null
  }
  transmission: {
    provider: DocumentProvider
    payload: Record<string, unknown>
  } | null
  print: {
    printFormat: DocumentPrintFormat
    html: string
  }
}

const escapeHtml = (value: string | null | undefined) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const formatDocument = (value: string | null | undefined) => {
  const digits = String(value ?? '').replace(/\D+/g, '')
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  return value ?? 'Não informado'
}

const formatAddress = (address: unknown) => {
  if (!address || typeof address !== 'object') return 'Não informado'

  const data = address as Record<string, unknown>
  const street = String(data.street ?? data.logradouro ?? '').trim()
  const number = String(data.number ?? data.numero ?? '').trim()
  const district = String(data.district ?? data.bairro ?? '').trim()
  const city = String(data.city ?? data.municipio ?? '').trim()
  const state = String(data.state ?? data.uf ?? '').trim()
  const zip = String(data.zip ?? data.cep ?? '').trim()

  const parts = [
    street && number ? `${street}, ${number}` : street || number,
    district,
    city && state ? `${city} - ${state}` : city || state,
    zip,
  ].filter(Boolean)

  return parts.length ? parts.join(' | ') : 'Não informado'
}

function buildReferenceCode(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-8)}`
}

function resolveProvider(kind: DocumentKind, provider?: DocumentProvider) {
  if (kind === DOCUMENT_KINDS.NON_FISCAL) {
    return DOCUMENT_PROVIDERS.INTERNAL
  }

  return provider ?? DOCUMENT_PROVIDERS.FOCUS_NFE
}

function mapSourceItems(items: Array<{ productId?: string | null; description: string; sku?: string | null; quantity?: number; unitPrice?: number; total?: number; metadata?: Record<string, unknown> | null }>): Prisma.DocumentItemCreateWithoutDocumentInput[] {
  return items.map((item) => ({
    productId: item.productId ?? null,
    description: item.description,
    sku: item.sku ?? null,
    quantity: Number.isFinite(item.quantity) ? Number(item.quantity) : 1,
    unitPrice: Number.isFinite(item.unitPrice) ? Number(item.unitPrice) : 0,
    total: Number.isFinite(item.total) ? Number(item.total) : 0,
    ...(item.metadata ? { metadata: item.metadata as Prisma.InputJsonValue } : {}),
  }))
}

function buildFiscalTransmissionPayload(model: DocumentModel, source: DocumentSource, documentRecord: { code: string; series: string | null; number: number | null; provider: DocumentProvider }) {
  return {
    document: {
      code: documentRecord.code,
      model,
      series: documentRecord.series,
      number: documentRecord.number,
      provider: documentRecord.provider,
      kind: DOCUMENT_KINDS.FISCAL,
    },
    company: {
      name: source.company.legalName || source.company.name,
      cnpj: source.company.cnpj ?? null,
      ie: source.company.ie ?? null,
      address: source.company.fiscalAddress ?? null,
    },
    customer: source.customer
      ? {
          name: source.customer.name,
          document: source.customer.cpfCnpj,
          email: source.customer.email ?? null,
          phone: source.customer.phone ?? null,
          address: source.customer.address ?? null,
        }
      : null,
    source: {
      type: source.sourceType,
      code: source.code,
      paymentMethod: source.paymentMethod ?? null,
    },
    totals: {
      subtotal: source.subtotal,
      discount: source.discount,
      total: source.total,
    },
    items: mapSourceItems(source.items),
    notes: source.notes ?? null,
    emittedAt: new Date().toISOString(),
  }
}

export async function emitDocument(input: EmitDocumentInput): Promise<EmitDocumentResult> {
  const companyId = await getActiveCompanyId()
  const kind = getDocumentKind(input.model)
  const provider = resolveProvider(kind, input.provider)
  const printFormat = getDefaultPrintFormat(input.model)

  if (kind === DOCUMENT_KINDS.FISCAL && provider === DOCUMENT_PROVIDERS.INTERNAL) {
    throw new Error('Documentos fiscais exigem um provedor externo.')
  }

  const source = await loadSource(companyId, input)
  const documentCode = buildReferenceCode('DOC')
  const providerIsFiscal = isFiscalDocument(input.model)
  const shouldTransmit = providerIsFiscal

  const transmissionPayload = shouldTransmit
    ? buildFiscalTransmissionPayload(input.model, source, {
        code: documentCode,
        series: null,
        number: null,
        provider,
      })
    : null

  const document = await prisma.document.create({
    data: {
      code: documentCode,
      kind,
      model: input.model,
      status: shouldTransmit ? DOCUMENT_STATUS.PENDING_TRANSMISSION : DOCUMENT_STATUS.PRINT_READY,
      provider,
      printFormat,
      notes: input.notes?.trim() || null,
      subtotal: source.subtotal,
      discount: source.discount,
      total: source.total,
      payload: transmissionPayload as any,
      saleId: input.saleId ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      customerId: source.customerId ?? null,
      companyId,
      items: {
        create: mapSourceItems(source.items),
      },
    },
    include: {
      items: true,
    },
  })

  return {
    document: {
      id: document.id,
      code: document.code,
      kind: document.kind,
      model: document.model,
      status: document.status,
      provider: document.provider,
      printFormat: document.printFormat,
      saleId: document.saleId,
      purchaseOrderId: document.purchaseOrderId,
      customerId: document.customerId,
    },
    transmission: transmissionPayload
      ? {
          provider,
          payload: transmissionPayload,
        }
      : null,
    print: {
      printFormat,
      html: buildDocumentPrintHtml({
        document: {
          code: document.code,
          kind: document.kind,
          model: document.model,
          status: document.status,
          printFormat: document.printFormat,
          notes: document.notes,
          subtotal: document.subtotal,
          discount: document.discount,
          total: document.total,
          issuedAt: document.issuedAt,
        },
        source,
      }),
    },
  }
}

async function loadSource(companyId: string, input: EmitDocumentInput): Promise<DocumentSource> {
  if (input.saleId) {
    const sale = await prisma.sale.findFirst({
      where: { id: input.saleId, companyId },
      include: {
        company: true,
        customer: true,
        items: {
          select: {
            productId: true,
            productName: true,
            sku: true,
            quantity: true,
            unitPrice: true,
            total: true,
          },
        },
      },
    })

    if (!sale) {
      throw new Error('Venda não encontrada para emissão do documento.')
    }

    return {
      sourceType: 'SALE',
      code: sale.code,
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      companyId: sale.companyId,
      customerId: sale.customerId,
      notes: input.notes?.trim() || null,
      company: {
        name: sale.company.name,
        legalName: sale.company.legalName,
        cnpj: sale.company.cnpj,
        ie: sale.company.ie,
        fiscalAddress: sale.company.fiscalAddress,
      },
      customer: sale.customer
        ? {
            name: sale.customer.name,
            cpfCnpj: sale.customer.cpfCnpj,
            email: sale.customer.email,
            phone: sale.customer.phone,
            address: sale.customer.address,
          }
        : null,
      items: sale.items.map((item) => ({
        productId: item.productId,
        description: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      paymentMethod: sale.paymentMethod,
    }
  }

  if (input.purchaseOrderId) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, companyId },
      include: {
        company: true,
        supplier: true,
        items: {
          select: {
            productId: true,
            productName: true,
            quantity: true,
            unitCost: true,
            total: true,
          },
        },
      },
    })

    if (!order) {
      throw new Error('Pedido não encontrado para emissão do documento.')
    }

    return {
      sourceType: 'PURCHASE_ORDER',
      code: order.code,
      subtotal: order.subtotal,
      discount: 0,
      total: order.subtotal,
      companyId: order.companyId,
      notes: input.notes?.trim() || null,
      company: {
        name: order.company.name,
        legalName: order.company.legalName,
        cnpj: order.company.cnpj,
        ie: order.company.ie,
        fiscalAddress: order.company.fiscalAddress,
      },
      customer: null,
      supplier: order.supplier
        ? {
            name: order.supplier.name,
            email: order.supplier.email,
            phone: order.supplier.phone,
          }
        : null,
      items: order.items.map((item) => ({
        productId: item.productId,
        description: item.productName,
        sku: null,
        quantity: item.quantity,
        unitPrice: item.unitCost,
        total: item.total,
      })),
    }
  }

  throw new Error('Informe saleId ou purchaseOrderId para emitir o documento.')
}

function buildDocumentPrintHtml(params: {
  document: {
    code: string
    kind: DocumentKind
    model: DocumentModel
    status: string
    printFormat: DocumentPrintFormat
    notes: string | null
    subtotal: number
    discount: number
    total: number
    issuedAt?: Date | null
  }
  source: DocumentSource
}) {
  const isThermal = params.document.printFormat === 'THERMAL_80MM'
  const title = params.document.kind === DOCUMENT_KINDS.NON_FISCAL ? 'Comprovante interno' : 'Documento fiscal'
  const header = params.document.kind === DOCUMENT_KINDS.NON_FISCAL ? '*** COMPROVANTE NÃO FISCAL ***' : title.toUpperCase()
  const brand = params.source.company.legalName || params.source.company.name
  const issuedAt = params.document.issuedAt ?? new Date()
  const rows = params.source.items
    .map(
      (item) => {
        const quantity = Number.isFinite(item.quantity) ? Number(item.quantity) : 1
        const unitPrice = Number.isFinite(item.unitPrice) ? Number(item.unitPrice) : 0
        const total = Number.isFinite(item.total) ? Number(item.total) : quantity * unitPrice

        return `
        <tr>
          <td>${escapeHtml(item.description)}</td>
          <td class="right">${quantity.toFixed(2)}</td>
          <td class="right">${formatCurrency(unitPrice)}</td>
          <td class="right">${formatCurrency(total)}</td>
        </tr>`
      },
    )
    .join('')

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(params.document.code)}</title>
    <style>
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        background: #f4f5f7;
        color: #111827;
      }
      .sheet {
        width: ${isThermal ? '80mm' : '210mm'};
        max-width: 100%;
        min-height: 100vh;
        margin: 0 auto;
        background: white;
        padding: ${isThermal ? '10mm 8mm' : '18mm'};
      }
      .alert {
        margin: 0 0 12px;
        padding: 10px 12px;
        border: 1px dashed #991b1b;
        color: #991b1b;
        text-align: center;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .header {
        text-align: center;
        border-bottom: 1px solid #d1d5db;
        padding-bottom: 10px;
        margin-bottom: 12px;
      }
      .header h1 {
        margin: 0;
        font-size: ${isThermal ? '16px' : '22px'};
        line-height: 1.15;
      }
      .header p,
      .meta,
      .notes,
      .footer {
        font-size: ${isThermal ? '11px' : '13px'};
        line-height: 1.5;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 12px;
        margin-bottom: 12px;
      }
      .meta strong {
        display: block;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #6b7280;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0 12px;
      }
      th,
      td {
        border-bottom: 1px solid #e5e7eb;
        padding: 6px 0;
        vertical-align: top;
      }
      th {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #6b7280;
      }
      .right {
        text-align: right;
      }
      .summary {
        display: grid;
        gap: 6px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #d1d5db;
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
      }
      .summary-row.total {
        font-size: ${isThermal ? '15px' : '16px'};
        font-weight: 700;
      }
      .footer {
        margin-top: 14px;
        color: #6b7280;
      }
      @media print {
        body {
          background: white;
        }
        .sheet {
          width: auto;
          min-height: auto;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      ${params.document.kind === DOCUMENT_KINDS.NON_FISCAL ? `<div class="alert">${header}</div>` : ''}
      <header class="header">
        <h1>${escapeHtml(brand)}</h1>
        <p>${escapeHtml(formatDocument(params.source.company.cnpj))}</p>
        <p>${escapeHtml(formatAddress(params.source.company.fiscalAddress))}</p>
      </header>

      <section class="meta-grid">
        <div class="meta"><strong>Documento</strong>${escapeHtml(params.document.code)}</div>
        <div class="meta"><strong>Modelo</strong>${escapeHtml(params.document.model)}</div>
        <div class="meta"><strong>Origem</strong>${escapeHtml(params.source.sourceType)}</div>
        <div class="meta"><strong>Emissão</strong>${escapeHtml(issuedAt.toLocaleString('pt-BR'))}</div>
      </section>

      ${params.source.customer ? `
        <section class="meta-grid">
          <div class="meta"><strong>Cliente</strong>${escapeHtml(params.source.customer.name)}</div>
          <div class="meta"><strong>Documento</strong>${escapeHtml(formatDocument(params.source.customer.cpfCnpj))}</div>
          <div class="meta"><strong>Email</strong>${escapeHtml(params.source.customer.email ?? 'Não informado')}</div>
          <div class="meta"><strong>Telefone</strong>${escapeHtml(params.source.customer.phone ?? 'Não informado')}</div>
        </section>
      ` : ''}

      ${params.source.supplier ? `
        <section class="meta-grid">
          <div class="meta"><strong>Fornecedor</strong>${escapeHtml(params.source.supplier.name)}</div>
          <div class="meta"><strong>Email</strong>${escapeHtml(params.source.supplier.email ?? 'Não informado')}</div>
          <div class="meta"><strong>Telefone</strong>${escapeHtml(params.source.supplier.phone ?? 'Não informado')}</div>
        </section>
      ` : ''}

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="right">Qtd</th>
            <th class="right">Unit.</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <section class="summary">
        <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(params.document.subtotal)}</span></div>
        <div class="summary-row"><span>Desconto</span><span>- ${formatCurrency(params.document.discount)}</span></div>
        <div class="summary-row total"><span>Total</span><span>${formatCurrency(params.document.total)}</span></div>
      </section>

      ${params.document.notes ? `<section class="notes"><strong>Observações:</strong> ${escapeHtml(params.document.notes)}</section>` : ''}

      <section class="footer">
        <div>Status: ${escapeHtml(params.document.status)}</div>
        <div>Formato de impressão: ${escapeHtml(params.document.printFormat)}</div>
      </section>
    </main>
  </body>
</html>`
}

export { buildDocumentPrintHtml }
