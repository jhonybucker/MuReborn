'use client'

import Image from 'next/image'
import { Check, Share2, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ApiError, api } from '@/lib/api'
import { className, classEvolution, classImage, isDarkLord } from '@/lib/mu'

type PublicCharacter = {
  name: string
  class: number
  level: number
  resets: number
  master: boolean
  online: boolean
  guild: string | null
  strength: number
  agility: number
  vitality: number
  energy: number
  command: number
}

type State =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; character: PublicCharacter }

const fmt = (n: number) => n.toLocaleString('pt-BR')

export function CharacterProfile({ name }: { name: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let alive = true
    api<{ character: PublicCharacter }>(`/characters/${encodeURIComponent(name)}`)
      .then((body) => alive && setState({ kind: 'ready', character: body.character }))
      .catch((err) => {
        if (!alive) return
        if (err instanceof ApiError && err.kind === 'not-found') setState({ kind: 'not-found' })
        else setState({ kind: 'error', message: (err as Error).message })
      })
    return () => {
      alive = false
    }
  }, [name])

  return (
    <section className="mx-auto flex min-h-svh max-w-5xl flex-col px-4 pt-36 pb-24 md:px-10">
      <a href="/ranking" className="mb-8 w-fit text-sm text-muted-foreground hover:text-accent">
        ← Voltar ao ranking
      </a>
      {state.kind === 'loading' ? (
        <p className="glass rounded-full px-7 py-5 text-center text-muted-foreground">Carregando personagem…</p>
      ) : state.kind === 'not-found' ? (
        <div className="glass flex flex-col items-center gap-3 rounded-[36px] px-7 py-12 text-center">
          <p className="font-serif text-2xl font-bold">Personagem não encontrado</p>
          <p className="text-muted-foreground">
            Não existe um personagem chamado <span className="font-mono text-foreground">{name}</span>.
          </p>
        </div>
      ) : state.kind === 'error' ? (
        <p role="alert" className="glass rounded-full px-7 py-5 text-center text-muted-foreground">
          {state.message}
        </p>
      ) : (
        <Profile character={state.character} />
      )}
    </section>
  )
}

function Profile({ character: c }: { character: PublicCharacter }) {
  const image = classImage(c.class)
  const stats = [
    { label: 'Força', value: c.strength },
    { label: 'Agilidade', value: c.agility },
    { label: 'Vitalidade', value: c.vitality },
    { label: 'Energia', value: c.energy },
    ...(isDarkLord(c.class) ? [{ label: 'Comando', value: c.command }] : []),
  ]

  return (
    <article className="flex flex-col gap-8 md:flex-row">
      <div className="gold-ring relative h-[420px] shrink-0 overflow-hidden rounded-t-[160px] rounded-b-[36px] md:h-[520px] md:w-[340px]">
        {image ? (
          <Image src={image} alt={`Arte da classe ${className(c.class)}`} fill sizes="(min-width: 768px) 340px, 100vw" className="object-cover object-[50%_15%]" priority />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#040916_6%,rgb(4_9_22/0.4)_45%,transparent_75%)]" />
        <span
          className={`absolute top-6 right-6 flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] tracking-[0.18em] uppercase backdrop-blur-sm ${
            c.online
              ? 'border-[#37e08a]/50 bg-[#37e08a]/15 text-[#a6f5c9]'
              : 'border-[rgb(130_175_255/0.3)] bg-[rgb(4_9_22/0.6)] text-muted-foreground'
          }`}
        >
          <span className={`size-2 rounded-full ${c.online ? 'bg-[#37e08a] shadow-[0_0_10px_#37e08a]' : 'bg-muted-foreground'}`} aria-hidden />
          {c.online ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-6">
        <div>
          <p className="eyebrow">{classEvolution(c.class) ?? className(c.class)}</p>
          <h1 className="text-chrome mt-3 flex items-center gap-3 font-serif text-5xl leading-none font-black md:text-6xl">
            {c.name}
            {c.master ? (
              <span className="text-3xl text-accent" title="Master reset">
                ★<span className="sr-only">Master reset</span>
              </span>
            ) : null}
          </h1>
          {c.guild ? (
            <p className="mt-3 flex items-center gap-2 text-[#a9bde0]">
              <Shield className="size-4 text-accent" aria-hidden />
              Guild {c.guild}
            </p>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
          <div className="glass rounded-[24px] py-4">
            <dt className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">Level</dt>
            <dd className="font-serif text-3xl font-black text-[#8cc4ff]">{c.level}</dd>
          </div>
          <div className="glass rounded-[24px] py-4">
            <dt className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">Resets</dt>
            <dd className="text-gold font-serif text-3xl font-black">{c.resets}</dd>
          </div>
          <div className="glass col-span-2 rounded-[24px] py-4 sm:col-span-1">
            <dt className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">Classe</dt>
            <dd className="font-serif text-xl font-bold">{className(c.class)}</dd>
          </div>
        </dl>

        <dl className="glass flex flex-col rounded-[28px] px-6 py-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center justify-between border-b border-[rgb(130_175_255/0.12)] py-2.5 last:border-b-0">
              <dt className="text-muted-foreground">{stat.label}</dt>
              <dd className="font-mono">{fmt(stat.value)}</dd>
            </div>
          ))}
        </dl>

        <ShareButton name={c.name} />
      </div>
    </article>
  )
}

function ShareButton({ name }: { name: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} — MU Reborn`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* compartilhamento cancelado pelo jogador */
    }
  }

  return (
    <button type="button" onClick={share} className="btn-frame h-11 w-fit px-5 text-xs">
      {copied ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
      {copied ? 'Link copiado' : 'Compartilhar perfil'}
    </button>
  )
}
