import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getActiveUser, getActiveCompanyId } from '@/lib/access'
import { isBossRole } from '@/lib/roles'

function assertCanManage(userRole?: string) {
  if (!isBossRole(userRole)) {
    throw new Error('Você não tem permissão para alterar configurações fiscais.')
  }
}

export async function GET() {
  const user = await getActiveUser()
  assertCanManage(user.role)
  const companyId = await getActiveCompanyId()

  const settings = await prisma.nfeSettings.findUnique({
    where: { companyId },
    select: {
      enabled: true,
      environment: true,
      model: true,
      series: true,
      nextNumber: true,
      defaultCfop: true,
      naturezaOperacao: true,
      taxRegime: true,
      defaultTaxProfile: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ settings })
}

export async function PUT(request: Request) {
  const user = await getActiveUser()
  assertCanManage(user.role)
  const companyId = await getActiveCompanyId()

  const body = (await request.json()) as Partial<{
    enabled: boolean
    environment: 'HOMOLOGACAO' | 'PRODUCAO'
    model: 'NFE_55' | 'NFCE_65'
    series: string
    nextNumber: number
    defaultCfop: string | null
    naturezaOperacao: string
    taxRegime: 'SIMPLES_NACIONAL' | 'SIMPLES_EXCESSO_SUBLIMITE' | 'REGIME_NORMAL'
    defaultTaxProfile: unknown | null
  }>

  const series = body.series?.trim()
  if (series !== undefined && !series) {
    return NextResponse.json({ error: 'Série inválida.' }, { status: 400 })
  }

  const nextNumber = body.nextNumber
  if (nextNumber !== undefined && (!Number.isInteger(nextNumber) || nextNumber < 1)) {
    return NextResponse.json({ error: 'nextNumber inválido (use inteiro >= 1).' }, { status: 400 })
  }

  const naturezaOperacao = body.naturezaOperacao?.trim()
  if (naturezaOperacao !== undefined && !naturezaOperacao) {
    return NextResponse.json({ error: 'Natureza da operação inválida.' }, { status: 400 })
  }

  const settings = await prisma.nfeSettings.upsert({
    where: { companyId },
    create: {
      companyId,
      enabled: body.enabled ?? false,
      environment: body.environment ?? 'HOMOLOGACAO',
      model: body.model ?? 'NFE_55',
      series: series ?? '1',
      nextNumber: nextNumber ?? 1,
      defaultCfop: body.defaultCfop?.trim() || null,
      naturezaOperacao: naturezaOperacao ?? 'Venda',
      taxRegime: body.taxRegime ?? 'SIMPLES_NACIONAL',
      defaultTaxProfile:
        body.defaultTaxProfile === undefined
          ? Prisma.DbNull
          : body.defaultTaxProfile === null
            ? Prisma.DbNull
            : (body.defaultTaxProfile as Prisma.InputJsonValue),
    },
    update: {
      enabled: body.enabled,
      environment: body.environment,
      model: body.model,
      series,
      nextNumber,
      defaultCfop: body.defaultCfop === undefined ? undefined : body.defaultCfop?.trim() || null,
      naturezaOperacao,
      taxRegime: body.taxRegime,
      defaultTaxProfile:
        body.defaultTaxProfile === undefined
          ? undefined
          : body.defaultTaxProfile === null
            ? Prisma.DbNull
            : (body.defaultTaxProfile as Prisma.InputJsonValue),
    },
    select: {
      enabled: true,
      environment: true,
      model: true,
      series: true,
      nextNumber: true,
      defaultCfop: true,
      naturezaOperacao: true,
      taxRegime: true,
      defaultTaxProfile: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ settings })
}
