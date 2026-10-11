'use client'

import { useEffect, useState } from 'react'
import { SectionHeading } from '@/components/section-heading'
import { SERVER } from '@/lib/server-info'

const CLASSES = ['Dark Wizard', 'Dark Knight', 'Fairy Elf', 'Magic Gladiator', 'Dark Lord'] as const

type Row = { name: string; level: number; class: number; master: boolean }

export function Rankings() {
  const [online, setOnline] = useState<number | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [serversUp, setServersUp] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const [s, r] = await Promise.all([
          fetch(SERVER.apiBase + '/status').then((x) => x.json()),
          fetch(SERVER.apiBase + '/rankings').then((x) => x.json()),
        ])
        if (!alive) return
        if (s?.ok) {
          setOnline(s.online)
          setServersUp([44405, 55901, 55960, 55970].every((p) => s.ports?.[String(p)]))
        }
        if (r?.ok) setRows(r.rankings ?? [])
      } catch {
        /* mantém esqueleto */
      }
    }
    load()
    const t = setInterval(load, 60000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  return (
    <section id="rankings" className="mx-auto max-w-6xl px-4 py-24 md:px-6">
      <SectionHeading
        eyebrow="Servidor"
        title="Status e rankings"
        description="Jogadores online agora e top levels do Mu Reborn."
      />
      <div className="gold-frame bg-card p-6 md:p-8">
        <div className="mb-6 flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Online agora</p>
            <p className="font-serif text-3xl font-bold text-primary">{online ?? '…'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Servidores</p>
            <p className="font-serif text-3xl font-bold text-primary">
              {serversUp == null ? '…' : serversUp ? 'ON' : 'OFF'}
            </p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2">#</th>
              <th>Nome</th>
              <th>Classe</th>
              <th>Level</th>
              <th>Master</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name} className="border-t border-border">
                <td className="py-2 font-mono">{i + 1}</td>
                <td className="font-mono text-foreground">{r.name}</td>
                <td>{CLASSES[(r.class >> 4) % 5] ?? '?'}</td>
                <td className="font-mono">{r.level}</td>
                <td>{r.master ? '⭐' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-xs text-muted-foreground">
          Resets não têm ranking: o motor não guarda contador de resets.
        </p>
      </div>
    </section>
  )
}
