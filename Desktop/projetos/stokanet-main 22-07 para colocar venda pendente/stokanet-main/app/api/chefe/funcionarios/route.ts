import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getActiveUser, isBossRole } from '@/lib/access'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'

function generateTemporaryPassword() {
  return randomBytes(6).toString('base64url')
}

export async function GET() {
  try {
    const activeUser = await getActiveUser()
    if (!isBossRole(activeUser.role)) {
      return NextResponse.json({ error: 'Você não tem permissão para acessar esta área.' }, { status: 403 })
    }

    if (!activeUser.companyId) {
      return NextResponse.json({ error: 'Empresa não vinculada.' }, { status: 400 })
    }

    const employees = await prisma.user.findMany({
      where: {
        companyId: activeUser.companyId,
        isSystemAdmin: false,
      },
      orderBy: [{ isApproved: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ employees })
  } catch (error) {
    console.error('[CHEFE EMPLOYEE GET ERROR]', error)
    return NextResponse.json({ error: 'Erro ao carregar funcionários.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const activeUser = await getActiveUser()
    if (!isBossRole(activeUser.role)) {
      return NextResponse.json({ error: 'Você não tem permissão para criar funcionários.' }, { status: 403 })
    }

    if (!activeUser.companyId) {
      return NextResponse.json({ error: 'Empresa não vinculada.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '').trim() || generateTemporaryPassword()

    if (!name || !email) {
      return NextResponse.json({ error: 'Nome e e-mail são obrigatórios.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const employee = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'OPERATOR',
        isApproved: true,
        isSystemAdmin: false,
        companyId: activeUser.companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        createdAt: true,
      },
    })

    revalidatePath('/chefe')

    return NextResponse.json({ success: true, employee, tempPassword: password })
  } catch (error) {
    console.error('[CHEFE EMPLOYEE POST ERROR]', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
    }

    return NextResponse.json({ error: 'Erro ao criar funcionário.' }, { status: 500 })
  }
}
