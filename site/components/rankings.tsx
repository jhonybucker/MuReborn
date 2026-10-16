'use client'

import { useEffect, useState } from 'react'
import { SectionHeading } from '@/components/section-heading'
import { className } from '@/lib/mu'
import { SERVER } from '@/lib/server-info'

// Ouro, prata e bronze para o pódio.
const MEDALS = [
  'bg-gradient-to-b from-[#fff3c4] to-[#c9780f] text-[#2a1700] border-0',
  'bg-gradient-to-b from-[#f2f6ff] to-[#8d9dbb] text-[#0b1330] border-0',
  'bg-gradient-to-b from-[#f0b07a] to-[#8a4a1c] text-[#1f0e02] border-0',
]

type Row = { name: string; level: number; class: number; master: boolean; resets: number }

// Sem resposta da API em 10s, mostra indisponível em vez de ficar carregando para sempre.
const getJson = (path: string) =>
  fetch(SERVER.apiBase + path, { signal: AbortSignal.timeout(10000) }).then((x) => {
    if (!x.ok) throw new Error(String(x.status))
    return x.json()
  })

export function Rankings() {
  const [online, setOnline] = useState<number | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [serversUp, setServersUp] = useState<boolean | null>(null)
  const [apiDown, setApiDown] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      const [s, r] = await Promise.allSettled([getJson('/status'), getJson('/rankings')])
      if (!alive) return
      const status = s.status === 'fulfilled' && s.value?.ok ? s.value : null
      const ranking = r.status === 'fulfilled' && r.value?.ok ? r.value : null
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
          <table className="w-full min-w-[560px] border-separate border-spacing-y-2.5">
            <thead>
              <tr className="text-[11px] tracking-[0.22em] text-[#6f86b3] uppercase">
                <th className="w-14" />
                <th className="text-left font-normal">Personagem</th>
                <th className="w-40 font-normal">Classe</th>
                <th className="w-20 text-right font-normal">Level</th>
                <th className="w-20 text-right font-normal">Resets</th>
                <th className="w-12 pr-7 font-normal">
                  <abbr title="Master reset" className="no-underline">
                    M
                  </abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="glass rounded-full px-7 py-5 text-center text-muted-foreground">
                    {apiDown ? 'Ranking indisponível no momento. Tente novamente mais tarde.' : 'Carregando ranking…'}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={r.name}
                    className={`[&>td]:border-y [&>td]:bg-[rgb(12_28_66/0.7)] [&>td:first-child]:rounded-l-full [&>td:first-child]:border-l [&>td:last-child]:rounded-r-full [&>td:last-child]:border-r ${
                      i === 0
                        ? '[&>td]:border-accent/60 shadow-[0_0_36px_-10px_var(--accent)]'
                        : '[&>td]:border-[rgb(130_175_255/0.26)]'
                    }`}
                  >
                    <td className="py-2.5 pl-2.5">
                      <span
                        className={`flex size-11 items-center justify-center rounded-full border border-input bg-secondary font-serif text-lg font-black text-muted-foreground ${
                          MEDALS[i] ?? ''
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="font-serif text-lg font-bold">{r.name}</td>
                    <td className="text-center">
                      <span className="inline-block w-36 rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5 text-xs tracking-[0.12em] text-[#a9bde0] uppercase">
                        {className(r.class)}
                      </span>
                    </td>
                    <td className="text-right font-serif text-2xl font-black text-[#8cc4ff]">{r.level}</td>
                    <td className="text-right text-muted-foreground">↺ {r.resets}</td>
                    <td className="pr-7 text-center text-xl text-accent">
                      {r.master ? <span aria-label="Master reset">★</span> : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
