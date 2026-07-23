import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'

const csvEscape = (value: string | number | null | undefined) => {
  const normalized = String(value ?? '')
  return `"${normalized.replace(/"/g, '""')}"`
}

export async function GET() {
  const companyId = await getActiveCompanyId()

  const transfers = await prisma.warehouseTransfer.findMany({
    where: { companyId },
    include: {
      fromWarehouse: { select: { name: true, code: true } },
      toWarehouse: { select: { name: true, code: true } },
      items: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const headers = ['codigo', 'status', 'origem', 'destino', 'produto', 'quantidade', 'observacoes', 'criado_em']
  const lines = [headers.map(csvEscape).join(',')]

  for (const transfer of transfers) {
    if (transfer.items.length === 0) {
      lines.push([
        transfer.code,
        transfer.status,
        `${transfer.fromWarehouse.name} (${transfer.fromWarehouse.code})`,
        `${transfer.toWarehouse.name} (${transfer.toWarehouse.code})`,
        '',
        '',
        transfer.notes ?? '',
        transfer.createdAt.toISOString(),
      ].map(csvEscape).join(','))
      continue
    }

    for (const item of transfer.items) {
      lines.push([
        transfer.code,
        transfer.status,
        `${transfer.fromWarehouse.name} (${transfer.fromWarehouse.code})`,
        `${transfer.toWarehouse.name} (${transfer.toWarehouse.code})`,
        item.productName,
        item.quantity,
        transfer.notes ?? '',
        transfer.createdAt.toISOString(),
      ].map(csvEscape).join(','))
    }
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="transferencias-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
