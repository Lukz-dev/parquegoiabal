import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActiveCompanyId } from '@/lib/access'

const csvEscape = (value: string | number | null | undefined) => {
  const normalized = String(value ?? '')
  return `"${normalized.replace(/"/g, '""')}"`
}

export async function GET() {
  const companyId = await getActiveCompanyId()

  const suppliers = await prisma.supplier.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  })

  const headers = ['id', 'nome', 'contato', 'email', 'telefone', 'observacoes', 'criado_em']
  const lines = [headers.map(csvEscape).join(',')]

  for (const supplier of suppliers) {
    lines.push([
      supplier.id,
      supplier.name,
      supplier.contactName ?? '',
      supplier.email ?? '',
      supplier.phone ?? '',
      supplier.notes ?? '',
      supplier.createdAt.toISOString(),
    ].map(csvEscape).join(','))
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="fornecedores-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
