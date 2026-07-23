import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveUser, isBossRole } from '@/lib/access'
import { revalidatePath } from 'next/cache'

export async function POST(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const activeUser = await getActiveUser()
    if (!isBossRole(activeUser.role)) {
      return NextResponse.json({ error: 'Você não tem permissão para executar esta ação.' }, { status: 403 })
    }

    if (!activeUser.companyId) {
      return NextResponse.json({ error: 'Empresa não vinculada.' }, { status: 400 })
    }

    const { userId } = await params
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, companyId: activeUser.companyId },
      select: { id: true, isSystemAdmin: true, isApproved: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 })
    }

    if (targetUser.isSystemAdmin) {
      return NextResponse.json({ error: 'Não é possível alterar o acesso deste usuário.' }, { status: 400 })
    }

    const nextApproved = !targetUser.isApproved
    await prisma.user.update({ where: { id: userId }, data: { isApproved: nextApproved } })

    revalidatePath('/chefe')

    return NextResponse.json({ success: true, isApproved: nextApproved })
  } catch (error) {
    console.error('[CHEFE APPROVAL ERROR]', error)
    return NextResponse.json({ error: 'Erro ao alterar acesso.' }, { status: 500 })
  }
}
