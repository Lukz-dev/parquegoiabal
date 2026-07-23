'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import type { AppRole } from '@/lib/roles'
import { getActiveCompanyId, getActiveUser } from '@/lib/access'
import { THEME_PREFERENCES, type ThemePreference } from '@/lib/theme'
import { processSaleWithNfe } from '@/lib/sales/processSaleWithNfe'

async function getCompanyId(): Promise<string> {
  return getActiveCompanyId()
}

async function getAuthenticatedUser() {
  const user = await getActiveUser()
  return user as { id: string; companyId?: string; role?: AppRole }
}

async function requireRole(allowedRoles: AppRole[]) {
  const user = await getAuthenticatedUser()
  const role = user.role ?? 'OPERATOR'
  if (!allowedRoles.includes(role)) {
    throw new Error('Você não tem permissão para esta ação.')
  }
  return user
}

async function logAudit(data: {
  action: string
  entity: string
  entityId?: string
  details?: string
  companyId: string
  userId?: string
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        details: data.details,
        companyId: data.companyId,
        userId: data.userId,
      },
    })
  } catch {
    // Não bloqueia a operação principal.
  }
}

async function sendExternalAlertIfConfigured(companyId: string, payload: { title: string; message: string; level: 'critical' | 'warning' | 'info' }) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { notificationWebhookUrl: true, name: true },
    })
    const webhookUrl = company?.notificationWebhookUrl?.trim()
    if (!webhookUrl) return

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'StokaNet',
        companyId,
        companyName: company?.name ?? '',
        ...payload,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    // Falha externa não interrompe fluxo interno.
  }
}

function toMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseMonthParams(params?: { year?: number; month?: number }) {
  const now = new Date()
  const year = params?.year ?? now.getUTCFullYear()
  const month = params?.month ?? now.getUTCMonth() + 1

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('Ano invalido para fechamento.')
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Mes invalido para fechamento.')
  }

  return { year, month, monthKey: toMonthKey(year, month) }
}

function getMonthBoundsUtc(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
  return { start, end }
}

function parseIsoDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error('Data invalida. Use o formato YYYY-MM-DD.')
  }

  const parts = day.split('-').map(Number)
  const [year, month, dayOfMonth] = parts
  if ([year, month, dayOfMonth].some((n) => !Number.isInteger(n))) {
    throw new Error('Data invalida para fechamento diario.')
  }

  // Interpretamos o dia como dia comercial local no BRT (UTC-3).
  // Começo do dia local 00:00 BRT corresponde a 03:00 UTC do mesmo dia.
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth, 3, 0, 0, 0))
  if (Number.isNaN(date.getTime())) {
    throw new Error('Data invalida para fechamento diario.')
  }

  return date
}

function getDayBoundsUtc(isoDay: string) {
  const start = parseIsoDay(isoDay)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

function toIsoDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

const AUTO_SALES_SUMMARY_START = '### RESUMO AUTOMATICO - VENDAS POR PAGAMENTO ###'
const AUTO_SALES_SUMMARY_END = '### FIM RESUMO AUTOMATICO ###'

function formatCurrencyBr(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function mapPaymentMethodLabel(method: string | null) {
  const normalized = (method ?? '').trim().toUpperCase()
  if (!normalized) return 'Não informado'

  const labels: Record<string, string> = {
    PIX: 'PIX',
    DINHEIRO: 'Dinheiro',
    CASH: 'Dinheiro',
    CARTAO_CREDITO: 'Cartão de crédito',
    CREDIT_CARD: 'Cartão de crédito',
    CARTAO_DEBITO: 'Cartão de débito',
    DEBIT_CARD: 'Cartão de débito',
  }

  return labels[normalized] ?? method ?? 'Não informado'
}

function stripAutoSalesSummary(notes: string | null) {
  if (!notes) return ''

  const startIndex = notes.indexOf(AUTO_SALES_SUMMARY_START)
  if (startIndex === -1) return notes.trim()

  const endIndex = notes.indexOf(AUTO_SALES_SUMMARY_END)
  if (endIndex === -1 || endIndex < startIndex) {
    return notes.slice(0, startIndex).trim()
  }

  const before = notes.slice(0, startIndex).trim()
  const after = notes.slice(endIndex + AUTO_SALES_SUMMARY_END.length).trim()
  return [before, after].filter(Boolean).join('\n\n').trim()
}

function buildSalesByPaymentSummary(
  groups: Array<{ paymentMethod: string | null; _sum: { total: number | null } }>,
) {
  const normalized = groups
    .map((group) => ({
      paymentLabel: mapPaymentMethodLabel(group.paymentMethod),
      total: Number((group._sum.total ?? 0).toFixed(2)),
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)

  if (normalized.length === 0) {
    return 'Sem vendas no período.'
  }

  return normalized.map((item) => `${formatCurrencyBr(item.total)} no ${item.paymentLabel}`).join('\n')
}

function buildClosureNotesWithSalesSummary(notes: string | null, salesSummary: string) {
  const manualNotes = stripAutoSalesSummary(notes)
  const summaryBlock = [
    AUTO_SALES_SUMMARY_START,
    salesSummary,
    AUTO_SALES_SUMMARY_END,
  ].join('\n')

  return [manualNotes, summaryBlock].filter(Boolean).join('\n\n').trim()
}

function isCancelledSale(notes: string | null | undefined) {
  return (notes ?? '').includes('[CANCELADA]')
}

function groupSalesByPaymentMethod(sales: Array<{ paymentMethod: string | null; total: number }>) {
  const groups = new Map<string | null, number>()

  for (const sale of sales) {
    groups.set(sale.paymentMethod ?? null, (groups.get(sale.paymentMethod ?? null) ?? 0) + sale.total)
  }

  return [...groups.entries()].map(([paymentMethod, total]) => ({
    paymentMethod,
    _sum: { total: Number(total.toFixed(2)) },
  }))
}

export async function getMonthlyClosureCalendar(params?: { year?: number; month?: number }) {
  await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()
  const { year, month, monthKey } = parseMonthParams(params)
  const { start, end } = getMonthBoundsUtc(year, month)

  const [monthClosure, dayClosures] = await Promise.all([
    prisma.monthlyClosure.findUnique({
      where: {
        companyId_year_month: { companyId, year, month },
      },
      select: {
        id: true,
        status: true,
        notes: true,
        daysClosed: true,
        salesTotal: true,
        purchaseTotal: true,
        cashExpected: true,
        closedAt: true,
      },
    }),
    prisma.dailyClosure.findMany({
      where: {
        companyId,
        day: { gte: start, lt: end },
      },
      select: {
        id: true,
        day: true,
        status: true,
        notes: true,
        salesCount: true,
        salesTotal: true,
        purchaseOrdersCount: true,
        purchaseTotal: true,
        stockEntriesQty: true,
        stockOutputsQty: true,
        stockAdjustmentsQty: true,
        stockBalanceQty: true,
        cashExpected: true,
        stockValue: true,
        closedAt: true,
      },
      orderBy: { day: 'asc' },
    }),
  ])

  const closureByDay = new Map(dayClosures.map((item) => [toIsoDay(item.day), item]))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const current = new Date(Date.UTC(year, month - 1, index + 1, 0, 0, 0, 0))
    const iso = toIsoDay(current)
    const closure = closureByDay.get(iso)

    return {
      date: iso,
      day: index + 1,
      weekDay: current.getUTCDay(),
      status: closure?.status ?? 'OPEN',
      notes: closure?.notes ?? null,
      salesCount: closure?.salesCount ?? 0,
      salesTotal: closure?.salesTotal ?? 0,
      purchaseOrdersCount: closure?.purchaseOrdersCount ?? 0,
      purchaseTotal: closure?.purchaseTotal ?? 0,
      stockEntriesQty: closure?.stockEntriesQty ?? 0,
      stockOutputsQty: closure?.stockOutputsQty ?? 0,
      stockAdjustmentsQty: closure?.stockAdjustmentsQty ?? 0,
      stockBalanceQty: closure?.stockBalanceQty ?? 0,
      cashExpected: closure?.cashExpected ?? 0,
      stockValue: closure?.stockValue ?? 0,
      closedAt: closure?.closedAt?.toISOString() ?? null,
    }
  })

  const closedDays = days.filter((item) => item.status === 'CLOSED')
  const summary = {
    daysInMonth,
    closedDays: closedDays.length,
    openDays: daysInMonth - closedDays.length,
    salesTotal: Number(closedDays.reduce((acc, item) => acc + item.salesTotal, 0).toFixed(2)),
    purchaseTotal: Number(closedDays.reduce((acc, item) => acc + item.purchaseTotal, 0).toFixed(2)),
    cashExpected: Number(closedDays.reduce((acc, item) => acc + item.cashExpected, 0).toFixed(2)),
  }

  const prevMonthDate = new Date(Date.UTC(year, month - 2, 1))
  const nextMonthDate = new Date(Date.UTC(year, month, 1))

  return {
    month: {
      year,
      month,
      monthKey,
      status: monthClosure?.status ?? 'OPEN',
      notes: monthClosure?.notes ?? null,
      closedAt: monthClosure?.closedAt?.toISOString() ?? null,
    },
    summary,
    days,
    prev: {
      year: prevMonthDate.getUTCFullYear(),
      month: prevMonthDate.getUTCMonth() + 1,
    },
    next: {
      year: nextMonthDate.getUTCFullYear(),
      month: nextMonthDate.getUTCMonth() + 1,
    },
  }
}

export async function closeDailyClosure(input: { day: string; notes?: string }) {
  const user = await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()
  const { start, end } = getDayBoundsUtc(input.day)
  const year = start.getUTCFullYear()
  const month = start.getUTCMonth() + 1
  const monthKey = toMonthKey(year, month)
  const normalizedNotes = input.notes?.trim() || null

  const existingMonth = await prisma.monthlyClosure.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
    select: { id: true, status: true },
  })

  if (existingMonth?.status === 'CLOSED') {
    throw new Error('Este mes ja foi fechado. Reabra o mes antes de editar dias.')
  }

  const existing = await prisma.dailyClosure.findUnique({
    where: {
      companyId_day: {
        companyId,
        day: start,
      },
    },
  })

  if (existing?.status === 'CLOSED') {
    return { ok: true, alreadyClosed: true, id: existing.id }
  }

  const [salesAggregate, purchaseAggregate, purchaseCount, movementGroups, products] = await Promise.all([
    prisma.sale.findMany({
      where: {
        companyId,
        createdAt: { gte: start, lt: end },
      },
      select: {
        total: true,
        paymentMethod: true,
        notes: true,
      },
    }),
    prisma.purchaseOrder.aggregate({
      _sum: { subtotal: true },
      where: {
        companyId,
        status: 'RECEBIDO',
        updatedAt: { gte: start, lt: end },
      },
    }),
    prisma.purchaseOrder.count({
      where: {
        companyId,
        status: 'RECEBIDO',
        updatedAt: { gte: start, lt: end },
      },
    }),
    prisma.movement.groupBy({
      by: ['type'],
      where: {
        companyId,
        createdAt: { gte: start, lt: end },
      },
      _sum: { quantity: true },
    }),
    prisma.product.findMany({
      where: { companyId, status: { not: 'Arquivado' } },
      select: { price: true, stockQty: true },
    }),
  ])

  const validSales = salesAggregate.filter((sale) => !isCancelledSale(sale.notes))
  const salesCount = validSales.length
  const salesTotal = Number(validSales.reduce((acc, sale) => acc + sale.total, 0).toFixed(2))
  const salesByPaymentGroups = groupSalesByPaymentMethod(validSales)

  const movementMap = new Map(movementGroups.map((group) => [group.type, group._sum.quantity ?? 0]))
  const stockEntriesQty = movementMap.get('ENTRADA') ?? 0
  const stockOutputsQty = movementMap.get('SAIDA') ?? 0
  const stockAdjustmentsQty = movementMap.get('AJUSTE') ?? 0
  const purchaseTotal = Number((purchaseAggregate._sum.subtotal ?? 0).toFixed(2))
  const cashExpected = Number((salesTotal - purchaseTotal).toFixed(2))
  const stockValue = Number(products.reduce((acc, product) => acc + product.price * product.stockQty, 0).toFixed(2))
  const salesByPaymentSummary = buildSalesByPaymentSummary(salesByPaymentGroups)
  const closureNotes = buildClosureNotesWithSalesSummary(normalizedNotes, salesByPaymentSummary)

  const result = await prisma.$transaction(async (tx) => {
    const monthClosure = await tx.monthlyClosure.upsert({
      where: { companyId_year_month: { companyId, year, month } },
      update: {},
      create: {
        year,
        month,
        monthKey,
        companyId,
      },
      select: { id: true },
    })

    const closure = await tx.dailyClosure.upsert({
      where: {
        companyId_day: {
          companyId,
          day: start,
        },
      },
      update: {
        monthKey,
        status: 'CLOSED',
        notes: closureNotes,
        salesCount,
        salesTotal,
        purchaseOrdersCount: purchaseCount,
        purchaseTotal,
        stockEntriesQty,
        stockOutputsQty,
        stockAdjustmentsQty,
        stockBalanceQty: stockEntriesQty - stockOutputsQty,
        cashExpected,
        stockValue,
        closedAt: new Date(),
        closedById: user.id,
        monthlyClosureId: monthClosure.id,
      },
      create: {
        day: start,
        monthKey,
        status: 'CLOSED',
        notes: closureNotes,
        salesCount,
        salesTotal,
        purchaseOrdersCount: purchaseCount,
        purchaseTotal,
        stockEntriesQty,
        stockOutputsQty,
        stockAdjustmentsQty,
        stockBalanceQty: stockEntriesQty - stockOutputsQty,
        cashExpected,
        stockValue,
        closedAt: new Date(),
        closedById: user.id,
        monthlyClosureId: monthClosure.id,
        companyId,
      },
      select: { id: true },
    })

    const monthClosedDays = await tx.dailyClosure.findMany({
      where: {
        companyId,
        monthKey,
        status: 'CLOSED',
      },
      select: {
        salesCount: true,
        salesTotal: true,
        purchaseOrdersCount: true,
        purchaseTotal: true,
        stockEntriesQty: true,
        stockOutputsQty: true,
        stockAdjustmentsQty: true,
        stockBalanceQty: true,
        cashExpected: true,
      },
    })

    await tx.monthlyClosure.update({
      where: { companyId_year_month: { companyId, year, month } },
      data: {
        daysClosed: monthClosedDays.length,
        salesCount: monthClosedDays.reduce((acc, day) => acc + day.salesCount, 0),
        salesTotal: Number(monthClosedDays.reduce((acc, day) => acc + day.salesTotal, 0).toFixed(2)),
        purchaseOrdersCount: monthClosedDays.reduce((acc, day) => acc + day.purchaseOrdersCount, 0),
        purchaseTotal: Number(monthClosedDays.reduce((acc, day) => acc + day.purchaseTotal, 0).toFixed(2)),
        stockEntriesQty: monthClosedDays.reduce((acc, day) => acc + day.stockEntriesQty, 0),
        stockOutputsQty: monthClosedDays.reduce((acc, day) => acc + day.stockOutputsQty, 0),
        stockAdjustmentsQty: monthClosedDays.reduce((acc, day) => acc + day.stockAdjustmentsQty, 0),
        stockBalanceQty: monthClosedDays.reduce((acc, day) => acc + day.stockBalanceQty, 0),
        cashExpected: Number(monthClosedDays.reduce((acc, day) => acc + day.cashExpected, 0).toFixed(2)),
      },
    })

    return closure
  })

  await logAudit({
    action: 'CLOSE',
    entity: 'DAILY_CLOSURE',
    entityId: result.id,
    details: `Fechamento diario ${input.day}`,
    companyId,
    userId: user.id,
  })

  revalidatePath('/fechamento')
  return { ok: true, id: result.id }
}

