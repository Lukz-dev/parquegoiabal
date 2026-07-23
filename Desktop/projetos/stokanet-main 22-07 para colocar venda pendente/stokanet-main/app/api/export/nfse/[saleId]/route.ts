import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

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

const escapeHtml = (value: string | null | undefined) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

type RouteContext = {
  params: Promise<{ saleId: string }>
}

export async function GET(_: Request, context: RouteContext) {
  const companyId = await getActiveCompanyId()
  const { saleId } = await context.params

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, companyId },
    include: {
      company: true,
      customer: true,
      items: {
        select: {
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
    return NextResponse.json({ error: 'Venda não encontrada.' }, { status: 404 })
  }

  const issueDate = sale.createdAt.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  const companyAddress = formatAddress(sale.company.fiscalAddress)
  const customerAddress = formatAddress(sale.customer?.address)
  const customerDocument = sale.customer ? formatDocument(sale.customer.cpfCnpj) : 'Não informado'
  const companyDocument = formatDocument(sale.company.cnpj)
  const serviceDescription = sale.items
    .map((item) => `${item.productName} (${item.quantity} x ${formatCurrency(item.unitPrice)})`)
    .join(' | ')

  const html = `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>NFS-e Padrão Nacional ${escapeHtml(sale.code)}</title>
      <style>
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          background: #f4f6fb;
          color: #172033;
        }
        .page {
          max-width: 920px;
          margin: 24px auto;
          padding: 24px;
        }
        .card {
          background: #ffffff;
          border: 1px solid #d9e0ef;
          border-radius: 20px;
          box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }
        .header {
          padding: 28px 28px 20px;
          border-bottom: 1px solid #e6ebf5;
          background: linear-gradient(135deg, #0f766e 0%, #124e66 100%);
          color: white;
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.18em;
          font-size: 12px;
          opacity: 0.85;
          margin: 0 0 8px;
        }
        h1 {
          margin: 0;
          font-size: 30px;
          line-height: 1.1;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          padding: 24px 28px 12px;
        }
        .meta {
          padding: 14px 16px;
          border: 1px solid #e6ebf5;
          border-radius: 14px;
          background: #f8faff;
        }
        .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #667085; margin-bottom: 6px; }
        .value { font-size: 15px; font-weight: 700; color: #101828; }
        .section {
          padding: 8px 28px 24px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #e6ebf5;
          border-radius: 16px;
          overflow: hidden;
        }
        thead th {
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #475467;
          background: #f8faff;
          padding: 14px 12px;
          border-bottom: 1px solid #e6ebf5;
        }
        tbody td {
          padding: 14px 12px;
          border-bottom: 1px solid #eef2f7;
          vertical-align: top;
        }
        tbody tr:last-child td { border-bottom: 0; }
        .right { text-align: right; }
        .summary {
          padding: 0 28px 28px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .summary-card {
          border: 1px solid #e6ebf5;
          border-radius: 16px;
          padding: 16px;
          background: linear-gradient(180deg, #fff 0%, #f9fbff 100%);
        }
        .summary-card .label { margin-bottom: 8px; }
        .summary-card .value { font-size: 20px; }
        .info-grid {
          padding: 0 28px 24px;
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .info-block {
          border: 1px solid #e6ebf5;
          border-radius: 16px;
          padding: 16px;
          background: #f8faff;
        }
        .info-block h2 {
          margin: 0 0 10px;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #475467;
        }
        .info-line {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
        }
        .footer {
          padding: 0 28px 28px;
          color: #667085;
          font-size: 12px;
          line-height: 1.6;
        }
        .actions {
          display: flex;
          justify-content: flex-end;
          padding: 0 28px 28px;
        }
        .button {
          border: 0;
          border-radius: 12px;
          background: #0f766e;
          color: white;
          padding: 12px 16px;
          font-weight: 700;
          cursor: pointer;
        }
        @media print {
          body { background: white; }
          .page { margin: 0; padding: 0; }
          .card { box-shadow: none; border: 0; border-radius: 0; }
          .actions { display: none; }
        }
        @media (max-width: 720px) {
          .meta-grid, .summary { grid-template-columns: 1fr; }
          .page { padding: 0; }
          .header, .meta-grid, .section, .summary, .footer, .actions { padding-left: 16px; padding-right: 16px; }
        }
      </style>
    </head>
    <body>
      <main class="page">
        <article class="card">
          <header class="header">
            <div class="header-top">
              <div>
                <p class="eyebrow">NFS-e padrão nacional</p>
                <h1>Nota Fiscal de Serviço eletrônica</h1>
                <p style="margin:10px 0 0; opacity:.9">Modelo de conferência e impressão com layout inspirado no padrão nacional.</p>
              </div>
              <div style="text-align:right">
                <p class="eyebrow" style="margin-bottom:6px">Número</p>
                <h1 style="font-size:24px">${escapeHtml(sale.code)}</h1>
              </div>
            </div>
          </header>

          <section class="meta-grid">
            <div class="meta">
              <div class="label">Prestador de serviço</div>
              <div class="value">${escapeHtml(sale.company.legalName || sale.company.name)}</div>
            </div>
            <div class="meta">
              <div class="label">Emissão</div>
              <div class="value">${escapeHtml(issueDate)}</div>
            </div>
            <div class="meta">
              <div class="label">CNPJ</div>
              <div class="value">${escapeHtml(companyDocument)}</div>
            </div>
            <div class="meta">
              <div class="label">Status</div>
              <div class="value">Documento interno</div>
            </div>
          </section>

          <section class="info-grid">
            <div class="info-block">
              <h2>Prestador de serviço</h2>
              <p class="info-line"><strong>Razão social:</strong> ${escapeHtml(sale.company.legalName || sale.company.name)}</p>
              <p class="info-line"><strong>Inscrição estadual:</strong> ${escapeHtml(sale.company.ie ?? 'Não informado')}</p>
              <p class="info-line"><strong>Endereço:</strong> ${escapeHtml(companyAddress)}</p>
            </div>
            <div class="info-block">
              <h2>Tomador de serviço</h2>
              <p class="info-line"><strong>Nome:</strong> ${escapeHtml(sale.customer?.name ?? 'Consumidor final')}</p>
              <p class="info-line"><strong>CPF/CNPJ:</strong> ${escapeHtml(customerDocument)}</p>
              <p class="info-line"><strong>Endereço:</strong> ${escapeHtml(customerAddress)}</p>
            </div>
          </section>

          <section class="info-grid" style="padding-top: 0;">
            <div class="info-block">
              <h2>Discriminação do serviço</h2>
              <p class="info-line">${escapeHtml(serviceDescription || 'Serviço referente à venda registrada no sistema.')}</p>
            </div>
            <div class="info-block">
              <h2>Dados complementares</h2>
              <p class="info-line"><strong>Forma de pagamento:</strong> ${escapeHtml(sale.paymentMethod ?? 'Não informada')}</p>
              <p class="info-line"><strong>Base legal:</strong> Documento gerado para conferência interna em formato compatível com o modelo nacional.</p>
            </div>
          </section>

          <section class="section">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th class="right">Qtd.</th>
                  <th class="right">Valor unitário</th>
                  <th class="right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${sale.items.map((item) => `
                  <tr>
                    <td>
                      <strong>${escapeHtml(item.productName)}</strong>
                    </td>
                    <td>${escapeHtml(item.sku)}</td>
                    <td class="right">${item.quantity}</td>
                    <td class="right">${formatCurrency(item.unitPrice)}</td>
                    <td class="right">${formatCurrency(item.total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </section>

          <section class="summary">
            <div class="summary-card">
              <div class="label">Subtotal</div>
              <div class="value">${formatCurrency(sale.subtotal)}</div>
            </div>
            <div class="summary-card">
              <div class="label">Desconto</div>
              <div class="value">${formatCurrency(sale.discount)}</div>
            </div>
            <div class="summary-card">
              <div class="label">Total</div>
              <div class="value">${formatCurrency(sale.total)}</div>
            </div>
          </section>

          <section class="footer">
            <p>Este documento segue um layout de conferência alinhado ao padrão nacional da NFS-e.</p>
            <p>Para emissão oficial junto ao provedor nacional ou municipal, ainda é necessário integrar a API da prefeitura ou do ambiente nacional correspondente.</p>
          </section>

          <div class="actions">
            <button class="button" type="button" onclick="window.print()">Imprimir / salvar em PDF</button>
          </div>
        </article>
      </main>
    </body>
  </html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}