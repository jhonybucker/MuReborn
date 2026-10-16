'use client'

import Image from 'next/image'
import { Coins, KeyRound, Lock, LogOut, MapPin, Plus, RefreshCw, User } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { characterHref } from '@/components/ranking-table'
import {
  type AccountInfo,
  type Character,
  type Session,
  changePassword,
  fetchCharacters,
  loadSession,
  login,
  logout,
  saveSession,
} from '@/lib/account-api'
import { ApiError } from '@/lib/api'
import { classImage, classTitle, isDarkLord, mapName } from '@/lib/mu'

const fmt = (n: number) => n.toLocaleString('pt-BR')
const MAX_CHARACTERS = 5

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

type View =
  | { kind: 'checking' }
  | { kind: 'login'; busy: boolean; error: string | null }
  | {
      kind: 'characters'
      session: Session
      characters: Character[] | null
      account: AccountInfo
      error: string | null
    }

export function AccountPanel() {
  const [view, setView] = useState<View>({ kind: 'checking' })

  const loadCharacters = useCallback(async (session: Session) => {
    setView({ kind: 'characters', session, characters: null, account: {}, error: null })
    try {
      const { characters, account } = await fetchCharacters(session)
      setView({ kind: 'characters', session, characters, account, error: null })
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'unauthorized') {
        saveSession(null)
        setView({ kind: 'login', busy: false, error: err.message })
        return
      }
      setView({ kind: 'characters', session, characters: null, account: {}, error: (err as Error).message })
    }
  }, [])

  useEffect(() => {
    const session = loadSession()
    if (session) loadCharacters(session)
    else setView({ kind: 'login', busy: false, error: null })
  }, [loadCharacters])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const user = String(data.get('login') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const remember = data.get('remember') === 'on'
    if (!user || !password) {
      setView({ kind: 'login', busy: false, error: 'Preencha login e senha.' })
      return
    }
    setView({ kind: 'login', busy: true, error: null })
    try {
      const session = await login(user, password)
      saveSession(session, remember)
      await loadCharacters(session)
    } catch (err) {
      setView({ kind: 'login', busy: false, error: (err as Error).message })
    }
  }

  const expireSession = () => {
    saveSession(null)
    setView({ kind: 'login', busy: false, error: 'Sua sessão expirou. Entre novamente.' })
  }

  async function handleLogout(session: Session) {
    saveSession(null)
    setView({ kind: 'login', busy: false, error: null })
    await logout(session)
  }

  if (view.kind === 'checking') {
    return <p className="min-h-svh px-4 pt-40 text-center text-muted-foreground">Carregando…</p>
  }
  if (view.kind === 'login') {
    return <LoginView busy={view.busy} error={view.error} onSubmit={handleLogin} />
  }
  return (
    <Dashboard
      view={view}
      onRefresh={() => loadCharacters(view.session)}
      onLogout={() => handleLogout(view.session)}
      onExpired={expireSession}
    />
  )
}

/* ---------- Login (tela "10 Login" do canvas) ---------- */

