export type NfeStatus = 'PENDENTE' | 'PROCESSANDO' | 'AUTORIZADO' | 'REJEITADO' | 'ERRO'

export type NfeAuthorizationResult = {
  status: NfeStatus
  accessKey?: string | null
  protocol?: string | null
  danfeUrl?: string | null
  sefazCode?: string | null
  sefazMessage?: string | null
  raw?: unknown
}

export class NfeIntegrationError extends Error {
  readonly code: string
  readonly details?: unknown

  constructor(message: string, options: { code: string; details?: unknown }) {
    super(message)
    this.name = 'NfeIntegrationError'
    this.code = options.code
    this.details = options.details
  }
}
