import { NextResponse } from 'next/server'
import { getSales } from '@/lib/actions'

const csvEscape = (value: string | number | null | undefined) => {
  const normalized = String(value ?? '')
  return `"${normalized.replace(/"/g, '""')}"`
}

export async function GET() {
  const sales = await getSales(1000)

  const headers = ['venda_codigo', 'criado_em', 'forma_pagamento', 'subtotal', 'desconto', 'total', 'produto', 'sku', 'quantidade', 'preco_unitario', 'custo_unitario', 'custo_total', 'lucro_bruto_item', 'total_item']
  const lines = [headers.map(csvEscape).join(',')]

  for (const sale of sales) {
    for (const item of sale.items) {
      const itemCost = Number((item.quantity * item.unitCost).toFixed(2))
      const itemProfit = Number((item.total - itemCost).toFixed(2))
      lines.push([
        sale.code,
        sale.createdAt.toISOString(),
        sale.paymentMethod ?? '',
        sale.subtotal.toFixed(2),
        sale.discount.toFixed(2),
        sale.total.toFixed(2),
        item.productName,
        item.sku,
        item.quantity,
        item.unitPrice.toFixed(2),
        item.unitCost.toFixed(2),
        itemCost.toFixed(2),
        itemProfit.toFixed(2),
        item.total.toFixed(2),
      ].map(csvEscape).join(','))
    }
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vendas-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