export async function reopenDailyClosure(input: { day: string }) {
  const user = await requireRole(['ADMIN', 'MANAGER'])
  const companyId = await getCompanyId()
  const { start } = getDayBoundsUtc(input.day)
  const year = start.getUTCFullYear()
  const month = start.getUTCMonth() + 1
  const monthKey = toMonthKey(year, month)

  const monthClosure = await prisma.monthlyClosure.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
    select: { status: true },
  })

  if (monthClosure?.status === 'CLOSED') {
    throw new Error('Este mes esta fechado. Reabra o mes primeiro.')
  }

  const dayClosure = await prisma.dailyClosure.findUnique({
    where: { companyId_day: { companyId, day: start } },
    select: { id: true, status: true },
  })

  if (!dayClosure) {
    throw new Error('Nao existe fechamento salvo para este dia.')
  }

  if (dayClosure.status !== 'CLOSED') {
    return { ok: true, alreadyOpen: true, id: dayClosure.id }
  }

  await prisma.$transaction(async (tx) => {
    await tx.dailyClosure.update({
      where: { id: dayClosure.id },
      data: {
        status: 'OPEN',
        closedAt: null,
        closedById: null,
      },
    })

    const monthClosedDays = await tx.dailyClosure.findMany({
      where: {
        companyId,
        monthKey,
        status: 'CLOSED',
      },
      select: {
        salesCount: true,
        salesTotal: true,
        purchaseOrdersCount: true,
        purchaseTotal: true,
        stockEntriesQty: true,
        stockOutputsQty: true,
        stockAdjustmentsQty: true,
        stockBalanceQty: true,
        cashExpected: true,
      },
    })

    await tx.monthlyClosure.upsert({
      where: { companyId_year_month: { companyId, year, month } },
      update: {
        status: 'OPEN',
        closedAt: null,
        closedById: null,
        daysClosed: monthClosedDays.length,
        salesCount: monthClosedDays.reduce((acc, day) => acc + day.salesCount, 0),
        salesTotal: Number(monthClosedDays.reduce((acc, day) => acc + day.salesTotal, 0).toFixed(2)),
        purchaseOrdersCount: monthClosedDays.reduce((acc, day) => acc + day.purchaseOrdersCount, 0),
        purchaseTotal: Number(monthClosedDays.reduce((acc, day) => acc + day.purchaseTotal, 0).toFixed(2)),
        stockEntriesQty: monthClosedDays.reduce((acc, day) => acc + day.stockEntriesQty, 0),
        stockOutputsQty: monthClosedDays.reduce((acc, day) => acc + day.stockOutputsQty, 0),
        stockAdjustmentsQty: monthClosedDays.reduce((acc, day) => acc + day.stockAdjustmentsQty, 0),
        stockBalanceQty: monthClosedDays.reduce((acc, day) => acc + day.stockBalanceQty, 0),
        cashExpected: Number(monthClosedDays.reduce((acc, day) => acc + day.cashExpected, 0).toFixed(2)),
      },
      create: {
        year,
        month,
        monthKey,
        companyId,
        status: 'OPEN',
        daysClosed: monthClosedDays.length,
        salesCount: monthClosedDays.reduce((acc, day) => acc + day.salesCount, 0),
        salesTotal: Number(monthClosedDays.reduce((acc, day) => acc + day.salesTotal, 0).toFixed(2)),
        purchaseOrdersCount: monthClosedDays.reduce((acc, day) => acc + day.purchaseOrdersCount, 0),
        purchaseTotal: Number(monthClosedDays.reduce((acc, day) => acc + day.purchaseTotal, 0).toFixed(2)),
        stockEntriesQty: monthClosedDays.reduce((acc, day) => acc + day.stockEntriesQty, 0),
        stockOutputsQty: monthClosedDays.reduce((acc, day) => acc + day.stockOutputsQty, 0),
        stockAdjustmentsQty: monthClosedDays.reduce((acc, day) => acc + day.stockAdjustmentsQty, 0),
        stockBalanceQty: monthClosedDays.reduce((acc, day) => acc + day.stockBalanceQty, 0),
        cashExpected: Number(monthClosedDays.reduce((acc, day) => acc + day.cashExpected, 0).toFixed(2)),
      },
    })
  })

  await logAudit({
    action: 'REOPEN',
    entity: 'DAILY_CLOSURE',
    entityId: dayClosure.id,
    details: `Reabertura do fechamento diario ${input.day}`,
    companyId,
    userId: user.id,
  })

  revalidatePath('/fechamento')
  return { ok: true, id: dayClosure.id }
}

