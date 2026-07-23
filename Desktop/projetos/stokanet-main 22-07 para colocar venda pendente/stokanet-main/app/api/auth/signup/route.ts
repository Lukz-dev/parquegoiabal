import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const { companyName, name, email, password, role } = await req.json()

    if (!companyName || !name || !email || !password) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 })
    }

    // Verifica se email já existe
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const allowedRoles = new Set(['OPERATOR', 'MANAGER'])
    const requestedRole = typeof role === 'string' && allowedRoles.has(role) ? role : 'OPERATOR'

    // Keep company + user creation atomic to avoid orphan companies on failures.
    await prisma.$transaction(async (tx) => {
      // Bootstrap: if this is the first user ever, promote them so the system isn't locked
      // behind the approval gate in a fresh production database.
      const isFirstUser = (await tx.user.count()) === 0

      const company = await tx.company.create({
        data: { name: companyName },
      })

      await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: isFirstUser ? 'ADMIN' : requestedRole,
          isApproved: isFirstUser,
          isSystemAdmin: isFirstUser,
          companyId: company.id,
        },
      })
    })

    return NextResponse.json({ success: true, message: 'Cadastro criado com sucesso. Ele ficará aguardando liberação no painel admin.' }, { status: 201 })
  } catch (error) {
    console.error('[SIGNUP ERROR]', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
      }

      if (error.code === 'P2021') {
        return NextResponse.json({ error: 'Banco de dados não está sincronizado. Atualize o deploy e tente novamente.' }, { status: 500 })
      }
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ error: 'Falha de conexão com o banco de dados no ambiente de produção.' }, { status: 500 })
    }

    return NextResponse.json({ error: 'Erro interno ao criar conta.' }, { status: 500 })
  }
}
