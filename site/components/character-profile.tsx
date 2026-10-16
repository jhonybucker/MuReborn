'use client'

import Image from 'next/image'
import { Check, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type EquipmentItem, EquipmentGrid } from '@/components/equipment-grid'
import { ApiError, api } from '@/lib/api'
import { className, classImage, classTitle, isDarkLord } from '@/lib/mu'
import { SERVER } from '@/lib/server-info'

// Formato de GET /api/characters/:name: docs/api-site.md. Sem mapa nem posição, de propósito.
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
  /** Opcionais: só aparecem quando a API mandar. */
  rank?: number
  playedHours?: number
  lastSeen?: string
  createdAt?: string
  /** Itens equipados, já decodificados pela API. */
  equipment?: EquipmentItem[]
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
    <section className="mx-auto flex min-h-svh max-w-7xl flex-col px-4 pt-32 pb-24 md:px-[72px]">
      {state.kind === 'ready' ? (
        <>
          <Profile character={state.character} />
          <EquipmentGrid items={state.character.equipment} />
        </>
      ) : (
        <div className="flex flex-col gap-8">
          <BackLink />
          {state.kind === 'loading' ? (
            <p className="glass rounded-full px-7 py-5 text-center text-muted-foreground">Carregando personagem…</p>
          ) : state.kind === 'not-found' ? (
            <div className="glass flex flex-col items-center gap-3 rounded-[36px] px-7 py-12 text-center">
              <p className="font-serif text-2xl font-bold">Personagem não encontrado</p>
              <p className="text-muted-foreground">
                Não existe um personagem chamado <span className="font-mono text-foreground">{name}</span>.
              </p>
            </div>
          ) : (
            <p role="alert" className="glass rounded-full px-7 py-5 text-center text-muted-foreground">
              {state.message}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function BackLink() {
  return (
    <a href="/ranking" className="btn-frame h-10 w-fit gap-2.5 pr-5 pl-3.5 text-xs">
      <span className="text-base" aria-hidden>
        ←
      </span>
      Voltar ao ranking
    </a>
  )
}

function Profile({ character: c }: { character: PublicCharacter }) {
  const image = classImage(c.class)
  // Barra cheia = teto de atributos (o do master reset para quem já fez).
  const cap = c.master ? SERVER.masterStatCap : SERVER.statCap
  const stats = [
    { label: 'Força', value: c.strength },
    { label: 'Agilidade', value: c.agility },
    { label: 'Vitalidade', value: c.vitality },
    { label: 'Energia', value: c.energy },
    ...(isDarkLord(c.class) ? [{ label: 'Comando', value: c.command }] : []),
  ]
  const info = [
    c.playedHours !== undefined ? { label: 'Tempo jogado', value: `${fmt(c.playedHours)} h` } : null,
    c.online
      ? { label: 'Último acesso', value: 'Agora' }
      : c.lastSeen
        ? { label: 'Último acesso', value: new Date(c.lastSeen).toLocaleDateString('pt-BR') }
        : null,
    c.createdAt ? { label: 'Criado em', value: new Date(c.createdAt).toLocaleDateString('pt-BR') } : null,
  ].filter((item) => item !== null)

  return (
    <article className="flex flex-col gap-10 lg:flex-row lg:gap-14">
      <div className="gold-ring relative mx-auto h-[460px] w-full max-w-[380px] shrink-0 overflow-hidden rounded-t-[190px] rounded-b-[44px] shadow-[0_0_0_7px_rgb(240_180_67/0.07),0_36px_80px_-20px_#000] lg:mx-0 lg:h-[608px]">
        {image ? (
          <Image
            src={image}
            alt={`Arte da classe ${className(c.class)}`}
            fill
            priority
            sizes="380px"
            className="object-cover object-[50%_28%]"
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#040916_4%,rgb(4_9_22/0.4)_34%,transparent_60%)]" />
        <div className="absolute top-6 left-1/2 flex size-[88px] -translate-x-1/2 flex-col items-center justify-center rounded-full border-2 border-accent bg-[radial-gradient(circle,rgb(20_44_100/0.95),rgb(4_9_22/0.95))] shadow-[0_0_30px_rgb(240_180_67/0.6)]">
          <span className="text-[9px] tracking-[0.2em] text-accent">LEVEL</span>
          <span className="text-gold font-serif text-[32px] leading-none font-black">{c.level}</span>
        </div>
        <div className="absolute inset-x-4 bottom-7 text-center">
          <p className="text-xs font-semibold tracking-[0.26em] text-accent uppercase">{classTitle(c.class)}</p>
          <h1 className="text-chrome mt-1.5 truncate font-serif text-[44px] leading-tight font-black">{c.name}</h1>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <BackLink />

        <ul className="mt-6 flex flex-wrap items-center gap-2.5">
          {c.rank ? (
            <Chip className="border-accent/60 bg-accent/10 text-[#f7dfa4]">
              <span className="text-sm">#</span>
              {c.rank} no ranking
            </Chip>
          ) : null}
          <Chip>{classTitle(c.class)}</Chip>
          {c.guild ? (
            <Chip>
              <span
                className="flex size-[22px] items-center justify-center rounded-full bg-gradient-to-b from-[#fff3c4] to-[#c9780f] font-serif text-[11px] font-black text-[#2a1700]"
                aria-hidden
              >
                {c.guild.charAt(0).toUpperCase()}
              </span>
              {c.guild}
            </Chip>
          ) : null}
          <Chip
            className={
              c.online ? 'border-[#37e08a]/40 bg-[#37e08a]/10 text-[#8ef0be]' : 'text-muted-foreground'
            }
          >
            <span
              className={`size-[9px] rounded-full ${c.online ? 'bg-[#37e08a] shadow-[0_0_10px_#37e08a]' : 'bg-[#4a5c82]'}`}
              aria-hidden
            />
            {c.online ? 'Online' : 'Offline'}
          </Chip>
        </ul>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Level">
            <span className="text-chrome">{c.level}</span>
          </Metric>
          <Metric label="Resets">
            <span className="text-gold">{c.resets}</span>
          </Metric>
          <Metric label="Master reset">
            {c.master ? (
              <span className="text-accent">
                ★<span className="sr-only">sim</span>
              </span>
            ) : (
              <span className="text-[#4a5c82]">
                —<span className="sr-only">não</span>
              </span>
            )}
          </Metric>
          <Metric label="Ranking">
            <span className="text-chrome">{c.rank ? `#${c.rank}` : '—'}</span>
          </Metric>
        </dl>

        <div className="glass mt-4 rounded-[36px] px-6 py-6 sm:px-7">
          <p className="mb-4 text-[11px] font-semibold tracking-[0.26em] text-accent uppercase">Atributos</p>
          <dl className="flex flex-col gap-3.5">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-4">
                <dt className="w-24 shrink-0 text-[13px] tracking-[0.12em] text-[#a9bde0] uppercase sm:w-28">
                  {stat.label}
                </dt>
                <dd className="flex flex-1 items-center gap-4">
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-primary/15" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-[#1d4fb8] to-ring"
                      style={{ width: `${Math.min(100, (stat.value / cap) * 100)}%` }}
                    />
                  </span>
                  <span className="w-[76px] text-right font-serif text-[17px]">{fmt(stat.value)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {info.length > 0 ? (
          <dl className="glass mt-4 flex flex-wrap justify-between gap-x-8 gap-y-3 rounded-[32px] px-8 py-4 sm:rounded-full sm:px-9">
            {info.map((item) => (
              <div key={item.label}>
                <dt className="text-[10px] tracking-[0.2em] text-[#6f86b3] uppercase">{item.label}</dt>
                <dd className="mt-1 font-semibold">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <ShareButton name={c.name} />
      </div>
    </article>
  )
}

function Chip({ children, className: extra = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <li
      className={`inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-4 py-2 text-xs font-semibold tracking-[0.14em] text-[#cfdcf5] uppercase ${extra}`}
    >
      {children}
    </li>
  )
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-[28px] px-2.5 py-4 text-center">
      <dt className="mb-1.5 text-[10px] tracking-[0.2em] text-[#6f86b3] uppercase">{label}</dt>
      <dd className="font-serif text-[34px] leading-none font-black">{children}</dd>
    </div>
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
    <button type="button" onClick={share} className="btn-frame mt-6 h-11 w-fit px-5 text-xs">
      {copied ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
      {copied ? 'Link copiado' : 'Compartilhar perfil'}
    </button>
  )
}
