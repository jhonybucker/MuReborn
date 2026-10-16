import { SERVER } from '@/lib/server-info'

// Rotas descritas em docs/api-login-personagens.md (implementadas na API da VPS).

export type Character = {
  name: string
  class: number
  level: number
  resets: number
  master: boolean
  online: boolean
  strength: number
  agility: number
  vitality: number
  energy: number
  command: number
  points: number
  zen: number
  map: number
  x: number
  y: number
}

export type Session = { token: string; login: string }

export class AccountApiError extends Error {
  constructor(
    public kind: 'credentials' | 'expired' | 'rate-limit' | 'network' | 'server',
    message: string,
  ) {
    super(message)
  }
}

const TOKEN_KEY = 'mu-reborn-session'

// sessionStorage: a sessão some ao fechar o navegador. Pode falhar em aba anônima, então tudo em try/catch.
export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* sem storage: a sessão vale só enquanto a página estiver aberta */
  }
}

async function request(path: string, init: RequestInit = {}) {
  let res: Response
  try {
    res = await fetch(SERVER.apiBase + path, { ...init, signal: AbortSignal.timeout(10000) })
  } catch {
    throw new AccountApiError('network', 'Não foi possível conectar ao servidor. Tente novamente mais tarde.')
  }
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
  if (res.status === 429) throw new AccountApiError('rate-limit', 'Muitas tentativas. Aguarde alguns minutos.')
  if (!res.ok || !body?.ok) {
    throw new AccountApiError('server', body?.error ?? 'Erro no servidor. Tente novamente mais tarde.')
  }
  return body as Record<string, unknown>
}

export async function login(user: string, password: string): Promise<Session> {
  try {
    const body = await request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: user, password }),
    })
    return { token: String(body.token), login: String(body.login ?? user) }
  } catch (err) {
    // A rota responde 401 para login ou senha errados; não diferenciamos para não revelar se a conta existe.
    if (err instanceof AccountApiError && err.kind === 'server' && err.message === 'invalid_credentials') {
      throw new AccountApiError('credentials', 'Login ou senha incorretos.')
    }
    throw err
  }
}

export async function fetchCharacters(session: Session): Promise<Character[]> {
  try {
    const body = await request('/me/characters', { headers: { Authorization: `Bearer ${session.token}` } })
    return (body.characters as Character[]) ?? []
  } catch (err) {
    if (err instanceof AccountApiError && err.kind === 'server' && err.message === 'unauthorized') {
      throw new AccountApiError('expired', 'Sua sessão expirou. Entre novamente.')
    }
    throw err
  }
}

export async function logout(session: Session) {
  // Melhor esforço: mesmo se a API falhar, a sessão local é descartada.
  await request('/logout', { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } }).catch(() => {})
}
