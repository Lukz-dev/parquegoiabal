import { NextResponse } from 'next/server'
import { emitDocument } from '@/lib/documents/document-service'
import { DOCUMENT_MODELS } from '@/lib/documents/document-types'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      saleId?: string | null
      purchaseOrderId?: string | null
      model?: keyof typeof DOCUMENT_MODELS
      provider?: 'FOCUS_NFE' | 'TECNOSPEED' | 'ENOTAS' | 'INTERNAL'
      notes?: string | null
    }

    if (!body.model || !Object.prototype.hasOwnProperty.call(DOCUMENT_MODELS, body.model)) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Informe o modelo do documento.',
          },
        },
        { status: 400 },
      )
    }

    if (!body.saleId && !body.purchaseOrderId) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Informe saleId ou purchaseOrderId para emitir o documento.',
          },
        },
        { status: 400 },
      )
    }

    const result = await emitDocument({
      saleId: body.saleId ?? null,
      purchaseOrderId: body.purchaseOrderId ?? null,
      model: DOCUMENT_MODELS[body.model],
      provider: body.provider,
      notes: body.notes ?? null,
    })

    return NextResponse.json(
      {
        document: result.document,
        transmission: result.transmission,
        print: {
          printFormat: result.print.printFormat,
          htmlPreview: result.print.html,
        },
      },
      { status: result.transmission ? 202 : 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          type: 'UNEXPECTED',
          message: error instanceof Error ? error.message : 'Erro inesperado ao emitir documento.',
        },
      },
      { status: 500 },
    )
  }
}