export async function closeMonthlyClosure(input: { year: number; month: number; notes?: string }) {
  const user = await requireRole(['ADMIN', 'MANAGER'])
  const companyId = await getCompanyId()
  const { year, month, monthKey } = parseMonthParams({ year: input.year, month: input.month })
  const { start, end } = getMonthBoundsUtc(year, month)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const current = await prisma.monthlyClosure.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
    select: { id: true, status: true },
  })
  if (current?.status === 'CLOSED') {
    return { ok: true, alreadyClosed: true, id: current.id }
  }

  const [closedDays, salesByPaymentGroups] = await Promise.all([
    prisma.dailyClosure.findMany({
      where: {
        companyId,
        day: { gte: start, lt: end },
        status: 'CLOSED',
      },
      select: {
        id: true,
        salesCount: true,
        salesTotal: true,
        purchaseOrdersCount: true,
        purchaseTotal: true,
        stockEntriesQty: true,
        stockOutputsQty: true,
        stockAdjustmentsQty: true,
        stockBalanceQty: true,
        cashExpected: true,
      },
    }),
    prisma.sale.findMany({
      where: {
        companyId,
        createdAt: { gte: start, lt: end },
      },
      select: {
        total: true,
        paymentMethod: true,
        notes: true,
      },
    }),
  ])

  if (closedDays.length !== daysInMonth) {
    throw new Error(`Nao e possivel fechar o mes. Dias fechados: ${closedDays.length}/${daysInMonth}.`)
  }

  const normalizedNotes = input.notes?.trim() || null
  const validSales = salesByPaymentGroups.filter((sale) => !isCancelledSale(sale.notes))
  const salesByPaymentSummary = buildSalesByPaymentSummary(groupSalesByPaymentMethod(validSales.map((sale) => ({
    paymentMethod: sale.paymentMethod,
    total: sale.total,
  }))))
  const closureNotes = buildClosureNotesWithSalesSummary(normalizedNotes, salesByPaymentSummary)

  const result = await prisma.$transaction(async (tx) => {
    const monthClosure = await tx.monthlyClosure.upsert({
      where: { companyId_year_month: { companyId, year, month } },
      update: {
        status: 'CLOSED',
        notes: closureNotes,
        daysClosed: closedDays.length,
        salesCount: closedDays.reduce((acc, day) => acc + day.salesCount, 0),
        salesTotal: Number(closedDays.reduce((acc, day) => acc + day.salesTotal, 0).toFixed(2)),
        purchaseOrdersCount: closedDays.reduce((acc, day) => acc + day.purchaseOrdersCount, 0),
        purchaseTotal: Number(closedDays.reduce((acc, day) => acc + day.purchaseTotal, 0).toFixed(2)),
        stockEntriesQty: closedDays.reduce((acc, day) => acc + day.stockEntriesQty, 0),
        stockOutputsQty: closedDays.reduce((acc, day) => acc + day.stockOutputsQty, 0),
        stockAdjustmentsQty: closedDays.reduce((acc, day) => acc + day.stockAdjustmentsQty, 0),
        stockBalanceQty: closedDays.reduce((acc, day) => acc + day.stockBalanceQty, 0),
        cashExpected: Number(closedDays.reduce((acc, day) => acc + day.cashExpected, 0).toFixed(2)),
        closedAt: new Date(),
        closedById: user.id,
      },
      create: {
        year,
        month,
        monthKey,
        status: 'CLOSED',
        notes: closureNotes,
        daysClosed: closedDays.length,
        salesCount: closedDays.reduce((acc, day) => acc + day.salesCount, 0),
        salesTotal: Number(closedDays.reduce((acc, day) => acc + day.salesTotal, 0).toFixed(2)),
        purchaseOrdersCount: closedDays.reduce((acc, day) => acc + day.purchaseOrdersCount, 0),
        purchaseTotal: Number(closedDays.reduce((acc, day) => acc + day.purchaseTotal, 0).toFixed(2)),
        stockEntriesQty: closedDays.reduce((acc, day) => acc + day.stockEntriesQty, 0),
        stockOutputsQty: closedDays.reduce((acc, day) => acc + day.stockOutputsQty, 0),
        stockAdjustmentsQty: closedDays.reduce((acc, day) => acc + day.stockAdjustmentsQty, 0),
        stockBalanceQty: closedDays.reduce((acc, day) => acc + day.stockBalanceQty, 0),
        cashExpected: Number(closedDays.reduce((acc, day) => acc + day.cashExpected, 0).toFixed(2)),
        closedAt: new Date(),
        closedById: user.id,
        companyId,
      },
      select: { id: true },
    })

    await tx.dailyClosure.updateMany({
      where: {
        companyId,
        day: { gte: start, lt: end },
      },
      data: {
        monthlyClosureId: monthClosure.id,
      },
    })

    return monthClosure
  })

  await logAudit({
    action: 'CLOSE',
    entity: 'MONTHLY_CLOSURE',
    entityId: result.id,
    details: `Fechamento mensal ${monthKey}`,
    companyId,
    userId: user.id,
  })

  revalidatePath('/fechamento')
  return { ok: true, id: result.id }
}

export async function reopenMonthlyClosure(input: { year: number; month: number }) {
  const user = await requireRole(['ADMIN'])
  const companyId = await getCompanyId()
  const { year, month, monthKey } = parseMonthParams({ year: input.year, month: input.month })

  const monthClosure = await prisma.monthlyClosure.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
    select: { id: true, status: true },
  })

  if (!monthClosure) {
    throw new Error('Fechamento mensal nao encontrado.')
  }

  if (monthClosure.status !== 'CLOSED') {
    return { ok: true, alreadyOpen: true, id: monthClosure.id }
  }

  await prisma.monthlyClosure.update({
    where: { id: monthClosure.id },
    data: {
      status: 'OPEN',
      closedAt: null,
      closedById: null,
    },
  })

  await logAudit({
    action: 'REOPEN',
    entity: 'MONTHLY_CLOSURE',
    entityId: monthClosure.id,
    details: `Reabertura do fechamento mensal ${monthKey}`,
    companyId,
    userId: user.id,
  })

  revalidatePath('/fechamento')
  return { ok: true, id: monthClosure.id }
}

// =====================
// DASHBOARD STATS
// =====================
export async function getDashboardStats() {
  const companyId = await getCompanyId()
  const activeProductWhere = { companyId, status: { not: 'Arquivado' } }

  const [totalProducts, lowStockProducts, criticalProducts, products] = await Promise.all([
    prisma.product.count({ where: activeProductWhere }),
    prisma.product.count({ where: { ...activeProductWhere, status: 'Baixo' } }),
    prisma.product.count({ where: { ...activeProductWhere, OR: [{ status: 'Crítico' }, { status: 'Esgotado' }] } }),
    prisma.product.findMany({
      where: activeProductWhere,
      select: { price: true, stockQty: true },
    }),
  ])

  const totalValue = products.reduce((acc, p) => acc + p.price * p.stockQty, 0)
  const totalQty = products.reduce((acc, p) => acc + p.stockQty, 0)

  const criticalList = await prisma.product.findMany({
    where: { ...activeProductWhere, OR: [{ status: 'Crítico' }, { status: 'Esgotado' }, { status: 'Baixo' }] },
    orderBy: { stockQty: 'asc' },
    take: 6,
  })

  return { totalProducts, lowStockProducts, criticalProducts, totalValue, totalQty, criticalList }
}

type BossProductStat = {
  productId: string
  productName: string
  sku: string
  soldQty: number
  soldValue: number
  investedValue: number
  profit: number
  averagePrice: number
}

export async function getBossProfileStats() {
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  from.setHours(0, 0, 0, 0)
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)

  return getBossProfileStatsForRange(from, to)
}

