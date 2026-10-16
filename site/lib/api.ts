import { SERVER } from '@/lib/server-info'

// Cliente da API da VPS. Rotas e formatos: docs/api-site.md.

export type ApiErrorKind = 'network' | 'rate-limit' | 'not-found' | 'unauthorized' | 'server'

export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    /** Código curto devolvido pela API em `error` (ex.: invalid_credentials), quando houver. */
    public code: string | null,
    message: string,
  ) {
    super(message)
  }
}

const MESSAGES: Record<ApiErrorKind, string> = {
  network: 'Não foi possível conectar ao servidor. Tente novamente mais tarde.',
  'rate-limit': 'Muitas tentativas. Aguarde alguns minutos.',
  'not-found': 'Não encontrado.',
  unauthorized: 'Sua sessão expirou. Entre novamente.',
  server: 'Erro no servidor. Tente novamente mais tarde.',
}

/** Chama a API com tempo limite de 10s. Devolve o corpo quando `ok: true`, senão lança ApiError. */
export async function api<T = Record<string, unknown>>(
  path: string,
  { method = 'GET', token, body }: { method?: 'GET' | 'POST'; token?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(SERVER.apiBase + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    throw new ApiError('network', null, MESSAGES.network)
  }

  const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null
  if (res.ok && json?.ok) return json

  const code = json?.error ?? null
  const kind: ApiErrorKind =
    res.status === 429 ? 'rate-limit' : res.status === 404 ? 'not-found' : res.status === 401 ? 'unauthorized' : 'server'
  throw new ApiError(kind, code, MESSAGES[kind])
}
