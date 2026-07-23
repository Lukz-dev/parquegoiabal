'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getApprovalAdminUser } from '@/lib/access'

export async function getAdminUsers() {
  await getApprovalAdminUser()

  return prisma.user.findMany({
    orderBy: [
      { isSystemAdmin: 'desc' },
      { isApproved: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      company: true,
    },
  })
}

export async function setUserApproval(userId: string, isApproved: boolean) {
  await getApprovalAdminUser()

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isSystemAdmin: true },
  })

  if (!targetUser) {
    throw new Error('Conta não encontrada')
  }

  if (targetUser.isSystemAdmin) {
    throw new Error('Não é possível alterar o acesso do administrador do sistema')
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isApproved },
  })

  revalidatePath('/admin')
}

export async function updateUserSubscription(
  userId: string,
  data: {
    status?: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
    planType?: 'MONTHLY' | 'ANNUAL'
    billingMode?: 'ONE_TIME' | 'RECURRING'
    amount?: number
    autoRenew?: boolean
  }
) {
  await getApprovalAdminUser()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  })

  if (!user?.companyId) {
    throw new Error('Usuário ou empresa não encontrada')
  }

  const subscription = await prisma.subscription.findUnique({
    where: { companyId: user.companyId },
  })

  if (!subscription) {
    throw new Error('Assinatura não encontrada para este usuário')
  }

  // If planType changed but amount not provided, apply default amounts
  if (data.planType && data.amount === undefined) {
    data.amount = data.planType === 'ANNUAL' ? 1020 : 100
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data,
  })

  revalidatePath('/admin')
}

export async function createUserSubscription(
  userId: string,
  data: {
    planType: 'MONTHLY' | 'ANNUAL'
    billingMode: 'ONE_TIME' | 'RECURRING'
    amount?: number
    autoRenew?: boolean
  }
) {
  await getApprovalAdminUser()

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } })

  if (!user?.companyId) {
    throw new Error('Usuário ou empresa não encontrada')
  }

  const existing = await prisma.subscription.findUnique({ where: { companyId: user.companyId } })
  if (existing) {
    throw new Error('Assinatura já existe para esta empresa')
  }

  const amount = data.amount ?? (data.planType === 'MONTHLY' ? 100 : 1020)

  await prisma.subscription.create({
    data: {
      companyId: user.companyId,
      planType: data.planType,
      billingMode: data.billingMode,
      status: 'ACTIVE',
      amount,
      autoRenew: !!data.autoRenew,
    },
  })

  revalidatePath('/admin')
}

export async function setUserActivePlan(userId: string, planType: 'MONTHLY' | 'ANNUAL' | null) {
  await getApprovalAdminUser()

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isSystemAdmin: true } })
  if (!target) throw new Error('Usuário não encontrado')
  if (target.isSystemAdmin) throw new Error('Não é possível alterar o plano do administrador do sistema')

  await prisma.user.update({ where: { id: userId }, data: { activePlan: planType } })
  revalidatePath('/admin')
}