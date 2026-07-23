import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'

const csvEscape = (value: string | number | null | undefined) => {
  const normalized = String(value ?? '')
  return `"${normalized.replace(/"/g, '""')}"`
}

export async function GET() {
  const companyId = await getActiveCompanyId()

  const products = await prisma.product.findMany({
    where: { companyId },
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  })

  const headers = [
    'id', 'nome', 'sku', 'variacao', 'cor', 'categoria', 'preco', 'estoque', 'estoque_minimo', 'status', 'criado_em',
  ]

  const lines = [headers.map(csvEscape).join(',')]

  for (const product of products) {
    lines.push([
      product.id,
      product.name,
      product.sku,
      product.size ?? '',
      product.color ?? '',
      product.category?.name ?? '',
      product.price.toFixed(2),
      product.stockQty,
      product.minStock,
      product.status,
      product.createdAt.toISOString(),
    ].map(csvEscape).join(','))
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="produtos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
