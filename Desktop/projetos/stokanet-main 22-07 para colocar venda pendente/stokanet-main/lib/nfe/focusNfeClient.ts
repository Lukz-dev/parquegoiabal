import { NfeIntegrationError } from '@/lib/nfe/types'

type FocusNfeClientConfig = {
  baseUrl: string
  token: string
  timeoutMs: number
  issuePath: string
  getPathTemplate: string
}

type FocusNfeIssueResponse = {
  status?: string
  mensagem?: string
  mensagem_sefaz?: string
  codigo_sefaz?: string
  chave_nfe?: string
  protocolo?: string
  url_danfe?: string
  caminho_danfe?: string
  [key: string]: unknown
}

function getEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new NfeIntegrationError(`Variável de ambiente ausente: ${name}`, { code: 'ENV_MISSING' })
  }
  return value
}

function normalizeBaseUrl(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

export function getFocusNfeClientConfig(): FocusNfeClientConfig {
  const baseUrl = normalizeBaseUrl(process.env.FOCUS_NFE_BASE_URL?.trim() || 'https://api.focusnfe.com.br')
  const token = getEnv('FOCUS_NFE_TOKEN').trim()
  const timeoutMs = Number(process.env.FOCUS_NFE_TIMEOUT_MS ?? 15000)
  const issuePath = process.env.FOCUS_NFE_ISSUE_PATH?.trim() || '/v2/nfe'
  const getPathTemplate = process.env.FOCUS_NFE_GET_PATH_TEMPLATE?.trim() || '/v2/nfe/{ref}'
  return {
    baseUrl,
    token,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 15000,
    issuePath,
    getPathTemplate,
  }
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const text = await response.text()
    const json = text ? (JSON.parse(text) as unknown) : null

    if (!response.ok) {
      throw new NfeIntegrationError('Falha na API de NF-e.', {
        code: 'FOCUS_HTTP_ERROR',
        details: { status: response.status, body: json },
      })
    }

    return json
  } catch (error) {
    if (error instanceof NfeIntegrationError) throw error

    throw new NfeIntegrationError('Não foi possível comunicar com a API de NF-e.', {
      code: 'FOCUS_NETWORK_ERROR',
      details: { cause: error instanceof Error ? error.message : String(error) },
    })
  } finally {
    clearTimeout(timeout)
  }
}

function buildAuthHeader(token: string) {
  const explicit = process.env.FOCUS_NFE_AUTH_HEADER?.trim()
  if (explicit) return explicit

  // Padrão comum em APIs do tipo “Token <token>”.
  // Se a Focus exigir outro formato, defina FOCUS_NFE_AUTH_HEADER.
  return `Token ${token}`
}

export class FocusNfeClient {
  private readonly config: FocusNfeClientConfig

  constructor(config: FocusNfeClientConfig) {
    this.config = config
  }

  async issueNfe(reference: string, payload: unknown): Promise<FocusNfeIssueResponse> {
    const url = `${this.config.baseUrl}${this.config.issuePath}?ref=${encodeURIComponent(reference)}`

    return fetchJson(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: buildAuthHeader(this.config.token),
        },
        body: JSON.stringify(payload),
      },
      this.config.timeoutMs,
    ) as Promise<FocusNfeIssueResponse>
  }

  async getNfe(reference: string): Promise<FocusNfeIssueResponse> {
    const path = this.config.getPathTemplate.replace('{ref}', encodeURIComponent(reference))
    const url = `${this.config.baseUrl}${path}`

    return fetchJson(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: buildAuthHeader(this.config.token),
        },
      },
      this.config.timeoutMs,
    ) as Promise<FocusNfeIssueResponse>
  }
}
