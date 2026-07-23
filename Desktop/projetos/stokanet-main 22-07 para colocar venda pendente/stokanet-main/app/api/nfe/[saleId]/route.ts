import { NextResponse } from 'next/server'
import { syncSaleNfe } from '@/lib/nfe/syncSaleNfe'
import { NfeIntegrationError } from '@/lib/nfe/types'

type RouteContext = { params: Promise<{ saleId: string }> }

export async function POST(_: Request, context: RouteContext) {
  try {
    const { saleId } = await context.params
    const result = await syncSaleNfe(saleId)

    if (result.nfe.status === 'REJEITADO') {
      return NextResponse.json(
        {
          error: {
            type: 'NFE_REJECTED',
            message: result.nfe.sefazMessage ?? 'NF-e rejeitada.',
            sefazCode: result.nfe.sefazCode,
            details: result.nfe.raw ?? null,
          },
          nfe: result.nfe,
        },
        { status: 422 },
      )
    }

    if (result.nfe.status !== 'AUTORIZADO') {
      return NextResponse.json({ nfe: result.nfe }, { status: 202 })
    }

    return NextResponse.json({ nfe: result.nfe }, { status: 200 })
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
