import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const { productId } = body

  if (!productId) {
    return new Response(JSON.stringify({ error: 'productId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  try {
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })
    }

    const movementCount = await prisma.movement.count({ where: { productId } })
    if (movementCount) {
      return new Response(JSON.stringify({ error: 'linked' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })
    }

    await prisma.product.delete({ where: { id: productId } })
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (error) {
    console.error('[test:delete-product] error', error)
    return new Response(JSON.stringify({ error: 'internal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }
}