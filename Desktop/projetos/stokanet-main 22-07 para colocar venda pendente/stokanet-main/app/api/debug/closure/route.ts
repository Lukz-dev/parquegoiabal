import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'

function parseDateParam(value: string | null) {
  if (!value) throw new Error('Informe a data no formato YYYY-MM-DD.')
  const normalized = value.trim()
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(normalized)) throw new Error('Use YYYY-MM-DD.')
  const [y, m, d] = normalized.split('-').map(Number)
  const parsed = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
  if (Number.isNaN(parsed.getTime())) throw new Error('Data invalida.')
  return parsed
}

function dayBoundsBrt(day: Date) {
  const year = day.getUTCFullYear()
  const month = day.getUTCMonth()
  const date = day.getUTCDate()
  const start = new Date(Date.UTC(year, month, date, 3, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, date + 1, 3, 0, 0, 0))
  return { start, end }
}

export async function GET(request: Request) {
  try {
    const companyId = await getActiveCompanyId()
    const url = new URL(request.url)
    const day = parseDateParam(url.searchParams.get('date'))
    const { start, end } = dayBoundsBrt(day)

    const sales = await prisma.sale.findMany({
      where: { companyId, createdAt: { gte: start, lt: end } },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    })

    const saleIds = sales.map((s) => s.id)
    const auditLogs = saleIds.length
      ? await prisma.auditLog.findMany({ where: { companyId, entity: 'SALE', action: 'CREATE', entityId: { in: saleIds } } })
      : []

    const userIds = [...new Set(auditLogs.map((l) => l.userId).filter((v): v is string => Boolean(v)))]
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds }, companyId }, select: { id: true, name: true, email: true } }) : []

    const userById = new Map(users.map((u) => [u.id, u]))
    const auditBySaleId = new Map(auditLogs.map((l) => [l.entityId ?? '', l]))

    const totalCount = sales.length
    const totalSum = Number(sales.reduce((acc, s) => acc + (s.total ?? 0), 0).toFixed(2))

    const nonCancelledSales = sales.filter((s) => !(s.notes ?? '').includes('[CANCELADA]'))
    const nonCancelledCount = nonCancelledSales.length
    const nonCancelledSum = Number(nonCancelledSales.reduce((acc, s) => acc + (s.total ?? 0), 0).toFixed(2))

    const items = sales.map((s) => {
      const audit = auditBySaleId.get(s.id)
      const seller = audit?.userId ? userById.get(audit.userId) : null
      return {
        id: s.id,
        code: s.code,
        createdAt: s.createdAt,
        total: s.total,
        cancelled: (s.notes ?? '').includes('[CANCELADA]'),
        sellerName: seller?.name ?? null,
        sellerEmail: seller?.email ?? null,
        itemsCount: s.items.length,
      }
    })

    return NextResponse.json({
      date: day.toISOString().slice(0, 10),
      bounds: { start: start.toISOString(), end: end.toISOString() },
      companyId,
      totalCount,
      totalSum,
      nonCancelledCount,
      nonCancelledSum,
      sales: items,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro' }, { status: 400 })
  }
}
