'use client'

import { CalendarClock, Castle, Flame, type LucideIcon, Skull, Swords } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useNow } from '@/lib/use-now'

// Formato de GET /api/events: docs/api-site.md.
export type GameEvent = {
  id: string
  name: string
  /** Próximo início, ISO 8601 com fuso. */
  next: string
  /** Por quantos minutos a entrada fica aberta depois do início. */
  entryMinutes: number
  /** Texto livre da frequência, ex.: "A cada 2 horas". */
  schedule?: string
  map?: string
  description?: string
  /** Todos os inícios de hoje (ISO), para a linha do tempo do dia. */
  today?: string[]
}

export type LiveEvent = GameEvent & {
  start: number
  open: boolean
  remaining: number
  icon: LucideIcon
  description?: string
}

// Ícone e descrição padrão dos eventos conhecidos; a API pode mandar outra descrição.
const KNOWN: Record<string, { icon: LucideIcon; description: string }> = {
  'blood-castle': { icon: Castle, description: 'Invasão ao castelo em party, com tempo limite.' },
  'devil-square': { icon: Skull, description: 'Arena de combate contra hordas de monstros.' },
  'chaos-castle': { icon: Swords, description: 'Batalha de sobrevivência: só o último de pé vence.' },
}

// Invasões chegam como invasion-0, invasion-1… (Skeleton King, Red Dragon, Dourados, White Wizard).
const INVASION = { icon: Flame, description: 'Invasão de monstros pelos mapas. Junte-se para derrotar o chefe.' }

const knownEvent = (id: string) => KNOWN[id] ?? (id.startsWith('invasion') ? INVASION : undefined)

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; events: GameEvent[]; offset: number }

/**
 * Busca os eventos e devolve a lista viva: aberto agora primeiro, depois por horário.
 * Usa o relógio do servidor (o do jogador pode estar adiantado ou atrasado).
 */
export function useEvents() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const now = useNow(1000)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const body = await api<{ now: string; events: GameEvent[] }>('/events')
        if (!alive) return
        setState({ kind: 'ready', events: body.events ?? [], offset: new Date(body.now).getTime() - Date.now() })
      } catch {
        if (alive) setState({ kind: 'error' })
      }
    }
    load()
    const refresh = setInterval(load, 300000)
    return () => {
      alive = false
      clearInterval(refresh)
    }
  }, [])

  const serverNow = state.kind === 'ready' && now !== null ? now + state.offset : null
  const events: LiveEvent[] =
    state.kind === 'ready' && serverNow !== null
      ? state.events
          .map((event) => {
            const start = new Date(event.next).getTime()
            const known = knownEvent(event.id)
            return {
              ...event,
              start,
              open: serverNow >= start && serverNow < start + event.entryMinutes * 60000,
              remaining: start - serverNow,
              icon: known?.icon ?? CalendarClock,
              description: event.description ?? known?.description,
            }
          })
          // Some quando a entrada fecha; volta com o próximo horário na atualização seguinte.
          .filter((event) => event.open || event.remaining > 0)
          .sort((a, b) => Number(b.open) - Number(a.open) || a.start - b.start)
      : []

  return { status: state.kind, events, serverNow }
}

export const formatTime = (iso: string | number) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const icsDate = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** Baixa um .ics do evento com aviso 10 minutos antes, para o jogador pôr na agenda do celular. */
export function downloadReminder(event: LiveEvent) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MU Reborn//Eventos//PT',
    'BEGIN:VEVENT',
    `UID:${event.id}-${event.start}@mu-reborn`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(event.start + event.entryMinutes * 60000)}`,
    `SUMMARY:${event.name} — MU Reborn`,
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${event.name} começa em 10 minutos`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${event.id}.ics`
  link.click()
  URL.revokeObjectURL(url)
}
