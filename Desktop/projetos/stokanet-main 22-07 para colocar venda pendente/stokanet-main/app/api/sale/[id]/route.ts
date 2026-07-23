import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const companyId = await getActiveCompanyId()

    const sale = await prisma.sale.findFirst({
      where: { id, companyId },
      include: { items: { orderBy: { id: 'asc' } }, customer: true },
    })

    if (!sale) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })

    return NextResponse.json({ sale })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro' }, { status: 500 })
  }
}
