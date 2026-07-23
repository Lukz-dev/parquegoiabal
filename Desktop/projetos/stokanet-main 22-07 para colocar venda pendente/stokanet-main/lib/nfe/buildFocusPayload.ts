import { NfeIntegrationError } from '@/lib/nfe/types'

type AddressInput = {
  street?: string | null
  number?: string | null
  district?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

type CompanyFiscalInput = {
  name: string
  cnpj?: string | null
  ie?: string | null
  address?: AddressInput
}

type CustomerFiscalInput = {
  name: string
  cpfCnpj?: string | null
  address?: AddressInput
}

type SaleItemInput = {
  productId: string
  description: string
  sku: string
  ncm?: string | null
  cfop?: string | null
  quantity: number
  unitPrice: number
  total: number
  taxProfile?: Record<string, unknown> | null
}

type BuildPayloadInput = {
  reference: string
  environment: 'HOMOLOGACAO' | 'PRODUCAO'
  model: 'NFE_55' | 'NFCE_65'
  taxRegime?: 'SIMPLES_NACIONAL' | 'SIMPLES_EXCESSO_SUBLIMITE' | 'REGIME_NORMAL'
  series: string
  number: number
  defaultCfop?: string | null
  naturezaOperacao?: string | null
  defaultTaxProfile?: Record<string, unknown> | null
  company: CompanyFiscalInput
  customer?: CustomerFiscalInput | null
  items: SaleItemInput[]
  paymentMethod?: string | null
  notes?: string | null
}

function requireField<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    throw new NfeIntegrationError(`Campo fiscal obrigatório ausente: ${label}`, {
      code: 'NFE_MISSING_FIELD',
      details: { field: label },
    })
  }
  return value
}

function digitsOnly(value: string) {
  return value.replace(/\D+/g, '')
}

export function buildFocusNfePayload(input: BuildPayloadInput) {
  const companyCnpj = digitsOnly(requireField(input.company.cnpj, 'company.cnpj'))
  const crt = input.taxRegime === 'REGIME_NORMAL' ? '3' : input.taxRegime === 'SIMPLES_EXCESSO_SUBLIMITE' ? '2' : '1'

  const companyAddress = input.company.address ?? {}
  const emitente = {
    cnpj: companyCnpj,
    inscricao_estadual: digitsOnly(input.company.ie ?? ''),
    regime_tributario: crt,
    nome: input.company.name,
    logradouro: requireField(companyAddress.street, 'company.address.street'),
    numero: requireField(companyAddress.number, 'company.address.number'),
    bairro: requireField(companyAddress.district, 'company.address.district'),
    municipio: requireField(companyAddress.city, 'company.address.city'),
    uf: requireField(companyAddress.state, 'company.address.state'),
    cep: digitsOnly(requireField(companyAddress.zip, 'company.address.zip')),
  }

  const destinatario = input.customer
    ? {
        nome: input.customer.name,
        cpf_cnpj: digitsOnly(requireField(input.customer.cpfCnpj, 'customer.cpfCnpj')),
      }
    : null

  const itens = input.items.map((item, index) => {
    const ncm = requireField(item.ncm, `item(${item.sku}).ncm`)
    const cfop = requireField(item.cfop ?? input.defaultCfop ?? process.env.DEFAULT_NFE_CFOP, `item(${item.sku}).cfop`)

    return {
      numero_item: index + 1,
      codigo_produto: item.sku,
      descricao: item.description,
      ncm,
      cfop,
      unidade_comercial: 'UN',
      quantidade_comercial: item.quantity,
      valor_unitario_comercial: item.unitPrice,
      valor_total: item.total,
      impostos: item.taxProfile ?? input.defaultTaxProfile ?? undefined,
    }
  })

  return {
    referencia: input.reference,
    ambiente: input.environment === 'PRODUCAO' ? 'producao' : 'homologacao',
    modelo: input.model === 'NFCE_65' ? '65' : '55',
    serie: input.series,
    numero: input.number,
    natureza_operacao: input.naturezaOperacao?.trim() || 'Venda',
    emitente,
    destinatario: destinatario ?? undefined,
    forma_pagamento: input.paymentMethod ?? undefined,
    observacoes: input.notes ?? undefined,
    itens,
  }
}
