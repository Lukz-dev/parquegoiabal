import { NextResponse } from 'next/server'
import { issueNfeForSale } from '@/lib/nfe/issueFocusNfe'
import { NfeIntegrationError } from '@/lib/nfe/types'

type RouteContext = { params: Promise<{ saleId: string }> }

export async function POST(_: Request, context: RouteContext) {
  try {
    const { saleId } = await context.params
    const nfe = await issueNfeForSale(saleId)

    if (nfe.status === 'REJEITADO') {
      return NextResponse.json(
        {
          error: {
            type: 'NFE_REJECTED',
            message: nfe.sefazMessage ?? 'NF-e rejeitada.',
            sefazCode: nfe.sefazCode,
            details: nfe.raw ?? null,
          },
          nfe,
        },
        { status: 422 },
      )
    }

    if (nfe.status !== 'AUTORIZADO') {
      return NextResponse.json({ nfe }, { status: 202 })
    }

    return NextResponse.json({ nfe }, { status: 200 })
  } catch (error) {
    if (error instanceof NfeIntegrationError) {
      return NextResponse.json(
        {
          error: {
            type: error.code,
            message: error.message,
            details: error.details ?? null,
          },
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        error: {
          type: 'UNEXPECTED',
          message: error instanceof Error ? error.message : 'Erro inesperado.',
        },
      },
      { status: 500 },
    )
  }
}