import prisma from '@/lib/prisma'

export async function getLatestProductCosts(companyId: string, productIds: string[]) {
  const uniqueProductIds = [...new Set(productIds.filter(Boolean))]
  if (uniqueProductIds.length === 0) {
    return new Map<string, number>()
  }

  const purchaseItems = await prisma.purchaseOrderItem.findMany({
    where: {
      productId: { in: uniqueProductIds },
      purchaseOrder: {
        companyId,
        status: 'RECEBIDO',
      },
    },
    select: {
      productId: true,
      unitCost: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const costs = new Map<string, number>()
  for (const item of purchaseItems) {
    if (!costs.has(item.productId)) {
      costs.set(item.productId, Number(item.unitCost.toFixed(2)))
    }
  }

  return costs
}
