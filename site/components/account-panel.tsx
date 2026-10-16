'use client'

import Image from 'next/image'
import { Coins, Lock, LogOut, MapPin, User } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { SectionHeading } from '@/components/section-heading'
import {
  AccountApiError,
  type Character,
  type Session,
  fetchCharacters,
  loadSession,
  login,
  logout,
  saveSession,
} from '@/lib/account-api'
import { className, classEvolution, classImage, isDarkLord, mapName } from '@/lib/mu'

const fmt = (n: number) => n.toLocaleString('pt-BR')

type View =
  | { kind: 'checking' }
  | { kind: 'login'; busy: boolean; error: string | null }
  | { kind: 'characters'; session: Session; characters: Character[] | null; error: string | null }

export function AccountPanel() {
  const [view, setView] = useState<View>({ kind: 'checking' })

  const loadCharacters = useCallback(async (session: Session) => {
    setView({ kind: 'characters', session, characters: null, error: null })
    try {
      const characters = await fetchCharacters(session)
      setView({ kind: 'characters', session, characters, error: null })
    } catch (err) {
      if (err instanceof AccountApiError && err.kind === 'expired') {
        saveSession(null)
        setView({ kind: 'login', busy: false, error: err.message })
        return
      }
      setView({ kind: 'characters', session, characters: null, error: (err as Error).message })
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
    if (!user || !password) {
      setView({ kind: 'login', busy: false, error: 'Preencha login e senha.' })
      return
    }
    setView({ kind: 'login', busy: true, error: null })
    try {
      const session = await login(user, password)
      saveSession(session)
      await loadCharacters(session)
    } catch (err) {
      setView({ kind: 'login', busy: false, error: (err as Error).message })
    }
  }

  async function handleLogout(session: Session) {
    saveSession(null)
    setView({ kind: 'login', busy: false, error: null })
    await logout(session)
  }

  return (
    <section className="mx-auto min-h-svh max-w-7xl px-4 pt-36 pb-24 md:px-20">
      {view.kind === 'checking' ? (
        <p className="text-center text-muted-foreground">Carregando…</p>
      ) : view.kind === 'login' ? (
        <LoginForm busy={view.busy} error={view.error} onSubmit={handleLogin} />
      ) : (
        <div className="flex flex-col gap-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading
              eyebrow="Minha conta"
              title="Meus personagens"
              description={`Conta ${view.session.login}. Os dados são atualizados quando o personagem sai do jogo ou o servidor salva.`}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => loadCharacters(view.session)}
                className="btn-frame h-11 px-5 text-xs"
              >
                Atualizar
              </button>
              <button type="button" onClick={() => handleLogout(view.session)} className="btn-frame h-11 px-5 text-xs">
                <LogOut className="size-4" aria-hidden />
                Sair
              </button>
            </div>
          </div>

          {view.error ? (
            <p role="alert" className="glass rounded-full px-7 py-5 text-center text-muted-foreground">
              {view.error}
            </p>
          ) : view.characters === null ? (
            <p className="glass rounded-full px-7 py-5 text-center text-muted-foreground">Carregando personagens…</p>
          ) : view.characters.length === 0 ? (
            <p className="glass rounded-full px-7 py-5 text-center text-muted-foreground">
              Nenhum personagem nesta conta ainda. Entre no jogo e crie o seu!
            </p>
          ) : (
            <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {view.characters.map((character) => (
                <CharacterCard key={character.name} character={character} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function LoginForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean
  error: string | null
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <SectionHeading
        eyebrow="Minha conta"
        title="Entrar"
        description="Use o mesmo login e senha do jogo para ver seus personagens."
      />
      <form
        onSubmit={onSubmit}
        noValidate
        className="glass flex flex-col rounded-[44px] bg-[linear-gradient(160deg,rgb(22_50_115/0.6),rgb(5_12_32/0.9))] px-6 pt-8 pb-9 md:px-9"
      >
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
        <div className="mb-6 flex h-[58px] items-center gap-3.5 rounded-full border border-[#2a4c94] bg-[rgb(4_9_22/0.75)] px-6 shadow-[inset_0_2px_8px_rgb(0_0_0/0.4)] focus-within:border-ring">
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
          <a href="/#conta" className="text-accent underline-offset-4 hover:underline">
            Criar conta
          </a>
        </p>
      </form>
    </div>
  )
}

function CharacterCard({ character: c }: { character: Character }) {
  const image = classImage(c.class)
  const evolution = classEvolution(c.class)
  const stats = [
    { label: 'Força', value: c.strength },
    { label: 'Agilidade', value: c.agility },
    { label: 'Vitalidade', value: c.vitality },
    { label: 'Energia', value: c.energy },
    ...(isDarkLord(c.class) ? [{ label: 'Comando', value: c.command }] : []),
  ]

  return (
    <li className="glass flex flex-col overflow-hidden rounded-[40px] bg-[linear-gradient(160deg,rgb(20_44_100/0.6),rgb(5_12_32/0.9))]">
      <div className="relative h-44 overflow-hidden">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover object-[50%_25%]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_40%,rgb(90_162_255/0.55),rgb(61_20_110/0.85)_55%,#08051a)]">
            <span className="text-chrome font-serif text-6xl font-black">DL</span>
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#071230_0%,rgb(7_18_48/0.5)_45%,transparent_80%)]" />
        <span
          className={`absolute top-4 right-4 flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] tracking-[0.18em] uppercase backdrop-blur-sm ${
            c.online
              ? 'border-[#37e08a]/50 bg-[#37e08a]/15 text-[#a6f5c9]'
              : 'border-[rgb(130_175_255/0.3)] bg-[rgb(4_9_22/0.6)] text-muted-foreground'
          }`}
        >
          <span
            className={`size-2 rounded-full ${c.online ? 'bg-[#37e08a] shadow-[0_0_10px_#37e08a]' : 'bg-muted-foreground'}`}
            aria-hidden
          />
          {c.online ? 'Online' : 'Offline'}
        </span>
        <div className="absolute inset-x-6 bottom-4">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-accent uppercase">
            {evolution ?? className(c.class)}
          </p>
          <h3 className="flex items-center gap-2 font-serif text-2xl font-black">
            {c.name}
            {c.master ? (
              <span className="text-lg text-accent" title="Master reset">
                ★<span className="sr-only">Master reset</span>
              </span>
            ) : null}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-6">
        <dl className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-[20px] border border-[rgb(130_175_255/0.2)] bg-[rgb(4_9_22/0.5)] py-3">
            <dt className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">Level</dt>
            <dd className="font-serif text-2xl font-black text-[#8cc4ff]">{c.level}</dd>
          </div>
          <div className="rounded-[20px] border border-[rgb(130_175_255/0.2)] bg-[rgb(4_9_22/0.5)] py-3">
            <dt className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">Resets</dt>
            <dd className="text-gold font-serif text-2xl font-black">{c.resets}</dd>
          </div>
        </dl>

        <dl className="flex flex-col">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center justify-between border-b border-[rgb(130_175_255/0.12)] py-2 text-sm"
            >
              <dt className="text-muted-foreground">{stat.label}</dt>
              <dd className="font-mono text-foreground">{fmt(stat.value)}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 text-sm">
            <dt className="text-muted-foreground">Pontos livres</dt>
            <dd className={`font-mono ${c.points > 0 ? 'text-accent' : 'text-foreground'}`}>{fmt(c.points)}</dd>
          </div>
        </dl>

        <dl className="mt-auto flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <dt>
              <Coins className="size-4 text-accent" aria-hidden />
              <span className="sr-only">Zen</span>
            </dt>
            <dd>{fmt(c.zen)} zen</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt>
              <MapPin className="size-4 text-[#8cc4ff]" aria-hidden />
              <span className="sr-only">Mapa</span>
            </dt>
            <dd>
              {mapName(c.map)} <span className="text-muted-foreground">({c.x}, {c.y})</span>
            </dd>
          </div>
        </dl>
      </div>
    </li>
  )
}
