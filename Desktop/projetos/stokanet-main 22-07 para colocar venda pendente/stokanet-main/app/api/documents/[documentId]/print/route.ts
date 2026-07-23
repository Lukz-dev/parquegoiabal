import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'
import { buildDocumentPrintHtml } from '@/lib/documents/document-service'

export async function GET(_: Request, context: { params: Promise<{ documentId: string }> }) {
  const companyId = await getActiveCompanyId()
  const { documentId } = await context.params

  const document = await prisma.document.findFirst({
    where: { id: documentId, companyId },
    include: {
      company: true,
      customer: true,
      sale: {
        include: {
          customer: true,
          items: true,
        },
      },
      purchaseOrder: {
        include: {
          supplier: true,
          items: true,
        },
      },
      items: true,
    },
  })

  if (!document) {
    return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
  }

  const source = document.sale
    ? {
        sourceType: 'SALE' as const,
        code: document.sale.code,
        subtotal: document.sale.subtotal,
        discount: document.sale.discount,
        total: document.sale.total,
        companyId: document.companyId,
        customerId: document.sale.customerId,
        company: {
          name: document.company.name,
          legalName: document.company.legalName,
          cnpj: document.company.cnpj,
          ie: document.company.ie,
          fiscalAddress: document.company.fiscalAddress,
        },
        customer: document.sale.customer
          ? {
              name: document.sale.customer.name,
              cpfCnpj: document.sale.customer.cpfCnpj,
              email: document.sale.customer.email,
              phone: document.sale.customer.phone,
              address: document.sale.customer.address,
            }
          : null,
        supplier: null,
        items: document.items.map((item) => ({
          productId: item.productId,
          description: item.description,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          metadata: item.metadata as Record<string, unknown> | null,
        })),
        paymentMethod: document.sale.paymentMethod,
      }
    : {
        sourceType: 'PURCHASE_ORDER' as const,
        code: document.purchaseOrder?.code ?? document.code,
        subtotal: document.subtotal,
        discount: document.discount,
        total: document.total,
        companyId: document.companyId,
        customerId: document.customerId,
        company: {
          name: document.company.name,
          legalName: document.company.legalName,
          cnpj: document.company.cnpj,
          ie: document.company.ie,
          fiscalAddress: document.company.fiscalAddress,
        },
        customer: document.customer
          ? {
              name: document.customer.name,
              cpfCnpj: document.customer.cpfCnpj,
              email: document.customer.email,
              phone: document.customer.phone,
              address: document.customer.address,
            }
          : null,
        supplier: document.purchaseOrder?.supplier
          ? {
              name: document.purchaseOrder.supplier.name,
              email: document.purchaseOrder.supplier.email,
              phone: document.purchaseOrder.supplier.phone,
            }
          : null,
        items: document.items.map((item) => ({
          productId: item.productId,
          description: item.description,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          metadata: item.metadata as Record<string, unknown> | null,
        })),
      }

  const html = buildDocumentPrintHtml({
    document: {
      code: document.code,
      kind: document.kind,
      model: document.model,
      status: document.status,
      printFormat: document.printFormat,
      notes: document.notes,
      subtotal: document.subtotal,
      discount: document.discount,
      total: document.total,
      issuedAt: document.issuedAt,
    },
    source,
  })

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
