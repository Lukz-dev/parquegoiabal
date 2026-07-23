import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'

export async function GET() {
  const companyId = await getActiveCompanyId()

  const logs = await prisma.auditLog.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  })

  const header = ['data', 'acao', 'entidade', 'entidadeId', 'detalhes']
  const lines = logs.map((log) => [
    log.createdAt.toISOString(),
    log.action,
    log.entity,
    log.entityId ?? '',
    log.details ?? '',
  ])

  const csv = [header, ...lines]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
