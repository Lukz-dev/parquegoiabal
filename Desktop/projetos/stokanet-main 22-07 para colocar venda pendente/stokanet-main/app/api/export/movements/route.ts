import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'

const csvEscape = (value: string | number | null | undefined) => {
  const normalized = String(value ?? '')
  return `"${normalized.replace(/"/g, '""')}"`
}

export async function GET() {
  const companyId = await getActiveCompanyId()

  const movements = await prisma.movement.findMany({
    where: { companyId },
    include: { product: { select: { name: true, sku: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const headers = ['id', 'tipo', 'produto', 'sku', 'quantidade', 'motivo', 'criado_em']
  const lines = [headers.map(csvEscape).join(',')]

  for (const movement of movements) {
    lines.push([
      movement.id,
      movement.type,
      movement.product.name,
      movement.product.sku,
      movement.quantity,
      movement.reason ?? '',
      movement.createdAt.toISOString(),
    ].map(csvEscape).join(','))
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="movimentacoes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
