import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'

export async function GET() {
  const companyId = await getActiveCompanyId()

  const orders = await prisma.purchaseOrder.findMany({
    where: { companyId },
    include: { supplier: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const header = ['codigo', 'status', 'fornecedor', 'subtotal', 'criadoEm']
  const lines = orders.map((order) => [
    order.code,
    order.status,
    order.supplier?.name ?? '',
    order.subtotal.toFixed(2),
    order.createdAt.toISOString(),
  ])

  const csv = [header, ...lines]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pedidos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
