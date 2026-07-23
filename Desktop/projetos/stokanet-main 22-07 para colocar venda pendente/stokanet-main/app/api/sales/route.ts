import { NextResponse } from 'next/server'
import { processSaleWithNfe } from '@/lib/sales/processSaleWithNfe'
import { NfeIntegrationError } from '@/lib/nfe/types'

// Increase timeout to 60 seconds to allow processing large sales with many items
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      items?: Array<{ productId: string; quantity: number }>
      paymentMethod?: string
      paymentBreakdown?: Array<{ method: string; amount: number }>
      discount?: number
      amountReceived?: number
      notes?: string
      details?: string
      isPending?: boolean
      customerId?: string | null
    }

    const result = await processSaleWithNfe({
      items: body.items ?? [],
      paymentMethod: body.paymentMethod,
      paymentBreakdown: body.paymentBreakdown,
      discount: body.discount,
      amountReceived: body.amountReceived,
      notes: body.notes,
      details: body.details,
      isPending: body.isPending,
      customerId: body.customerId ?? null,
    })

    if (result.sale.nfe.status === 'REJEITADO') {
      return NextResponse.json(
        {
          error: {
            type: 'NFE_REJECTED',
            message: result.sale.nfe.sefazMessage ?? 'NF-e rejeitada.',
            sefazCode: result.sale.nfe.sefazCode,
            details: result.sale.nfe.raw ?? null,
          },
          sale: result.sale,
        },
        { status: 422 },
      )
    }

    if (result.sale.nfe.status !== 'AUTORIZADO') {
      return NextResponse.json(
        {
          sale: result.sale,
          warning: {
            type: 'NFE_PROCESSING',
            message: 'NF-e em processamento. Consulte novamente mais tarde.',
          },
        },
        { status: 202 },
      )
    }

    return NextResponse.json({ sale: result.sale }, { status: 201 })
  } catch (error) {
    console.error('[api:/api/sales] Unexpected error', { error })

    if (error instanceof NfeIntegrationError) {
      return NextResponse.json(
        {
          error: {
            type: error.code,
            message: error.message,
            details: error.details ?? null,
          },
        },
        { status: error.code === 'ENV_MISSING' ? 500 : 400 },
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
