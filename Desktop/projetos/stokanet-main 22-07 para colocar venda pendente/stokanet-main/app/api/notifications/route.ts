import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'

type NotificationLevel = 'critical' | 'warning' | 'info'

type NotificationItem = {
  id: string
  level: NotificationLevel
  title: string
  description: string
  href: string
}

const SEVERITY_ORDER: Record<NotificationLevel, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

export async function GET() {
  const companyId = await getActiveCompanyId()

  const [products, pendingOrders, expiringBatches] = await Promise.all([
    prisma.product.findMany({
      where: { companyId },
      select: {
        stockQty: true,
        minStock: true,
        categoryId: true,
        movements: {
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.purchaseOrder.count({
      where: {
        companyId,
        status: 'PENDENTE',
        createdAt: {
          lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.batch.count({
      where: {
        companyId,
        expiresAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ])

  const notifications: NotificationItem[] = []
  const now = Date.now()
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

  if (products.length === 0) {
    notifications.push({
      id: 'no-products',
      level: 'info',
      title: 'Nenhum produto cadastrado',
      description: 'Cadastre os primeiros itens para iniciar o monitoramento de estoque.',
      href: '/estoque',
    })
  }

  const outOfStock = products.filter((product) => product.stockQty === 0)
  const criticalStock = products.filter((product) => product.stockQty > 0 && product.stockQty <= product.minStock * 0.5)
  const lowStock = products.filter((product) => product.stockQty > 0 && product.stockQty <= product.minStock && product.stockQty > product.minStock * 0.5)
  const uncategorized = products.filter((product) => !product.categoryId)
  const staleProducts = products.filter((product) => {
    const lastMovement = product.movements[0]?.createdAt
    if (!lastMovement) return product.stockQty > 0
    return now - new Date(lastMovement).getTime() > thirtyDaysMs && product.stockQty > 0
  })

  if (outOfStock.length > 0) {
    notifications.push({
      id: 'out-of-stock',
      level: 'critical',
      title: `${outOfStock.length} produto(s) esgotado(s)`,
      description: 'Há itens sem estoque. Reponha para evitar perda de vendas.',
      href: '/estoque',
    })
  }

  if (criticalStock.length > 0) {
    notifications.push({
      id: 'critical-stock',
      level: 'critical',
      title: `${criticalStock.length} produto(s) em nível crítico`,
      description: 'O estoque está muito próximo do fim e requer ação imediata.',
      href: '/estoque',
    })
  }

  if (lowStock.length > 0) {
    notifications.push({
      id: 'low-stock',
      level: 'warning',
      title: `${lowStock.length} produto(s) com estoque baixo`,
      description: 'Planeje a reposição para evitar ruptura nos próximos dias.',
      href: '/estoque',
    })
  }

  if (uncategorized.length > 0) {
    notifications.push({
      id: 'uncategorized-products',
      level: 'warning',
      title: `${uncategorized.length} produto(s) sem categoria`,
      description: 'Classifique os itens para melhorar filtros e análises.',
      href: '/estoque',
    })
  }

  if (staleProducts.length > 0) {
    notifications.push({
      id: 'stale-products',
      level: 'info',
      title: `${staleProducts.length} produto(s) sem movimentação recente`,
      description: 'Estes itens não tiveram movimentações nos últimos 30 dias.',
      href: '/movimentacoes',
    })
  }

  if (expiringBatches > 0) {
    notifications.push({
      id: 'expiring-batches',
      level: 'warning',
      title: `${expiringBatches} lote(s) vencendo em ate 15 dias`,
      description: 'Revise os lotes para priorizar giro e evitar perdas por validade.',
      href: '/lotes',
    })
  }

  if (pendingOrders > 0) {
    notifications.push({
      id: 'pending-purchase-orders',
      level: 'info',
      title: `${pendingOrders} pedido(s) de compra pendente(s) ha mais de 7 dias`,
      description: 'Acompanhe entregas em atraso para evitar ruptura de estoque.',
      href: '/compras',
    })
  }

  notifications.sort((a, b) => SEVERITY_ORDER[a.level] - SEVERITY_ORDER[b.level])

  const counts = {
    critical: notifications.filter((item) => item.level === 'critical').length,
    warning: notifications.filter((item) => item.level === 'warning').length,
    info: notifications.filter((item) => item.level === 'info').length,
    total: notifications.length,
  }

  return NextResponse.json({ notifications, counts })
}