import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const { companyId, name = 'Test Product', sku = 'TEST-SKU', price = 10, stockQty = 10, minStock = 1 } = body

  if (!companyId) return new Response(JSON.stringify({ error: 'companyId required' }), { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

  const product = await prisma.product.create({
    data: {
      name,
      sku,
      price: Number(price),
      stockQty: Number(stockQty),
      minStock: Number(minStock),
      companyId,
    },
  })

  return new Response(JSON.stringify({ product }), {
    status: 201,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}