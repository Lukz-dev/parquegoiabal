import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'

export async function GET() {
  const companyId = await getActiveCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  const batches = await prisma.batch.findMany({
    where: { companyId },
    include: { product: { select: { name: true, sku: true } } },
    orderBy: { expiresAt: 'asc' },
  })

  const header = ['lote', 'produto', 'sku', 'quantidade', 'validade']
  const lines = batches.map((batch) => [
    batch.code,
    batch.product.name,
    batch.product.sku,
    batch.quantity,
    batch.expiresAt.toISOString(),
  ])

  const csv = [header, ...lines]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lotes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