export async function getBossProfileStatsForRange(from: Date, to: Date) {
  const companyId = await getCompanyId()
  const toExclusive = new Date(to)
  toExclusive.setMilliseconds(toExclusive.getMilliseconds() + 1)

  const [saleItems, purchaseItems] = await Promise.all([
    prisma.saleItem.findMany({
      where: { sale: { companyId, createdAt: { gte: from, lt: toExclusive } } },
      select: {
        productId: true,
        productName: true,
        product: { select: { sku: true } },
        quantity: true,
        total: true,
      },
    }),
    prisma.purchaseOrderItem.findMany({
      where: { purchaseOrder: { companyId, status: 'RECEBIDO', createdAt: { gte: from, lt: toExclusive } } },
      select: {
        productId: true,
        productName: true,
        product: { select: { sku: true } },
        quantity: true,
        total: true,
      },
    }),
  ])

  const products = new Map<string, BossProductStat>()

  const ensureProduct = (productId: string, productName: string, sku = '') => {
    const current = products.get(productId)
    if (current) return current

    const created = {
      productId,
      productName,
      sku,
      soldQty: 0,
      soldValue: 0,
      investedValue: 0,
      profit: 0,
      averagePrice: 0,
    }

    products.set(productId, created)
    return created
  }

  for (const item of saleItems) {
    const aggregate = ensureProduct(item.productId, item.productName, item.product.sku)
    aggregate.soldQty += item.quantity
    aggregate.soldValue += item.total
  }

  for (const item of purchaseItems) {
    const aggregate = ensureProduct(item.productId, item.productName, item.product.sku)
    aggregate.investedValue += item.total
  }

  const items = Array.from(products.values()).map((item) => {
    const soldValue = Number(item.soldValue.toFixed(2))
    const investedValue = Number(item.investedValue.toFixed(2))
    const profit = Number((soldValue - investedValue).toFixed(2))
    const averagePrice = item.soldQty > 0 ? Number((soldValue / item.soldQty).toFixed(2)) : 0

    return {
      ...item,
      soldValue,
      investedValue,
      profit,
      averagePrice,
    }
  })

  items.sort((a, b) => b.soldValue - a.soldValue)

  const totalSoldValue = Number(items.reduce((acc, item) => acc + item.soldValue, 0).toFixed(2))
  const totalInvestedValue = Number(items.reduce((acc, item) => acc + item.investedValue, 0).toFixed(2))
  const totalProfit = Number((totalSoldValue - totalInvestedValue).toFixed(2))
  const totalSoldQty = items.reduce((acc, item) => acc + item.soldQty, 0)
  const averagePricePerUnit = totalSoldQty > 0 ? Number((totalSoldValue / totalSoldQty).toFixed(2)) : 0

  return {
    from,
    to,
    totalSoldValue,
    totalInvestedValue,
    totalProfit,
    totalSoldQty,
    averagePricePerUnit,
    products: items.slice(0, 12),
  }
}

// =====================
// PRODUTOS
// =====================
export async function getProducts(search?: string, status?: string, includeArchived = false) {
  try {
    const companyId = await getCompanyId()
    const normalizedSearch = search?.trim()

    return prisma.product.findMany({
      where: {
        companyId,
        ...(normalizedSearch ? {
          OR: [
            { name: { contains: normalizedSearch } },
            { sku: { contains: normalizedSearch } },
            { size: { contains: normalizedSearch } },
            { color: { contains: normalizedSearch } },
          ]
        } : {}),
        ...(status && status !== 'todos' ? { status } : includeArchived ? {} : { status: { not: 'Arquivado' } }),
      },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    })
  } catch {
    // Se não houver sessão/contexto (ex: revalidatePath em background), devolve lista vazia em vez de quebrar o render
    return []
  }
}

export async function getQuickProducts(limit = 5) {
  const companyId = await getCompanyId()

  return prisma.product.findMany({
    where: {
      companyId,
      status: { not: 'Arquivado' },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      purchaseCost: true,
      price: true,
      stockQty: true,
      size: true,
      color: true,
    },
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, Math.min(limit, 20)),
  })
}

function resolveProductStatus(stockQty: number, minStock: number) {
  if (stockQty === 0) return 'Esgotado'
  if (stockQty <= minStock * 0.5) return 'Crítico'
  if (stockQty <= minStock) return 'Baixo'
  return 'Normal'
}

function normalizeSku(sku: string) {
  return sku.trim()
}

export async function createProduct(data: {
  name: string
  sku: string
  size?: string
  color?: string
  purchaseCost: number
  price: number
  stockQty: number
  isBox?: boolean
  unitsPerBox?: number | null
  minStock: number
  categoryId?: string
  ncm?: string
  cest?: string
  cfop?: string
  taxProfile?: unknown
}) {
  const user = await getAuthenticatedUser()
  const companyId = await getCompanyId()
  const sku = normalizeSku(data.sku)

  const existingProduct = await prisma.product.findFirst({
    where: { companyId, sku },
    select: { id: true },
  })

  if (existingProduct) {
    throw new Error(`Não foi possível salvar: o código "${sku}" já está cadastrado em outro produto. Informe um código diferente.`)
  }

  // Calcular status automático
  const status = resolveProductStatus(data.stockQty, data.minStock)

  await prisma.product.create({
    data: {
      ...data,
      sku,
      ncm: data.ncm?.trim() || null,
      cest: data.cest?.trim() || null,
      cfop: data.cfop?.trim() || null,
      taxProfile: (data.taxProfile ?? null) as any,
      purchaseCost: Number.isFinite(data.purchaseCost) ? data.purchaseCost : 0,
      isBox: data.isBox ?? false,
      unitsPerBox: data.unitsPerBox ?? null,
      status,
      companyId,
    },
  })
  revalidatePath('/estoque')
  revalidatePath('/')

  await logAudit({
    action: 'CREATE',
    entity: 'PRODUCT',
    details: `Produto ${data.name} (${data.sku}) criado`,
    companyId,
    userId: user.id,
  })
}

export async function updateProduct(id: string, data: {
  name?: string
  sku?: string
  size?: string
  color?: string
  purchaseCost?: number
  price?: number
  stockQty?: number
  isBox?: boolean
  unitsPerBox?: number | null
  minStock?: number
  categoryId?: string
  ncm?: string
  cest?: string
  cfop?: string
  taxProfile?: unknown
}) {
  const user = await getAuthenticatedUser()
  const companyId = await getCompanyId()

  // Verifica que o produto pertence à empresa
  const product = await prisma.product.findFirst({ where: { id, companyId } })
  if (!product) throw new Error('Produto não encontrado')

  const stockQty = data.stockQty ?? product.stockQty
  const minStock = data.minStock ?? product.minStock
  const status = resolveProductStatus(stockQty, minStock)
  const sku = data.sku === undefined ? undefined : normalizeSku(data.sku)

  if (sku) {
    const existingProduct = await prisma.product.findFirst({
      where: {
        companyId,
        sku,
        id: { not: id },
      },
      select: { id: true },
    })

    if (existingProduct) {
      throw new Error(`Não foi possível salvar: o código "${sku}" já está cadastrado em outro produto. Informe um código diferente.`)
    }
  }

  await prisma.product.update({
    where: { id },
    data: {
      ...data,
      sku,
      ncm: data.ncm === undefined ? undefined : data.ncm?.trim() || null,
      cest: data.cest === undefined ? undefined : data.cest?.trim() || null,
      cfop: data.cfop === undefined ? undefined : data.cfop?.trim() || null,
      taxProfile: data.taxProfile === undefined ? undefined : (data.taxProfile ?? null) as any,
      purchaseCost: data.purchaseCost === undefined ? undefined : data.purchaseCost,
      isBox: data.isBox === undefined ? undefined : data.isBox,
      unitsPerBox: data.unitsPerBox === undefined ? undefined : data.unitsPerBox,
      status,
    },
  })
  revalidatePath('/estoque')
  revalidatePath('/')

  await logAudit({
    action: 'UPDATE',
    entity: 'PRODUCT',
    entityId: id,
    details: `Produto ${id} atualizado`,
    companyId,
    userId: user.id,
  })
}

export async function deleteProduct(id: string) {
  const user = await getAuthenticatedUser()
  const companyId = await getCompanyId()

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id, companyId } })
      if (!product) return { ok: false, reason: 'Produto não encontrado' }

      const [movementCount, saleItemCount, purchaseItemCount, transferItemCount, warehouseStockCount, batchCount] = await Promise.all([
        tx.movement.count({ where: { productId: id, companyId } }),
        tx.saleItem.count({ where: { productId: id, sale: { companyId } } }),
        tx.purchaseOrderItem.count({ where: { productId: id, purchaseOrder: { companyId } } }),
        tx.warehouseTransferItem.count({ where: { productId: id, transfer: { companyId } } }),
        tx.warehouseStock.count({ where: { productId: id, warehouse: { companyId } } }),
        tx.batch.count({ where: { productId: id, companyId } }),
      ])

      if (movementCount || saleItemCount || purchaseItemCount || transferItemCount || warehouseStockCount || batchCount) {
        return { ok: false, reason: 'Este produto possui movimentações ou histórico vinculado e não pode ser excluído.' }
      }

      await tx.product.delete({ where: { id } })
      return { ok: true, productId: id }
    })

    if (!result.ok) {
      // Return structured failure instead of throwing for expected business
      // validation (product has history). Callers should handle the result.
      console.info('[deleteProduct] deletion prevented by history', { id, companyId, reason: result.reason })
      return result
    }

    revalidatePath('/estoque')
    revalidatePath('/')

    await logAudit({
      action: 'DELETE',
      entity: 'PRODUCT',
      entityId: id,
      details: `Produto ${id} removido`,
      companyId,
      userId: user.id,
    })
    return { ok: true, productId: id }
  } catch (error) {
    const errInfo = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) }
    console.error('[deleteProduct] Error deleting product', { id, companyId, userId: user?.id, error: errInfo })
    console.error(error instanceof Error ? error.stack : String(error))
    try {
      await sendExternalAlertIfConfigured(companyId, {
        title: 'Erro ao excluir produto',
        message: `Erro ao excluir produto ${id}: ${error instanceof Error ? error.message : String(error)}`,
        level: 'warning',
      })
    } catch {
      // ignore
    }

    throw error
  }
}

