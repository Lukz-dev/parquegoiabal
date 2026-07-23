import { getServerSession } from 'next-auth'
import type { Company, User } from '@prisma/client'
import prisma from '@/lib/prisma'
import { isBossRole } from '@/lib/roles'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export type AppRole = 'ADMIN' | 'MANAGER' | 'OPERATOR'
export { isBossRole } from '@/lib/roles'

type SessionUser = {
  id?: string
  companyId?: string
  role?: AppRole
  isApproved?: boolean
  isSystemAdmin?: boolean
  authExpiresAt?: number | null
}

type UserWithCompany = User & { company: Company | null }

async function getSessionUser(options?: { allowPending?: boolean; requireSystemAdmin?: boolean }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as SessionUser | undefined

  if (!user?.id) {
    throw new Error('Não autorizado')
  }

  if (typeof user.authExpiresAt === 'number' && Date.now() > user.authExpiresAt) {
    throw new Error('Sessão expirada')
  }

  if (options?.requireSystemAdmin && !user.isSystemAdmin) {
    throw new Error('Acesso restrito ao administrador do sistema')
  }

  if (!options?.allowPending && !user.isApproved && !user.isSystemAdmin) {
    throw new Error('Conta pendente de aprovação')
  }

  return user
}

async function getAdminPanelUser() {
  const sessionUser = await getSessionUser({ allowPending: true })

  if (!sessionUser.isSystemAdmin && sessionUser.role !== 'ADMIN') {
    throw new Error('Acesso restrito ao administrador')
  }

  return sessionUser
}

export async function getSystemAdminUser() {
  return getSessionUser({ allowPending: true, requireSystemAdmin: true })
}

export async function getApprovalAdminUser() {
  return getAdminPanelUser()
}

export async function getOrCreateDefaultCompany() {
  const sessionUser = await getSessionUser()

  const company = await prisma.company.findUnique({
    where: { id: sessionUser.companyId },
  })

  if (!company) {
    throw new Error('Empresa não encontrada')
  }

  return company
}

export async function getActiveCompanyId() {
  const sessionUser = await getSessionUser()
  if (!sessionUser.companyId) {
    throw new Error('Empresa não vinculada')
  }

  return sessionUser.companyId
}

export async function getActiveUser(): Promise<UserWithCompany> {
  const sessionUser = await getSessionUser()

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: { company: true },
  })

  if (!user) {
    throw new Error('Usuário não encontrado')
  }

  return user
}