export const DOCUMENT_KINDS = {
  FISCAL: 'FISCAL',
  NON_FISCAL: 'NON_FISCAL',
} as const

export const DOCUMENT_MODELS = {
  NFE_55: 'NFE_55',
  NFCE_65: 'NFCE_65',
  NFSE: 'NFSE',
  ORCAMENTO: 'ORCAMENTO',
  PEDIDO_VENDA: 'PEDIDO_VENDA',
  RECIBO_PAGAMENTO: 'RECIBO_PAGAMENTO',
} as const

export const DOCUMENT_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_TRANSMISSION: 'PENDING_TRANSMISSION',
  PROCESSING: 'PROCESSING',
  AUTHORIZED: 'AUTHORIZED',
  REJECTED: 'REJECTED',
  PRINT_READY: 'PRINT_READY',
  CANCELLED: 'CANCELLED',
  VOIDED: 'VOIDED',
  ERROR: 'ERROR',
} as const

export const DOCUMENT_PROVIDERS = {
  FOCUS_NFE: 'FOCUS_NFE',
  TECNOSPEED: 'TECNOSPEED',
  ENOTAS: 'ENOTAS',
  INTERNAL: 'INTERNAL',
} as const

export const DOCUMENT_PRINT_FORMATS = {
  A4: 'A4',
  THERMAL_80MM: 'THERMAL_80MM',
} as const

export type DocumentKind = (typeof DOCUMENT_KINDS)[keyof typeof DOCUMENT_KINDS]
export type DocumentModel = (typeof DOCUMENT_MODELS)[keyof typeof DOCUMENT_MODELS]
export type DocumentStatus = (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS]
export type DocumentProvider = (typeof DOCUMENT_PROVIDERS)[keyof typeof DOCUMENT_PROVIDERS]
export type DocumentPrintFormat = (typeof DOCUMENT_PRINT_FORMATS)[keyof typeof DOCUMENT_PRINT_FORMATS]

const fiscalModels = new Set<DocumentModel>([
  DOCUMENT_MODELS.NFE_55,
  DOCUMENT_MODELS.NFCE_65,
  DOCUMENT_MODELS.NFSE,
])

const thermalModels = new Set<DocumentModel>([
  DOCUMENT_MODELS.NFCE_65,
  DOCUMENT_MODELS.ORCAMENTO,
  DOCUMENT_MODELS.PEDIDO_VENDA,
  DOCUMENT_MODELS.RECIBO_PAGAMENTO,
])

export function getDocumentKind(model: DocumentModel): DocumentKind {
  return fiscalModels.has(model) ? DOCUMENT_KINDS.FISCAL : DOCUMENT_KINDS.NON_FISCAL
}

export function getDefaultPrintFormat(model: DocumentModel): DocumentPrintFormat {
  return thermalModels.has(model) ? DOCUMENT_PRINT_FORMATS.THERMAL_80MM : DOCUMENT_PRINT_FORMATS.A4
}

export function isFiscalDocument(model: DocumentModel) {
  return fiscalModels.has(model)
}