export async function archiveProduct(id: string) {
  const user = await getAuthenticatedUser()
  const companyId = await getCompanyId()

  try {
    const product = await prisma.product.findFirst({ where: { id, companyId } })
    if (!product) throw new Error('Produto não encontrado')

    await prisma.product.update({ where: { id }, data: { status: 'Arquivado' } as any })

    revalidatePath('/estoque')
    revalidatePath('/')

    await logAudit({
      action: 'UPDATE',
      entity: 'PRODUCT',
      entityId: id,
      details: `Produto ${id} arquivado`,
      companyId,
      userId: user.id,
    })

    return { ok: true, productId: id }
  } catch (error) {
    const errInfo = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) }
    console.error('[archiveProduct] Error archiving product', { id, companyId, userId: user?.id, error: errInfo })
    try {
      await sendExternalAlertIfConfigured(companyId, {
        title: 'Erro ao arquivar produto',
        message: `Erro ao arquivar produto ${id}: ${error instanceof Error ? error.message : String(error)}`,
        level: 'warning',
      })
    } catch {
      // ignore
    }

    throw error
  }
}

export async function unarchiveProduct(id: string) {
  const user = await getAuthenticatedUser()
  const companyId = await getCompanyId()

  try {
    const product = await prisma.product.findFirst({ where: { id, companyId } })
    if (!product) throw new Error('Produto não encontrado')

    const status = resolveProductStatus(product.stockQty, product.minStock)

    await prisma.product.update({ where: { id }, data: { status } as any })

    revalidatePath('/estoque')
    revalidatePath('/')

    await logAudit({
      action: 'UPDATE',
      entity: 'PRODUCT',
      entityId: id,
      details: `Produto ${id} desarquivado`,
      companyId,
      userId: user.id,
    })

    return { ok: true, productId: id }
  } catch (error) {
    const errInfo = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) }
    console.error('[unarchiveProduct] Error unarchiving product', { id, companyId, userId: user?.id, error: errInfo })
    try {
      await sendExternalAlertIfConfigured(companyId, {
        title: 'Erro ao desarquivar produto',
        message: `Erro ao desarquivar produto ${id}: ${error instanceof Error ? error.message : String(error)}`,
        level: 'warning',
      })
    } catch {
      // ignore
    }

    throw error
  }
}

// =====================
// CATEGORIAS
// =====================
export async function getCategories() {
  const companyId = await getCompanyId()
  return prisma.category.findMany({ where: { companyId }, orderBy: { name: 'asc' } })
}

export async function createCategory(name: string) {
  const companyId = await getCompanyId()
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error('Informe o nome da categoria.')
  }

  const existingCategory = await prisma.category.findFirst({
    where: { companyId, name: trimmedName },
  })
  if (existingCategory) {
    throw new Error('Esta categoria já existe.')
  }

  const category = await prisma.category.create({ data: { name: trimmedName, companyId } })
  revalidatePath('/estoque')
  return category
}

// =====================
// PERFIL E CONFIGURAÇÕES
// =====================
export async function updateAccountProfile(data: {
  name: string
  email: string
  companyName: string
  avatarUrl?: string | null
}) {
  const user = await getAuthenticatedUser()
  const companyId = await getCompanyId()

  const name = data.name.trim()
  const email = data.email.trim().toLowerCase()
  const companyName = data.companyName.trim()
  const hasAvatarUrl = Object.prototype.hasOwnProperty.call(data, 'avatarUrl')
  const avatarUrl = typeof data.avatarUrl === 'string' ? data.avatarUrl.trim() || null : data.avatarUrl

  if (!name || !email || !companyName) {
    throw new Error('Nome, e-mail e empresa são obrigatórios.')
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } })
  if (existingEmail && existingEmail.id !== user.id) {
    throw new Error('Este e-mail já está em uso.')
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        email,
        ...(hasAvatarUrl ? { avatarUrl } : {}),
      },
    }),
    prisma.company.update({
      where: { id: companyId },
      data: { name: companyName },
    }),
  ])

  revalidatePath('/perfil')
  revalidatePath('/configuracoes')
  revalidatePath('/')
}

export async function updateCompanyPreferences(data: {
  defaultMinStock: number
  notificationWebhookUrl?: string
}) {
  const user = await requireRole(['ADMIN', 'MANAGER'])
  const companyId = await getCompanyId()

  const defaultMinStock = Number.isFinite(data.defaultMinStock)
    ? Math.max(0, Math.floor(data.defaultMinStock))
    : 5

  await prisma.company.update({
    where: { id: companyId },
    data: {
      defaultMinStock,
      ...(Object.prototype.hasOwnProperty.call(data, 'notificationWebhookUrl')
        ? { notificationWebhookUrl: data.notificationWebhookUrl?.trim() || null }
        : {}),
    },
  })

  revalidatePath('/perfil')
  revalidatePath('/configuracoes')
  revalidatePath('/estoque')

  await logAudit({
    action: 'UPDATE',
    entity: 'COMPANY_PREFERENCES',
    entityId: companyId,
    details: 'Preferências da empresa atualizadas',
    companyId,
    userId: user.id,
  })
}

export async function updateThemePreference(themePreference: ThemePreference) {
  const user = await getAuthenticatedUser()

  if (!THEME_PREFERENCES.includes(themePreference)) {
    throw new Error('Tema inválido.')
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { themePreference },
  })

  revalidatePath('/perfil')
  revalidatePath('/configuracoes')
  revalidatePath('/')
}

export async function changePassword(data: {
  currentPassword: string
  newPassword: string
}) {
  const user = await getAuthenticatedUser()

  if (!data.currentPassword || !data.newPassword) {
    throw new Error('Informe a senha atual e a nova senha.')
  }

  if (data.newPassword.length < 8) {
    throw new Error('A nova senha deve ter pelo menos 8 caracteres.')
  }

  const currentUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!currentUser) throw new Error('Usuário não encontrado')

  const isValid = await bcrypt.compare(data.currentPassword, currentUser.password)
  if (!isValid) throw new Error('Senha atual incorreta.')

  const hashedPassword = await bcrypt.hash(data.newPassword, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  })

  revalidatePath('/perfil')
  revalidatePath('/configuracoes')
}

