import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { getActiveUser, isBossRole } from '@/lib/access'

function generateTemporaryPassword() {
  return randomBytes(6).toString('base64url')
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const activeUser = await getActiveUser()
    if (!isBossRole(activeUser.role)) {
      return NextResponse.json({ error: 'Você não tem permissão para redefinir senhas.' }, { status: 403 })
    }

    if (!activeUser.companyId) {
      return NextResponse.json({ error: 'Empresa não vinculada.' }, { status: 400 })
    }

    const { userId } = await params

    const targetUser = await prisma.user.findFirst({
      where: { id: userId, companyId: activeUser.companyId },
      select: { id: true, email: true, isSystemAdmin: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 })
    }

    if (targetUser.isSystemAdmin) {
      return NextResponse.json({ error: 'Não é possível redefinir a senha deste usuário.' }, { status: 400 })
    }

    const tempPassword = generateTemporaryPassword()
    const hashedPassword = await bcrypt.hash(tempPassword, 12)

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ success: true, tempPassword, email: targetUser.email })
  } catch (error) {
    console.error('[CHEFE RESET PASSWORD ERROR]', error)
    return NextResponse.json({ error: 'Erro ao redefinir a senha.' }, { status: 500 })
  }
}
