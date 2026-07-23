import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getActiveUser, isBossRole } from '@/lib/access'

type Params = { userId: string }

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const activeUser = await getActiveUser()
    if (!isBossRole(activeUser.role)) {
      return NextResponse.json({ error: 'Você não tem permissão para editar funcionários.' }, { status: 403 })
    }

    if (!activeUser.companyId) {
      return NextResponse.json({ error: 'Empresa não vinculada.' }, { status: 400 })
    }

    const { userId } = await params
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    const targetUser = await prisma.user.findFirst({
      where: { id: userId, companyId: activeUser.companyId },
      select: { id: true, isSystemAdmin: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 })
    }

    if (targetUser.isSystemAdmin) {
      return NextResponse.json({ error: 'Não é possível editar este usuário.' }, { status: 400 })
    }

    if (!name || !email) {
      return NextResponse.json({ error: 'Nome e e-mail são obrigatórios.' }, { status: 400 })
    }

    const duplicate = await prisma.user.findFirst({
      where: {
        email,
        NOT: { id: userId },
      },
      select: { id: true },
    })

    if (duplicate) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name, email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ success: true, employee: updated })
  } catch (error) {
    console.error('[CHEFE EMPLOYEE PATCH ERROR]', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
    }

    return NextResponse.json({ error: 'Erro ao editar funcionário.' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const activeUser = await getActiveUser()
    if (!isBossRole(activeUser.role)) {
      return NextResponse.json({ error: 'Você não tem permissão para excluir funcionários.' }, { status: 403 })
    }

    if (!activeUser.companyId) {
      return NextResponse.json({ error: 'Empresa não vinculada.' }, { status: 400 })
    }

    const { userId } = await params

    if (userId === activeUser.id) {
      return NextResponse.json({ error: 'Você não pode excluir sua própria conta.' }, { status: 400 })
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: userId, companyId: activeUser.companyId },
      select: { id: true, isSystemAdmin: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 })
    }

    if (targetUser.isSystemAdmin) {
      return NextResponse.json({ error: 'Não é possível excluir este usuário.' }, { status: 400 })
    }

    await prisma.user.delete({ where: { id: userId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CHEFE EMPLOYEE DELETE ERROR]', error)
    return NextResponse.json({ error: 'Erro ao excluir funcionário.' }, { status: 500 })
  }
}