// =====================
// MOVIMENTAÇÕES
// =====================
export async function getMovements(productId?: string) {
  const companyId = await getCompanyId()

  return prisma.movement.findMany({
    where: {
      companyId,
      ...(productId ? { productId } : {}),
    },
    include: { product: { select: { id: true, name: true, sku: true, size: true, color: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function createMovement(data: {
  productId: string
  type: 'ENTRADA' | 'SAIDA' | 'AJUSTE'
  quantity: number
  reason?: string
}) {
  const user = await getAuthenticatedUser()
  const companyId = await getCompanyId()

  const product = await prisma.product.findFirst({ where: { id: data.productId, companyId } })
  if (!product) throw new Error('Produto não encontrado')

  if (data.type === 'SAIDA' && product.stockQty < data.quantity) {
    throw new Error(`Estoque insuficiente. Disponível: ${product.stockQty} und(s).`)
  }

  // Calcula novo estoque
  let newQty = product.stockQty
  if (data.type === 'ENTRADA') newQty += data.quantity
  else if (data.type === 'SAIDA') newQty -= data.quantity
  else if (data.type === 'AJUSTE') newQty = data.quantity

  // Calcula novo status
  let status = 'Normal'
  if (newQty === 0) status = 'Esgotado'
  else if (newQty <= product.minStock * 0.5) status = 'Crítico'
  else if (newQty <= product.minStock) status = 'Baixo'

  // Transação atômica: cria movimentação + atualiza estoque
  await prisma.$transaction([
    prisma.movement.create({
      data: {
        type: data.type,
        quantity: data.quantity,
        reason: data.reason,
        productId: data.productId,
        companyId,
      },
    }),
    prisma.product.update({
      where: { id: data.productId },
      data: { stockQty: newQty, status },
    }),
  ])

  revalidatePath('/movimentacoes')
  revalidatePath('/estoque')
  revalidatePath('/')

  await logAudit({
    action: 'CREATE',
    entity: 'MOVEMENT',
    entityId: data.productId,
    details: `Movimentação ${data.type} de ${data.quantity} unidade(s)`,
    companyId,
    userId: user.id,
  })

  if (status === 'Crítico' || status === 'Esgotado') {
    await sendExternalAlertIfConfigured(companyId, {
      level: 'critical',
      title: `Produto em ${status.toLowerCase()}`,
      message: `Produto ${product.name} (${product.sku}) ficou com status ${status} após movimentação ${data.type}.`,
    })
  }
}

export async function createSaleByCode(data: {
  code: string
  quantity?: number
  reason?: string
}) {
  const companyId = await getCompanyId()
  const code = data.code.trim()
  const quantity = Number.isFinite(data.quantity) ? Math.max(1, Math.floor(data.quantity as number)) : 1

  if (!code) {
    throw new Error('Informe o codigo para leitura.')
  }

  const matches = await prisma.product.findMany({
    where: {
      companyId,
      OR: [
        { sku: code },
        { sku: code.toUpperCase() },
        { sku: code.toLowerCase() },
      ],
    },
    select: { id: true, name: true, sku: true, stockQty: true },
    take: 2,
  })

  if (matches.length === 0) {
    throw new Error('Produto nao encontrado para este codigo.')
  }

  if (matches.length > 1) {
    throw new Error('Ha mais de um produto com este codigo. Use codigos unicos para leitura no caixa.')
  }

  const product = matches[0]

  await createMovement({
    productId: product.id,
    type: 'SAIDA',
    quantity,
    reason: data.reason?.trim() || 'Venda no caixa (leitor)',
  })

  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    quantity,
  }
}

export async function findProductByCode(code: string) {
  const companyId = await getCompanyId()
  const normalizedCode = code.trim()

  if (!normalizedCode) {
    throw new Error('Informe um código válido.')
  }

  const matches = await prisma.product.findMany({
    where: {
      companyId,
      OR: [
        { sku: { equals: normalizedCode } },
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      stockQty: true,
      size: true,
      color: true,
    },
    take: 2,
  })

  if (matches.length === 0) {
    throw new Error('Produto não encontrado para este código.')
  }

  if (matches.length > 1) {
    throw new Error('Há mais de um produto com este código. Use códigos únicos no SKU.')
  }

  return matches[0]
}

export async function completeSale(data: {
  items: Array<{ productId: string; quantity: number }>
  paymentMethod?: string
  paymentBreakdown?: Array<{ method: string; amount: number }>
  discount?: number
  amountReceived?: number
  notes?: string
  details?: string
  isPending?: boolean
}) {
  const user = await getAuthenticatedUser()
  const companyId = await getCompanyId()

  const processed = await processSaleWithNfe({
    items: data.items,
    paymentMethod: data.paymentMethod,
    paymentBreakdown: data.paymentBreakdown,
    discount: data.discount,
    amountReceived: data.amountReceived,
    notes: data.notes,
    details: data.details,
    isPending: data.isPending,
  })

  if (processed.sale.nfe.status === 'REJEITADO') {
    const prefix = processed.sale.nfe.sefazCode ? `[SEFAZ ${processed.sale.nfe.sefazCode}] ` : ''
    throw new Error(prefix + (processed.sale.nfe.sefazMessage || 'NF-e rejeitada pela SEFAZ.'))
  }

  // Allow sales without NF-e (status: PENDENTE) or with NF-e authorized (status: AUTORIZADO)
  if (processed.sale.nfe.status !== 'AUTORIZADO' && processed.sale.nfe.status !== 'PENDENTE') {
    throw new Error('NF-e em processamento. Tente novamente em instantes.')
  }

  revalidatePath('/movimentacoes')
  revalidatePath('/estoque')
  revalidatePath('/caixa')
  revalidatePath('/')

  await logAudit({
    action: 'CREATE',
    entity: 'SALE',
    entityId: processed.sale.id,
    details: processed.sale.isPending
      ? `Venda ${processed.sale.code} registrada como pendente com total ${processed.sale.total.toFixed(2)}`
      : `Venda ${processed.sale.code} finalizada com total ${processed.sale.total.toFixed(2)} (NF-e autorizada)`,
    companyId,
    userId: user.id,
  })

  try {
    const productIds = [...new Set(data.items.map((item) => item.productId))]
    const productsAfter = await prisma.product.findMany({
      where: { companyId, id: { in: productIds } },
      select: { id: true, name: true, stockQty: true, minStock: true },
    })

    const hasCriticalAfterSale = productsAfter.some((product) => product.stockQty === 0 || product.stockQty <= product.minStock * 0.5)

    if (hasCriticalAfterSale) {
      await sendExternalAlertIfConfigured(companyId, {
        level: 'warning',
        title: 'Venda gerou alerta de estoque',
        message: `A venda ${processed.sale.code} deixou ao menos um item em nível crítico ou esgotado.`,
      })
    }
  } catch {
    // Não bloqueia a finalização da venda.
  }

  return {
    id: processed.sale.id,
    code: processed.sale.code,
    subtotal: processed.sale.subtotal,
    discount: processed.sale.discount,
    total: processed.sale.total,
    amountReceived: processed.sale.amountReceived,
    change: processed.sale.change,
  }
}

function isSaleCancelled(notes: string | null) {
  if (!notes) return false
  return notes.includes('[CANCELADA]')
}

function buildCancelledSaleNotes(existingNotes: string | null, reason?: string) {
  const trimmedReason = reason?.trim()
  const header = `[CANCELADA] ${new Date().toISOString()}`
  const reasonLine = trimmedReason ? `Motivo: ${trimmedReason}` : null
  const previous = existingNotes?.trim() || null

  return [header, reasonLine, previous].filter(Boolean).join('\n')
}

export async function cancelSale(input: { saleId: string; reason?: string }) {
  const user = await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()
  const saleId = input.saleId.trim()

  if (!saleId) {
    throw new Error('Venda inválida para cancelamento.')
  }

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, companyId },
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
        },
      },
    },
  })

  if (!sale) {
    throw new Error('Venda não encontrada.')
  }

  if (isSaleCancelled(sale.notes)) {
    return { ok: true, alreadyCancelled: true, id: sale.id, code: sale.code }
  }

  if (sale.nfeStatus === 'AUTORIZADO') {
    throw new Error('Não é possível cancelar por aqui uma venda com NF-e autorizada.')
  }

  if (!sale.isPending && !sale.items.length) {
    throw new Error('A venda não possui itens para estorno de estoque.')
  }

  const productIds = [...new Set(sale.items.map((item) => item.productId))]

  await prisma.$transaction(async (tx) => {
    if (!sale.isPending) {
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        })
      }

      const productsAfter = await tx.product.findMany({
        where: { id: { in: productIds }, companyId },
        select: { id: true, stockQty: true, minStock: true },
      })

      for (const product of productsAfter) {
        const status = resolveProductStatus(product.stockQty, product.minStock)
        await tx.product.update({
          where: { id: product.id },
          data: { status },
        })
      }

      await tx.movement.createMany({
        data: sale.items.map((item) => ({
          type: 'ENTRADA' as const,
          quantity: item.quantity,
          reason: `Cancelamento da venda ${sale.code}`,
          productId: item.productId,
          companyId,
        })),
      })
    }

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        notes: buildCancelledSaleNotes(sale.notes, input.reason),
      },
    })
  })

  revalidatePath('/vendas')
  revalidatePath('/caixa')
  revalidatePath('/movimentacoes')
  revalidatePath('/estoque')
  revalidatePath('/fechamento')
  revalidatePath('/')

  await logAudit({
    action: 'CANCEL',
    entity: 'SALE',
    entityId: sale.id,
    details: `Venda ${sale.code} cancelada${input.reason?.trim() ? `: ${input.reason.trim()}` : ''}`,
    companyId,
    userId: user.id,
  })

  return { ok: true, id: sale.id, code: sale.code }
}

export async function completePendingSale(input: { saleId: string }) {
  const user = await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()
  const saleId = input.saleId.trim()

  if (!saleId) {
    throw new Error('Venda inválida para conclusão.')
  }

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, companyId },
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
        },
      },
    },
  })

  if (!sale) {
    throw new Error('Venda não encontrada.')
  }

  if (isSaleCancelled(sale.notes)) {
    throw new Error('Não é possível concluir uma venda cancelada.')
  }

  if (!sale.isPending) {
    throw new Error('Esta venda já foi concluída.')
  }

  if (sale.items.length === 0) {
    throw new Error('A venda não possui itens para concluir.')
  }

  const productIds = [...new Set(sale.items.map((item) => item.productId))]

  await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { companyId, id: { in: productIds } },
      select: { id: true, name: true, stockQty: true, minStock: true },
    })

    const productMap = new Map(products.map((product) => [product.id, product]))

    for (const item of sale.items) {
      const product = productMap.get(item.productId)
      if (!product) {
        throw new Error('Produto da venda não encontrado.')
      }

      if (product.stockQty < item.quantity) {
        throw new Error(`Estoque insuficiente para ${product.name}. Disponível: ${product.stockQty}.`)
      }

      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { decrement: item.quantity } },
      })
    }

    const updatedProducts = await tx.product.findMany({
      where: { companyId, id: { in: productIds } },
      select: { id: true, stockQty: true, minStock: true },
    })

    for (const product of updatedProducts) {
      await tx.product.update({
        where: { id: product.id },
        data: { status: resolveProductStatus(product.stockQty, product.minStock) },
      })
    }

    await tx.movement.createMany({
      data: sale.items.map((item) => ({
        type: 'SAIDA' as const,
        quantity: item.quantity,
        reason: `Conclusão da venda pendente ${sale.code}`,
        productId: item.productId,
        companyId,
      })),
    })

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        isPending: false,
        stockCommittedAt: new Date(),
      },
    })
  })

  revalidatePath('/vendas')
  revalidatePath('/caixa')
  revalidatePath('/movimentacoes')
  revalidatePath('/estoque')
  revalidatePath('/fechamento')
  revalidatePath('/relatorios')
  revalidatePath('/')

  await logAudit({
    action: 'COMPLETE',
    entity: 'SALE',
    entityId: sale.id,
    details: `Venda pendente ${sale.code} concluída`,
    companyId,
    userId: user.id,
  })

  return { ok: true, id: sale.id, code: sale.code }
}

