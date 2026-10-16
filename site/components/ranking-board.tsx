'use client'

import { useEffect, useRef, useState } from 'react'
import { type CharacterRow, CharacterTable, type GuildRow, GuildTable } from '@/components/ranking-table'
import { SectionHeading } from '@/components/section-heading'
import { api } from '@/lib/api'
import { CLASSES, mapName } from '@/lib/mu'

type OnlineRow = CharacterRow & { map: number }

type Tab = { id: string; label: string; path: string; kind: 'characters' | 'guilds' | 'online' }

const TABS: Tab[] = [
  { id: 'geral', label: 'Geral', path: '/rankings?tab=general&limit=50', kind: 'characters' },
  { id: 'master', label: 'Master reset', path: '/rankings?tab=master&limit=50', kind: 'characters' },
  ...CLASSES.map((name, index) => ({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    label: name,
    path: `/rankings?tab=class&class=${index}&limit=50`,
    kind: 'characters' as const,
  })),
  { id: 'guilds', label: 'Guilds', path: '/rankings/guilds?limit=50', kind: 'guilds' },
  { id: 'online', label: 'Online agora', path: '/online', kind: 'online' },
]

type Data =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'characters'; rows: CharacterRow[] }
  | { kind: 'guilds'; rows: GuildRow[] }
  | { kind: 'online'; rows: OnlineRow[] }

export function RankingBoard() {
  const [tabId, setTabId] = useState(TABS[0].id)
  const [data, setData] = useState<Data>({ kind: 'loading' })
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0]

  // A aba fica na URL (?aba=master) para dar para compartilhar o link.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('aba')
    if (fromUrl && TABS.some((t) => t.id === fromUrl)) setTabId(fromUrl)
  }, [])

  useEffect(() => {
    let alive = true
    setData({ kind: 'loading' })
    async function load() {
      try {
        if (tab.kind === 'guilds') {
          const body = await api<{ guilds?: GuildRow[] }>(tab.path)
          if (alive) setData({ kind: 'guilds', rows: body.guilds ?? [] })
        } else if (tab.kind === 'online') {
          const body = await api<{ players?: OnlineRow[] }>(tab.path)
          if (alive) setData({ kind: 'online', rows: body.players ?? [] })
        } else {
          const body = await api<{ rankings?: CharacterRow[] }>(tab.path)
          if (alive) setData({ kind: 'characters', rows: body.rankings ?? [] })
        }
      } catch {
        if (alive) setData({ kind: 'error' })
      }
    }
    load()
    const refresh = setInterval(load, tab.kind === 'online' ? 60000 : 300000)
    return () => {
      alive = false
      clearInterval(refresh)
    }
  }, [tab])

  function select(index: number) {
    const next = TABS[(index + TABS.length) % TABS.length]
    setTabId(next.id)
    tabRefs.current[TABS.indexOf(next)]?.focus()
    const url = new URL(window.location.href)
    url.searchParams.set('aba', next.id)
    window.history.replaceState(null, '', url)
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === 'ArrowRight') select(index + 1)
    else if (event.key === 'ArrowLeft') select(index - 1)
    else if (event.key === 'Home') select(0)
    else if (event.key === 'End') select(TABS.length - 1)
    else return
    event.preventDefault()
  }

  const empty =
    data.kind === 'loading'
      ? 'Carregando…'
      : data.kind === 'error'
        ? 'Ranking indisponível no momento. Tente novamente mais tarde.'
        : tab.kind === 'online'
          ? 'Ninguém online agora.'
          : 'Ninguém neste ranking ainda.'

  return (
    <section className="mx-auto flex min-h-svh max-w-7xl flex-col gap-10 px-4 pt-36 pb-24 md:px-20">
      <SectionHeading
        eyebrow="Ranking"
        title="Os maiores de MU Reborn."
        description="Atualizado a cada poucos minutos. Clique em um personagem para ver o perfil."
      />

      <div
        role="tablist"
        aria-label="Tipo de ranking"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((t, index) => {
          const selected = t.id === tab.id
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[index] = el
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls="ranking-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`h-10 shrink-0 rounded-full border px-4 text-xs font-semibold tracking-[0.12em] whitespace-nowrap uppercase transition-colors ${
                selected
                  ? 'border-accent bg-accent/15 text-[#f7dfa4] shadow-[0_0_20px_-6px_var(--accent)]'
                  : 'border-[rgb(130_175_255/0.3)] bg-[rgb(4_9_22/0.55)] text-[#a9bde0] hover:border-ring hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div id="ranking-panel" role="tabpanel" aria-labelledby={`tab-${tab.id}`} className="min-w-0">
        {data.kind === 'guilds' ? (
          <GuildTable rows={data.rows} emptyText={empty} />
        ) : data.kind === 'online' ? (
          <>
            <p className="mb-2 text-sm text-muted-foreground">
              {data.rows.length} {data.rows.length === 1 ? 'jogador conectado' : 'jogadores conectados'}
            </p>
            <CharacterTable
              rows={data.rows}
              emptyText={empty}
              podium={false}
              extra={{ label: 'Mapa', render: (row) => mapName((row as OnlineRow).map) }}
            />
          </>
        ) : data.kind === 'characters' ? (
          <CharacterTable rows={data.rows} emptyText={empty} />
        ) : tab.kind === 'guilds' ? (
          <GuildTable rows={[]} emptyText={empty} />
        ) : (
          <CharacterTable rows={[]} emptyText={empty} podium={tab.kind !== 'online'} />
        )}
      </div>
    </section>
  )
}
