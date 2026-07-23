import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET() {
  const session = await getServerSession(authOptions)
  const sessionUser = session?.user as { id?: string; authExpiresAt?: number | null } | undefined
  const userId = sessionUser?.id && (!sessionUser.authExpiresAt || Date.now() <= sessionUser.authExpiresAt) ? sessionUser.id : undefined

  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  })

  return NextResponse.json({ avatarUrl: user?.avatarUrl ?? null })
}