export async function getSales(limit = 50) {
  const companyId = await getCompanyId()

  const sales = await prisma.sale.findMany({
    where: { companyId },
    include: {
      items: {
        include: {
          product: { select: { purchaseCost: true } },
        },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, Math.min(limit, 200)),
  })

  // Map to include unitCost directly on item for export convenience
  return sales.map((s) => ({
    ...s,
    items: s.items.map((it: any) => ({
      id: it.id,
      productName: it.productName,
      sku: it.sku,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      total: it.total,
      unitCost: it.product?.purchaseCost ?? 0,
    })),
  }))
}

export async function getSaleById(id: string) {
  const companyId = await getCompanyId()

  return prisma.sale.findFirst({
    where: { id, companyId },
    include: {
      company: true,
      customer: true,
      items: {
        orderBy: { id: 'asc' },
      },
    },
  })
}

export async function updateSale(input: {
  saleId: string
  paymentMethod?: string | null
  discount?: number
  notes?: string | null
  details?: string | null
  items: Array<{
    id: string
    productName: string
    sku: string
    quantity: number
    unitPrice: number
  }>
}) {
  const user = await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()
  const saleId = input.saleId.trim()

  if (!saleId) {
    throw new Error('Venda inválida para edição.')
  }

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, companyId },
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
        },
      },
    },
  })

  if (!sale) {
    throw new Error('Venda não encontrada.')
  }

  if (isSaleCancelled(sale.notes)) {
    throw new Error('Não é possível editar uma venda cancelada.')
  }

  if (sale.nfeStatus === 'AUTORIZADO') {
    throw new Error('Não é possível editar uma venda com NF-e autorizada.')
  }

  const normalizedItems = input.items.map((item) => ({
    id: item.id.trim(),
    productName: item.productName.trim(),
    sku: item.sku.trim(),
    quantity: Math.max(1, Math.floor(Number(item.quantity))),
    unitPrice: Math.max(0, Number(item.unitPrice)),
  }))

  if (normalizedItems.length !== sale.items.length) {
    throw new Error('Nesta versão, a edição mantém a mesma quantidade de itens da venda.')
  }

  const currentItemMap = new Map(sale.items.map((item) => [item.id, item]))
  if (normalizedItems.some((item) => !currentItemMap.has(item.id))) {
    throw new Error('Item da venda não encontrado.')
  }

  const stockDeltas = new Map<string, number>()
  for (const item of normalizedItems) {
    const current = currentItemMap.get(item.id)
    if (!current) continue

    const quantityDelta = item.quantity - current.quantity
    if (quantityDelta !== 0) {
      stockDeltas.set(current.productId, (stockDeltas.get(current.productId) ?? 0) + quantityDelta)
    }
  }

  const subtotal = Number(
    normalizedItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0).toFixed(2),
  )
  const requestedDiscount = Number.isFinite(Number(input.discount)) ? Math.max(0, Number(input.discount)) : sale.discount
  const discount = Math.min(requestedDiscount, subtotal)
  const total = Number(Math.max(0, subtotal - discount).toFixed(2))

  await prisma.$transaction(async (tx) => {
    if (!sale.isPending && stockDeltas.size > 0) {
      const affectedProducts = await tx.product.findMany({
        where: { companyId, id: { in: [...stockDeltas.keys()] } },
        select: { id: true, stockQty: true, minStock: true },
      })

      const affectedMap = new Map(affectedProducts.map((product) => [product.id, product]))

      for (const [productId, quantityDelta] of stockDeltas.entries()) {
        const product = affectedMap.get(productId)
        if (!product) {
          throw new Error('Produto da venda não encontrado.')
        }

        if (quantityDelta > 0 && product.stockQty < quantityDelta) {
          throw new Error('Estoque insuficiente para ajustar a venda.')
        }

        if (quantityDelta > 0) {
          await tx.product.update({
            where: { id: productId },
            data: { stockQty: { decrement: quantityDelta } },
          })
        } else if (quantityDelta < 0) {
          await tx.product.update({
            where: { id: productId },
            data: { stockQty: { increment: Math.abs(quantityDelta) } },
          })
        }
      }

      const updatedProducts = await tx.product.findMany({
        where: { companyId, id: { in: [...stockDeltas.keys()] } },
        select: { id: true, stockQty: true, minStock: true },
      })

      for (const product of updatedProducts) {
        await tx.product.update({
          where: { id: product.id },
          data: { status: resolveProductStatus(product.stockQty, product.minStock) },
        })
      }
    }

    for (const item of normalizedItems) {
      await tx.saleItem.update({
        where: { id: item.id },
        data: {
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: Number((item.quantity * item.unitPrice).toFixed(2)),
        },
      })
    }

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        paymentMethod: input.paymentMethod?.trim() || null,
        discount,
        notes: input.notes?.trim() || null,
        subtotal,
        total,
      },
    })
  })

  revalidatePath('/vendas')
  revalidatePath('/caixa')
  revalidatePath('/estoque')
  revalidatePath('/fechamento')
  revalidatePath('/relatorios')
  revalidatePath('/')

  await logAudit({
    action: 'UPDATE',
    entity: 'SALE',
    entityId: sale.id,
    details: `Venda ${sale.code} editada`,
    companyId,
    userId: user.id,
  })

  return { ok: true, id: sale.id, code: sale.code }
}

export async function createSupplier(data: {
  name: string
  email?: string
  phone?: string
  contactName?: string
  notes?: string
}) {
  const user = await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()

  const supplier = await prisma.supplier.create({
    data: {
      name: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      contactName: data.contactName?.trim() || null,
      notes: data.notes?.trim() || null,
      companyId,
    },
  })

  revalidatePath('/fornecedores')
  await logAudit({
    action: 'CREATE',
    entity: 'SUPPLIER',
    entityId: supplier.id,
    details: `Fornecedor ${supplier.name} criado`,
    companyId,
    userId: user.id,
  })

  return supplier
}

export async function getSuppliers() {
  const companyId = await getCompanyId()
  return prisma.supplier.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  })
}

export async function deleteSupplier(id: string) {
  const user = await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()

  const supplier = await prisma.supplier.findFirst({
    where: { id, companyId },
    select: { id: true },
  })

  if (!supplier) {
    throw new Error('Fornecedor nao encontrado')
  }

  await prisma.supplier.delete({ where: { id: supplier.id } })

  revalidatePath('/fornecedores')
  await logAudit({
    action: 'DELETE',
    entity: 'SUPPLIER',
    entityId: id,
    details: 'Fornecedor removido',
    companyId,
    userId: user.id,
  })
}

export async function createPurchaseOrder(data: {
  supplierId?: string
  notes?: string
  expectedAt?: string
  items: Array<{ productId: string; quantity: number; unitCost: number }>
}) {
  const user = await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()

  if (!data.items?.length) {
    throw new Error('Adicione ao menos um item no pedido de compra')
  }

  const productIds = data.items.map((item) => item.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, companyId },
    select: { id: true, name: true },
  })

  if (products.length !== productIds.length) {
    throw new Error('Um ou mais produtos nao pertencem a empresa atual')
  }

  const productMap = new Map(products.map((p) => [p.id, p]))
  const code = `PO-${Date.now()}`

  const result = await prisma.$transaction(async (tx) => {
    let subtotal = 0
    const po = await tx.purchaseOrder.create({
      data: {
        code,
        supplierId: data.supplierId || null,
        notes: data.notes?.trim() || null,
        expectedAt: data.expectedAt ? new Date(data.expectedAt) : null,
        companyId,
      },
    })

    for (const item of data.items) {
      if (item.quantity <= 0) throw new Error('Quantidade invalida no pedido')
      if (item.unitCost < 0) throw new Error('Custo unitario invalido no pedido')

      const product = productMap.get(item.productId)
      if (!product) throw new Error('Produto invalido no pedido')

      const total = Number((item.quantity * item.unitCost).toFixed(2))
      subtotal += total

      await tx.purchaseOrderItem.create({
        data: {
          purchaseOrderId: po.id,
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitCost: item.unitCost,
          total,
        },
      })
    }

    const finalSubtotal = Number(subtotal.toFixed(2))
    return tx.purchaseOrder.update({
      where: { id: po.id },
      data: { subtotal: finalSubtotal },
      include: {
        supplier: { select: { id: true, name: true } },
        items: true,
      },
    })
  })

  revalidatePath('/compras')
  await logAudit({
    action: 'CREATE',
    entity: 'PURCHASE_ORDER',
    entityId: result.id,
    details: `Pedido ${result.code} criado`,
    companyId,
    userId: user.id,
  })

  return result
}

export async function receivePurchaseOrder(id: string) {
  const user = await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()

  const order = await prisma.purchaseOrder.findFirst({
    where: { id, companyId },
    include: { items: true },
  })

  if (!order) throw new Error('Pedido de compra nao encontrado')
  if (order.status !== 'PENDENTE') throw new Error('Pedido ja processado')

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, companyId },
      })

      if (!product) continue

      const newStock = product.stockQty + item.quantity
      const status =
        newStock <= 0
          ? 'Esgotado'
          : newStock <= product.minStock * 0.5
            ? 'Crítico'
            : newStock <= product.minStock
              ? 'Baixo'
              : 'Normal'

      await tx.product.update({
        where: { id: product.id },
        data: { stockQty: newStock, status },
      })

      await tx.movement.create({
        data: {
          type: 'ENTRADA',
          quantity: item.quantity,
          reason: `Recebimento do pedido ${order.code}`,
          productId: product.id,
          companyId,
        },
      })
    }

    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { status: 'RECEBIDO' },
    })
  })

  revalidatePath('/compras')
  revalidatePath('/estoque')
  revalidatePath('/movimentacoes')

  await logAudit({
    action: 'UPDATE',
    entity: 'PURCHASE_ORDER',
    entityId: id,
    details: `Pedido ${order.code} recebido`,
    companyId,
    userId: user.id,
  })
}

export async function getPurchaseOrders(limit = 100) {
  const companyId = await getCompanyId()
  return prisma.purchaseOrder.findMany({
    where: { companyId },
    include: {
      supplier: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          productId: true,
          productName: true,
          quantity: true,
          unitCost: true,
          total: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, Math.min(limit, 500)),
  })
}

export async function createWarehouse(data: {
  name: string
  code: string
  address?: string
  isDefault?: boolean
}) {
  const user = await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()

  const code = data.code.trim().toUpperCase()
  const existing = await prisma.warehouse.findFirst({
    where: { companyId, code },
    select: { id: true },
  })

  if (existing) throw new Error('Ja existe deposito com este codigo')

  const warehouse = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.warehouse.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      })
    }

    return tx.warehouse.create({
      data: {
        name: data.name.trim(),
        code,
        address: data.address?.trim() || null,
        isDefault: Boolean(data.isDefault),
        companyId,
      },
    })
  })

  revalidatePath('/filiais')
  await logAudit({
    action: 'CREATE',
    entity: 'WAREHOUSE',
    entityId: warehouse.id,
    details: `Deposito ${warehouse.name} criado`,
    companyId,
    userId: user.id,
  })

  return warehouse
}

