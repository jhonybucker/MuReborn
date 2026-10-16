import { ApiError, api } from '@/lib/api'

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

export async function login(user: string, password: string): Promise<Session> {
  try {
    const body = await api<{ token: string; login?: string }>('/login', {
      method: 'POST',
      body: { login: user, password },
    })
    return { token: body.token, login: body.login ?? user }
  } catch (err) {
    // A API responde 401 tanto para login inexistente quanto para senha errada.
    if (err instanceof ApiError && err.kind === 'unauthorized') {
      throw new ApiError('unauthorized', err.code, 'Login ou senha incorretos.')
    }
    throw err
  }
}

export async function fetchCharacters(session: Session): Promise<Character[]> {
  const body = await api<{ characters?: Character[] }>('/me/characters', { token: session.token })
  return body.characters ?? []
}

export async function changePassword(session: Session, currentPassword: string, newPassword: string) {
  try {
    await api('/me/password', { method: 'POST', token: session.token, body: { currentPassword, newPassword } })
  } catch (err) {
    if (err instanceof ApiError && err.code === 'invalid_credentials') {
      throw new ApiError('server', err.code, 'A senha atual está incorreta.')
    }
    if (err instanceof ApiError && err.code === 'invalid_password') {
      throw new ApiError('server', err.code, 'A nova senha precisa ter de 4 a 10 caracteres, sem espaços.')
    }
    throw err
  }
}

export async function logout(session: Session) {
  // Melhor esforço: mesmo se a API falhar, a sessão local é descartada.
  await api('/logout', { method: 'POST', token: session.token }).catch(() => {})
}
