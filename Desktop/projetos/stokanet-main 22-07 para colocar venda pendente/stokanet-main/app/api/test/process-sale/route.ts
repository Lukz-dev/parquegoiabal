import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const { companyId, items = [], paymentMethod, discount = 0, notes } = body

  if (!companyId) {
    return new Response(JSON.stringify({ error: 'companyId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ error: 'items required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  try {
    const productIds = [...new Set(items.map((i: any) => i.productId))]
    const products = await prisma.product.findMany({ where: { companyId, id: { in: productIds } } })

    let subtotal = 0
    for (const item of items) {
      const p = products.find((x) => x.id === item.productId)
      if (!p) {
        return new Response(JSON.stringify({ error: 'product_not_found', productId: item.productId }), {
          status: 422,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        })
      }
      if (p.stockQty < item.quantity) {
        return new Response(JSON.stringify({ error: 'insufficient_stock', productId: p.id }), {
          status: 422,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        })
      }
      subtotal += p.price * item.quantity
    }

    const boundedDiscount = Math.min(Number(discount) || 0, subtotal)
    const total = Math.max(0, subtotal - boundedDiscount)
    const sale = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({ data: { code: `TEST-${Date.now()}`, subtotal, discount: boundedDiscount, total, paymentMethod: paymentMethod || null, notes: notes || null, companyId } as any })

      // Create all SaleItems in a single batch operation
      await tx.saleItem.createMany({
        data: items.map((item: any) => {
          const product = products.find((x) => x.id === item.productId)
          if (!product) {
            throw new Error(`Produto não encontrado durante o processamento do teste: ${item.productId}`)
          }
          return {
            saleId: s.id,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            quantity: item.quantity,
            unitPrice: product.price,
            total: product.price * item.quantity,
          }
        }),
      })

      // Update all product stock quantities in batch
      for (const item of items) {
        const product = products.find((x) => x.id === item.productId)
        if (!product) {
          throw new Error(`Produto não encontrado durante o processamento do teste: ${item.productId}`)
        }
        await tx.product.update({
          where: { id: product.id },
          data: { stockQty: { decrement: item.quantity } } as any,
        })
      }

      // Create all movements in a single batch operation
      await tx.movement.createMany({
        data: items.map((item: any) => {
          const product = products.find((x) => x.id === item.productId)
          if (!product) {
            throw new Error(`Produto não encontrado durante o processamento do teste: ${item.productId}`)
          }
          return {
            type: 'SAIDA' as const,
            quantity: item.quantity,
            reason: `Teste venda ${s.code}`,
            productId: product.id,
            companyId,
          }
        }),
      })

      return s
    })

    return new Response(JSON.stringify({ sale }), {
      status: 201,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (error) {
    console.error('[test:process-sale] error', error)
    return new Response(JSON.stringify({ error: 'internal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }
}