export async function getWarehouses() {
  const companyId = await getCompanyId()
  return prisma.warehouse.findMany({
    where: { companyId },
    include: {
      _count: { select: { stocks: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })
}

export async function adjustWarehouseStock(data: {
  warehouseId: string
  productId: string
  quantity: number
}) {
  const user = await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()

  const [warehouse, product] = await Promise.all([
    prisma.warehouse.findFirst({ where: { id: data.warehouseId, companyId } }),
    prisma.product.findFirst({ where: { id: data.productId, companyId } }),
  ])

  if (!warehouse) throw new Error('Deposito nao encontrado')
  if (!product) throw new Error('Produto nao encontrado')
  if (data.quantity < 0) throw new Error('Quantidade invalida')

  const stock = await prisma.warehouseStock.upsert({
    where: {
      warehouseId_productId: {
        warehouseId: warehouse.id,
        productId: product.id,
      },
    },
    update: { quantity: data.quantity },
    create: {
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: data.quantity,
    },
  })

  await logAudit({
    action: 'UPDATE',
    entity: 'WAREHOUSE_STOCK',
    entityId: stock.id,
    details: `Estoque ${warehouse.code}/${product.sku} ajustado para ${data.quantity}`,
    companyId,
    userId: user.id,
  })

  revalidatePath('/filiais')
  return stock
}

export async function transferWarehouseStock(data: {
  fromWarehouseId: string
  toWarehouseId: string
  notes?: string
  items: Array<{ productId: string; quantity: number }>
}) {
  const user = await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()

  if (data.fromWarehouseId === data.toWarehouseId) {
    throw new Error('Origem e destino devem ser diferentes')
  }
  if (!data.items?.length) throw new Error('Adicione itens para transferir')

  const [fromWarehouse, toWarehouse] = await Promise.all([
    prisma.warehouse.findFirst({ where: { id: data.fromWarehouseId, companyId } }),
    prisma.warehouse.findFirst({ where: { id: data.toWarehouseId, companyId } }),
  ])

  if (!fromWarehouse || !toWarehouse) {
    throw new Error('Deposito de origem ou destino nao encontrado')
  }

  const productIds = [...new Set(data.items.map((item) => item.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, companyId },
    select: { id: true, name: true },
  })
  const productMap = new Map(products.map((p) => [p.id, p]))

  const code = `TR-${Date.now()}`

  const transfer = await prisma.$transaction(async (tx) => {
    const createdTransfer = await tx.warehouseTransfer.create({
      data: {
        code,
        fromWarehouseId: fromWarehouse.id,
        toWarehouseId: toWarehouse.id,
        notes: data.notes?.trim() || null,
        companyId,
      },
    })

    for (const item of data.items) {
      if (item.quantity <= 0) throw new Error('Quantidade de transferencia invalida')

      const product = productMap.get(item.productId)
      if (!product) throw new Error('Produto invalido na transferencia')

      const fromStock = await tx.warehouseStock.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: fromWarehouse.id,
            productId: item.productId,
          },
        },
        update: {},
        create: {
          warehouseId: fromWarehouse.id,
          productId: item.productId,
          quantity: 0,
        },
      })

      if (fromStock.quantity < item.quantity) {
        throw new Error(`Estoque insuficiente no deposito de origem para ${product.name}`)
      }

      await tx.warehouseStock.update({
        where: { id: fromStock.id },
        data: { quantity: fromStock.quantity - item.quantity },
      })

      await tx.warehouseStock.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: toWarehouse.id,
            productId: item.productId,
          },
        },
        update: {
          quantity: { increment: item.quantity },
        },
        create: {
          warehouseId: toWarehouse.id,
          productId: item.productId,
          quantity: item.quantity,
        },
      })

      await tx.warehouseTransferItem.create({
        data: {
          transferId: createdTransfer.id,
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
        },
      })
    }

    return tx.warehouseTransfer.findUnique({
      where: { id: createdTransfer.id },
      include: {
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        items: true,
      },
    })
  })

  revalidatePath('/filiais')
  await logAudit({
    action: 'CREATE',
    entity: 'WAREHOUSE_TRANSFER',
    entityId: transfer?.id,
    details: `Transferencia ${code} concluida`,
    companyId,
    userId: user.id,
  })

  return transfer
}

export async function getWarehouseTransfers(limit = 100) {
  const companyId = await getCompanyId()
  return prisma.warehouseTransfer.findMany({
    where: { companyId },
    include: {
      fromWarehouse: { select: { id: true, name: true, code: true } },
      toWarehouse: { select: { id: true, name: true, code: true } },
      items: true,
    },
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, Math.min(limit, 500)),
  })
}

export async function createBatch(data: {
  productId: string
  code: string
  quantity: number
  expiresAt: string
  notes?: string
}) {
  const user = await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()

  if (data.quantity <= 0) throw new Error('Quantidade do lote invalida')
  const expiry = new Date(data.expiresAt)
  if (Number.isNaN(expiry.getTime())) throw new Error('Data de validade invalida')

  const product = await prisma.product.findFirst({
    where: { id: data.productId, companyId },
    select: { id: true, name: true, sku: true },
  })

  if (!product) throw new Error('Produto nao encontrado')

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.batch.create({
      data: {
        productId: product.id,
        code: data.code.trim(),
        quantity: data.quantity,
        expiresAt: expiry,
        notes: data.notes?.trim() || null,
        companyId,
      },
    })

    const current = await tx.product.findUnique({
      where: { id: product.id },
      select: { stockQty: true, minStock: true },
    })

    if (!current) throw new Error('Produto nao encontrado ao atualizar estoque')

    const newStock = current.stockQty + data.quantity
    const status =
      newStock <= 0
        ? 'Esgotado'
        : newStock <= current.minStock * 0.5
          ? 'Crítico'
          : newStock <= current.minStock
            ? 'Baixo'
            : 'Normal'

    await tx.product.update({
      where: { id: product.id },
      data: { stockQty: newStock, status },
    })

    await tx.movement.create({
      data: {
        type: 'ENTRADA',
        quantity: data.quantity,
        reason: `Entrada por lote ${data.code.trim()}`,
        productId: product.id,
        companyId,
      },
    })

    return created
  })

  revalidatePath('/lotes')
  revalidatePath('/estoque')
  revalidatePath('/movimentacoes')

  await logAudit({
    action: 'CREATE',
    entity: 'BATCH',
    entityId: batch.id,
    details: `Lote ${batch.code} criado para ${product.sku}`,
    companyId,
    userId: user.id,
  })

  return batch
}

export async function getBatches(params?: { expiresInDays?: number; limit?: number }) {
  const companyId = await getCompanyId()
  const limit = Math.max(1, Math.min(params?.limit ?? 200, 1000))

  const where: Prisma.BatchWhereInput = { companyId }
  if (params?.expiresInDays && params.expiresInDays > 0) {
    const until = new Date()
    until.setDate(until.getDate() + params.expiresInDays)
    where.expiresAt = { lte: until }
  }

  return prisma.batch.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
    orderBy: { expiresAt: 'asc' },
    take: limit,
  })
}

export async function getAuditLogs(limit = 200) {
  await requireRole(['ADMIN', 'MANAGER', 'OPERATOR'])
  const companyId = await getCompanyId()

  return prisma.auditLog.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, Math.min(limit, 1000)),
  })
}

export async function getDashboardReport() {
  const companyId = await getCompanyId()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const next30Days = new Date()
  next30Days.setDate(next30Days.getDate() + 30)

  const [
    productsCount,
    lowStockCount,
    outOfStockCount,
    salesToday,
    salesMonth,
    pendingPurchaseOrders,
    expiringBatches,
  ] = await Promise.all([
    prisma.product.count({ where: { companyId } }),
    prisma.product.count({ where: { companyId, status: { in: ['Crítico', 'Baixo'] } } }),
    prisma.product.count({ where: { companyId, status: 'Esgotado' } }),
    prisma.sale.aggregate({
      _sum: { total: true },
      where: { companyId, createdAt: { gte: today } },
    }),
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        companyId,
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), 1),
        },
      },
    }),
    prisma.purchaseOrder.count({ where: { companyId, status: 'PENDENTE' } }),
    prisma.batch.count({
      where: {
        companyId,
        expiresAt: { gte: today, lte: next30Days },
      },
    }),
  ])

  // Calculate estimated cost of goods sold for the month using current product purchaseCost
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const saleItems = await prisma.saleItem.findMany({
    where: { sale: { companyId, createdAt: { gte: firstOfMonth } } },
    include: { product: { select: { purchaseCost: true } } },
  })

  const goodsCostMonth = saleItems.reduce((acc, item) => {
    const cost = item.product?.purchaseCost ?? 0
    return acc + cost * item.quantity
  }, 0)

  const salesMonthValue = Number((salesMonth._sum.total ?? 0).toFixed(2))
  const salesTodayValue = Number((salesToday._sum.total ?? 0).toFixed(2))
  const grossProfitMonth = Number((salesMonthValue - goodsCostMonth).toFixed(2))
  const grossMarginMonth = salesMonthValue ? Number(((grossProfitMonth / salesMonthValue) * 100).toFixed(2)) : 0

  return {
    productsCount,
    lowStockCount,
    outOfStockCount,
    pendingPurchaseOrders,
    expiringBatches,
    salesToday: salesTodayValue,
    salesMonth: salesMonthValue,
    goodsCostMonth: Number(goodsCostMonth.toFixed(2)),
    grossProfitMonth,
    grossMarginMonth,
  }
}

export async function testNotificationWebhook() {
  const companyId = await getCompanyId()
  await sendExternalAlertIfConfigured(companyId, {
    level: 'info',
    title: 'Teste de webhook',
    message: 'Este e um teste de notificacao externa do StokaNet.',
  })

  return { ok: true }
}
