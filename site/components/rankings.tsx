'use client'

import { useEffect, useState } from 'react'
import { type CharacterRow, CharacterTable } from '@/components/ranking-table'
import { SectionHeading } from '@/components/section-heading'
import { api } from '@/lib/api'

type Status = { online: number; ports?: Record<string, boolean> }

export function Rankings() {
  const [online, setOnline] = useState<number | null>(null)
  const [rows, setRows] = useState<CharacterRow[]>([])
  const [serversUp, setServersUp] = useState<boolean | null>(null)
  const [apiDown, setApiDown] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      const [s, r] = await Promise.allSettled([
        api<Status>('/status'),
        api<{ rankings?: CharacterRow[] }>('/rankings?limit=10'),
      ])
      if (!alive) return
      const status = s.status === 'fulfilled' ? s.value : null
      const ranking = r.status === 'fulfilled' ? r.value : null
      if (status) {
        setOnline(status.online)
        setServersUp([44405, 55901, 55960, 55970].every((p) => status.ports?.[String(p)]))
      }
      if (ranking) setRows(ranking.rankings ?? [])
      setApiDown(!status && !ranking)
    }
    load()
    const t = setInterval(load, 300000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  return (
    <section
      id="rankings"
      className="bg-[radial-gradient(ellipse_60%_70%_at_100%_0%,rgb(61_139_255/0.22),transparent_70%),radial-gradient(ellipse_50%_50%_at_0%_100%,rgb(30_80_200/0.18),transparent_70%)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-24 md:px-20 lg:flex-row lg:gap-16">
        <div className="flex shrink-0 flex-col lg:w-[340px]">
          <SectionHeading
            eyebrow="Servidor"
            title="Status e rankings"
            description="Jogadores online agora e os maiores levels do Mu Reborn."
          />
          <div className="glass mt-10 flex items-center gap-6 rounded-[36px] p-7">
            <div className="flex size-28 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(#5aa2ff_0_100%)] shadow-[0_0_40px_-6px_rgb(61_139_255/0.8)]">
              <div className="flex size-[86px] flex-col items-center justify-center rounded-full bg-[#071230]">
                <span className="font-serif text-[34px] leading-none font-black">{online ?? (apiDown ? '—' : '…')}</span>
                <span className="mt-1 text-[10px] tracking-[0.2em] text-muted-foreground">ONLINE</span>
              </div>
            </div>
            <div>
              <p className="text-[11px] tracking-[0.22em] text-muted-foreground uppercase">Servidores</p>
              <div className="mt-1.5 flex items-center gap-2.5">
                <span
                  className={`size-3 rounded-full ${
                    serversUp == null
                      ? 'bg-muted-foreground'
                      : serversUp
                        ? 'bg-[#37e08a] shadow-[0_0_14px_#37e08a]'
                        : 'bg-destructive shadow-[0_0_14px_var(--destructive)]'
                  }`}
                  aria-hidden
                />
                <span className="font-serif text-3xl font-black">
                  {serversUp == null ? (apiDown ? '—' : '…') : serversUp ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center overflow-x-auto">
          <CharacterTable
            rows={rows}
            emptyText={apiDown ? 'Ranking indisponível no momento. Tente novamente mais tarde.' : 'Carregando ranking…'}
          />
          <a href="/ranking" className="btn-frame mt-4 h-11 self-center px-6 text-xs">
            Ver ranking completo
          </a>
        </div>
      </div>
    </section>
  )
}