function LoginView({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean
  error: string | null
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <Image src="/fundo.webp" alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[50%_60%]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(4_9_22/0.15)_0%,rgb(4_9_22/0.7)_50%,rgb(4_9_22/0.95)_100%),linear-gradient(0deg,#040916_0%,transparent_45%)] max-lg:bg-[rgb(4_9_22/0.75)]" />

      <div className="mx-auto flex min-h-svh max-w-7xl flex-col items-center gap-10 px-4 pt-28 pb-16 md:px-20 lg:flex-row lg:items-stretch lg:justify-between lg:pt-32">
        <div className="flex flex-col items-center justify-between gap-6 text-center lg:max-w-[480px] lg:items-start lg:text-left">
          <Image
            src="/logo.webp"
            alt="MU Reborn"
            width={612}
            height={408}
            className="h-auto w-56 drop-shadow-[0_0_34px_rgb(61_139_255/0.6)] lg:-ml-4 lg:w-[340px]"
          />
          <div className="hidden lg:block">
            <p className="text-chrome font-serif text-[40px] leading-[1.1] font-black">
              Seus heróis
              <br />
              esperam por você.
            </p>
            <p className="mt-3.5 leading-relaxed text-[#b4c4e4]">
              Acompanhe seus personagens, resets e guilda em um só lugar.
            </p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="flex w-full max-w-[440px] flex-col self-center rounded-[48px] border border-[rgb(130_175_255/0.32)] bg-[linear-gradient(160deg,rgb(22_50_115/0.68),rgb(5_12_32/0.94))] px-7 pt-10 pb-9 shadow-[0_40px_80px_-24px_#000,inset_0_1px_0_rgb(255_255_255/0.14)] sm:px-10"
        >
          <p className="eyebrow">Área do jogador</p>
          <h1 className="text-chrome mt-3.5 mb-2 font-serif text-[42px] leading-[1.05] font-black">Entrar</h1>
          <p className="mb-7 text-sm text-muted-foreground">Use o mesmo login e senha do jogo.</p>

          <label htmlFor="panel-login" className="mb-2 text-xs font-semibold tracking-[0.2em] text-[#a9bde0] uppercase">
            Login
          </label>
          <div className="mb-5 flex h-[58px] items-center gap-3.5 rounded-full border border-[#2a4c94] bg-[rgb(4_9_22/0.75)] px-6 shadow-[inset_0_2px_8px_rgb(0_0_0/0.4)] focus-within:border-ring">
            <User className="size-5 shrink-0 text-[#6f86b3]" strokeWidth={1.9} aria-hidden />
            <input
              id="panel-login"
              name="login"
              required
              maxLength={10}
              autoComplete="username"
              className="h-full w-full bg-transparent font-mono text-foreground placeholder:text-[#6f86b3] focus:outline-none"
              placeholder="seu_login"
            />
          </div>

          <label htmlFor="panel-password" className="mb-2 text-xs font-semibold tracking-[0.2em] text-[#a9bde0] uppercase">
            Senha
          </label>
          <div className="mb-4 flex h-[58px] items-center gap-3.5 rounded-full border border-[#2a4c94] bg-[rgb(4_9_22/0.75)] px-6 shadow-[inset_0_2px_8px_rgb(0_0_0/0.4)] focus-within:border-ring">
            <Lock className="size-5 shrink-0 text-[#6f86b3]" strokeWidth={1.9} aria-hidden />
            <input
              id="panel-password"
              name="password"
              type="password"
              required
              maxLength={10}
              autoComplete="current-password"
              className="h-full w-full bg-transparent text-foreground placeholder:text-[#6f86b3] focus:outline-none"
              placeholder="••••••"
            />
          </div>

          <label className="mb-6 flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="remember"
              className="size-5 cursor-pointer rounded-[7px] border border-[#2a4c94] bg-[#071230] accent-[#3d8bff]"
            />
            Manter conectado
          </label>

          {error ? (
            <p
              role="alert"
              className="mb-5 rounded-full border border-destructive/60 bg-destructive/15 px-6 py-3 text-sm text-red-200"
            >
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={busy} className="btn-play h-16 text-xl">
            {busy ? 'Entrando...' : 'Entrar'}
          </button>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Ainda não tem conta?{' '}
            <a href="/#conta" className="font-semibold text-accent underline-offset-4 hover:underline">
              Criar agora
            </a>
          </p>
        </form>
      </div>
    </section>
  )
}

/* ---------- Painel (tela "11 Painel da conta" do canvas) ---------- */

function Dashboard({
  view,
  onRefresh,
  onLogout,
  onExpired,
}: {
  view: Extract<View, { kind: 'characters' }>
  onRefresh: () => void
  onLogout: () => void
  onExpired: () => void
}) {
  const [passwordOpen, setPasswordOpen] = useState(false)
  const characters = view.characters ?? []
  const anyOnline = characters.some((c) => c.online)
  const totalResets = characters.reduce((sum, c) => sum + c.resets, 0)
  const top = [...characters].sort((a, b) => b.level - a.level)[0]
  const freeSlots = Math.max(0, MAX_CHARACTERS - characters.length)

  return (
    <section className="mx-auto flex min-h-svh max-w-7xl flex-col gap-6 px-4 pt-32 pb-24 md:px-10 lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 lg:w-[300px]">
        <div className="glass rounded-[40px] p-7">
          <div className="flex items-center gap-4">
            <span className="flex size-[68px] shrink-0 items-center justify-center rounded-full border-2 border-ring bg-[radial-gradient(circle,#2f6fe0,#0b1f55)] shadow-[0_0_26px_-4px_var(--primary)]">
              <span className="text-chrome font-serif text-[28px] font-black">
                {view.session.login.charAt(0).toUpperCase()}
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-[11px] tracking-[0.22em] text-muted-foreground uppercase">Conta</p>
              <p className="mt-1 truncate font-serif text-[22px] font-black">{view.session.login}</p>
            </div>
          </div>
          <dl className="mt-5 text-sm">
            <InfoRow label="Status">
              <span className="flex items-center gap-2">
                <span
                  className={`size-2.5 rounded-full ${anyOnline ? 'bg-[#37e08a] shadow-[0_0_10px_#37e08a]' : 'bg-[#4a5c82]'}`}
                  aria-hidden
                />
                {anyOnline ? 'Online' : 'Offline'}
              </span>
            </InfoRow>
            {view.account.createdAt ? <InfoRow label="Criada em">{formatDate(view.account.createdAt)}</InfoRow> : null}
            {view.account.lastLogin ? (
              <InfoRow label="Último acesso">{formatDateTime(view.account.lastLogin)}</InfoRow>
            ) : null}
            <InfoRow label="Personagens">
              {characters.length} de {MAX_CHARACTERS}
            </InfoRow>
            <InfoRow label="Resets totais">
              <span className="text-gold font-serif text-lg font-black">{totalResets}</span>
            </InfoRow>
          </dl>
        </div>

        <button
          type="button"
          onClick={() => setPasswordOpen((open) => !open)}
          aria-expanded={passwordOpen}
          aria-controls="trocar-senha"
          className="glass flex items-center gap-3.5 rounded-[32px] px-6 py-5 text-left text-sm text-[#a9bde0] transition-colors hover:text-foreground"
        >
          <KeyRound className="size-5 text-accent" aria-hidden />
          Alterar senha
          <span className={`ml-auto transition-transform ${passwordOpen ? 'rotate-180' : ''}`} aria-hidden>
            ▾
          </span>
        </button>
        {passwordOpen ? <PasswordForm session={view.session} onExpired={onExpired} /> : null}

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onRefresh} className="btn-frame h-11 text-xs">
            <RefreshCw className="size-4" aria-hidden />
            Atualizar
          </button>
          <button type="button" onClick={onLogout} className="btn-frame h-11 text-xs">
            <LogOut className="size-4" aria-hidden />
            Sair
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Painel</p>
            <h1 className="text-chrome mt-2.5 font-serif text-4xl leading-none font-black md:text-[40px]">
              Meus personagens
            </h1>
          </div>
          {view.characters ? (
            <p className="text-sm text-muted-foreground">
              {characters.length} de {MAX_CHARACTERS} espaços usados
            </p>
          ) : null}
        </div>

        {view.error ? (
          <p role="alert" className="glass rounded-full px-7 py-5 text-center text-muted-foreground">
            {view.error}
          </p>
        ) : view.characters === null ? (
          <p className="glass rounded-full px-7 py-5 text-center text-muted-foreground">Carregando personagens…</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {characters.map((character) => (
              <CharacterCard key={character.name} character={character} highlight={character === top} />
            ))}
            {Array.from({ length: freeSlots }, (_, index) => (
              <li
                key={`livre-${index}`}
                className="flex min-h-[180px] flex-col items-center justify-center gap-2.5 rounded-[36px] border-2 border-dashed border-[rgb(130_175_255/0.3)] p-5 text-center text-[#6f86b3]"
              >
                <span className="flex size-14 items-center justify-center rounded-full border border-[rgb(130_175_255/0.4)] text-[#8cc4ff]">
                  <Plus className="size-7" aria-hidden />
                </span>
                <span className="text-sm tracking-[0.1em] uppercase">Espaço livre</span>
                <span className="text-xs">Crie um personagem no jogo</span>
              </li>
            ))}
            {top ? (
              <li className="glass flex min-h-[180px] flex-col justify-center gap-2.5 rounded-[36px] p-6">
                <span className="text-[11px] tracking-[0.22em] text-muted-foreground uppercase">Maior level</span>
                <span className="text-gold font-serif text-[44px] leading-none font-black">{top.level}</span>
                <span className="text-[13px] text-muted-foreground">
                  {top.name} · {classTitle(top.class)}
                </span>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </section>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-t border-[rgb(130_175_255/0.16)] py-3 text-muted-foreground">
      <dt>{label}</dt>
      <dd className="font-semibold text-foreground">{children}</dd>
    </div>
  )
}

function CharacterCard({ character: c, highlight }: { character: Character; highlight: boolean }) {
  const image = classImage(c.class)
  const stats = [
    { label: 'Força', value: c.strength },
    { label: 'Agilidade', value: c.agility },
    { label: 'Vitalidade', value: c.vitality },
    { label: 'Energia', value: c.energy },
    ...(isDarkLord(c.class) ? [{ label: 'Comando', value: c.command }] : []),
  ]

  return (
    <li
      className={`glass relative flex flex-col gap-3.5 rounded-[36px] p-5 transition-[filter] hover:brightness-115 ${
        highlight ? 'border-accent/55 shadow-[0_0_40px_-12px_rgb(240_180_67/0.6),0_24px_60px_-24px_#000]' : ''
      }`}
    >
      <div className="flex items-center gap-3.5">
        {image ? (
          <Image
            src={image}
            alt=""
            width={64}
            height={64}
            className="size-16 shrink-0 rounded-full border-2 border-accent/70 object-cover object-[50%_18%] shadow-[0_0_22px_-4px_rgb(240_180_67/0.6)]"
          />
        ) : null}
        <div className="min-w-0">
          {/* O link cobre o card inteiro (after:inset-0); só o "Ver atributos" fica por cima. */}
          <a
            href={characterHref(c.name)}
            className="block truncate font-serif text-[22px] leading-tight font-black after:absolute after:inset-0 after:rounded-[36px] after:content-[''] hover:text-accent"
          >
            {c.name}
          </a>
          <p className="mt-1 text-xs tracking-[0.14em] text-muted-foreground uppercase">
            {classTitle(c.class)}
          </p>
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          <span
            className={`size-2.5 rounded-full ${c.online ? 'bg-[#37e08a] shadow-[0_0_10px_#37e08a]' : 'bg-[#4a5c82]'}`}
            aria-hidden
          />
          {c.online ? 'Online' : 'Offline'}
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Level">
          <span className="font-serif text-xl font-black">{c.level}</span>
        </Metric>
        <Metric label="Resets">
          <span className="text-gold font-serif text-xl font-black">{c.resets}</span>
        </Metric>
        <Metric label="Master">
          {c.master ? (
            <span className="text-xl text-accent">
              ★<span className="sr-only">sim</span>
            </span>
          ) : (
            <span className="text-xl text-[#4a5c82]">
              —<span className="sr-only">não</span>
            </span>
          )}
        </Metric>
      </dl>

      <p
        className={`flex items-center gap-2.5 rounded-full border border-primary/30 bg-primary/10 py-1.5 pr-3.5 pl-1.5 text-[13px] text-[#cfdcf5] ${
          c.guild ? '' : 'opacity-60'
        }`}
      >
        <span
          className={`flex size-[26px] items-center justify-center rounded-full font-serif text-xs font-black ${
            c.guild ? 'bg-gradient-to-b from-[#fff3c4] to-[#c9780f] text-[#2a1700]' : 'bg-input text-muted-foreground'
          }`}
          aria-hidden
        >
          {c.guild ? c.guild.charAt(0).toUpperCase() : '—'}
        </span>
        {c.guild ?? 'Sem guilda'}
      </p>

      <details className="group relative z-10">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs tracking-[0.14em] text-[#8cc4ff] uppercase [&::-webkit-details-marker]:hidden">
          Ver atributos e local
          <span className="transition-transform group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <dl className="mt-3 flex flex-col text-sm">
          {stats.map((stat) => (
            <div key={stat.label} className="flex justify-between border-b border-[rgb(130_175_255/0.12)] py-1.5">
              <dt className="text-muted-foreground">{stat.label}</dt>
              <dd className="font-mono">{fmt(stat.value)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-b border-[rgb(130_175_255/0.12)] py-1.5">
            <dt className="text-muted-foreground">Pontos livres</dt>
            <dd className={`font-mono ${c.points > 0 ? 'text-accent' : ''}`}>{fmt(c.points)}</dd>
          </div>
          <div className="flex justify-between border-b border-[rgb(130_175_255/0.12)] py-1.5">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Coins className="size-3.5 text-accent" aria-hidden />
              Zen
            </dt>
            <dd className="font-mono">{fmt(c.zen)}</dd>
          </div>
          <div className="flex justify-between py-1.5">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5 text-[#8cc4ff]" aria-hidden />
              Local
            </dt>
            <dd>
              {mapName(c.map)}{' '}
              <span className="text-muted-foreground">
                ({c.x}, {c.y})
              </span>
            </dd>
          </div>
        </dl>
      </details>
    </li>
  )
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-[rgb(130_175_255/0.18)] bg-[rgb(4_9_22/0.55)] px-1.5 py-2.5">
      <dt className="mb-0.5 text-[10px] tracking-[0.18em] text-[#6f86b3] uppercase">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/* ---------- Trocar senha ---------- */

function PasswordForm({ session, onExpired }: { session: Session; onExpired: () => void }) {
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'busy' } | { kind: 'done' } | { kind: 'error'; message: string }
  >({ kind: 'idle' })

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const current = String(data.get('current') ?? '')
    const next = String(data.get('next') ?? '')
    const confirm = String(data.get('confirm') ?? '')

    if (next.length < 4 || next.length > 10 || /\s/.test(next)) {
      setStatus({ kind: 'error', message: 'A nova senha precisa ter de 4 a 10 caracteres, sem espaços.' })
      return
    }
    if (next !== confirm) {
      setStatus({ kind: 'error', message: 'A confirmação não é igual à nova senha.' })
      return
    }

    setStatus({ kind: 'busy' })
    try {
      await changePassword(session, current, next)
      form.reset()
      setStatus({ kind: 'done' })
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'unauthorized') {
        onExpired()
        return
      }
      setStatus({ kind: 'error', message: (err as Error).message })
    }
  }

  const fields = [
    { name: 'current', label: 'Senha atual', autoComplete: 'current-password' },
    { name: 'next', label: 'Nova senha', autoComplete: 'new-password' },
    { name: 'confirm', label: 'Confirmar nova senha', autoComplete: 'new-password' },
  ]

  return (
    <form id="trocar-senha" onSubmit={handleSubmit} noValidate className="glass flex flex-col gap-3.5 rounded-[32px] p-6">
      {fields.map((field) => (
        <div key={field.name} className="flex flex-col gap-1.5">
          <label htmlFor={`pw-${field.name}`} className="text-[11px] font-semibold tracking-[0.2em] text-[#a9bde0] uppercase">
            {field.label}
          </label>
          <input
            id={`pw-${field.name}`}
            name={field.name}
            type="password"
            required
            maxLength={10}
            autoComplete={field.autoComplete}
            className="h-11 rounded-full border border-[#2a4c94] bg-[rgb(4_9_22/0.75)] px-5 text-foreground focus:border-ring focus:outline-none"
          />
        </div>
      ))}
      <p className="text-xs text-[#6f86b3]">4 a 10 caracteres, sem espaços. Vale para o site e para o jogo.</p>
      {status.kind === 'error' ? (
        <p role="alert" className="rounded-[20px] border border-destructive/60 bg-destructive/15 px-4 py-2.5 text-sm text-red-200">
          {status.message}
        </p>
      ) : status.kind === 'done' ? (
        <p role="status" className="rounded-[20px] border border-[#37e08a]/50 bg-[#37e08a]/10 px-4 py-2.5 text-sm text-[#a6f5c9]">
          Senha alterada. Use a nova senha no próximo login do jogo.
        </p>
      ) : null}
      <button type="submit" disabled={status.kind === 'busy'} className="btn-play h-12 text-sm">
        {status.kind === 'busy' ? 'Salvando...' : 'Salvar nova senha'}
      </button>
    </form>
  )
}
