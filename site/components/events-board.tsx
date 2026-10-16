'use client'

import { BellRing } from 'lucide-react'
import { CountdownTiles } from '@/components/countdown-tiles'
import { SectionHeading } from '@/components/section-heading'
import { type LiveEvent, downloadReminder, formatTime, useEvents } from '@/lib/events'

const DAY = 24 * 60 * 60 * 1000

function startOfDay(ms: number) {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** "Agora", "Em breve" (menos de 30 min), "Hoje, 21:30" ou "Amanhã, 02:00". */
function chipLabel(event: LiveEvent, now: number) {
  if (event.open) return 'Agora'
  if (event.remaining < 30 * 60000) return 'Em breve'
  const day = startOfDay(event.start) === startOfDay(now) ? 'Hoje' : 'Amanhã'
  return `${day}, ${formatTime(event.start)}`
}

export function EventsBoard() {
  const { status, events, serverNow } = useEvents()
  const highlight = events[0]
  const loading = status === 'loading' || (status === 'ready' && serverNow === null)

  return (
    <section className="mx-auto flex min-h-svh max-w-7xl flex-col gap-10 px-4 pt-36 pb-24 md:px-[72px] lg:flex-row lg:gap-14">
      <div className="flex shrink-0 flex-col lg:w-[400px]">
        <SectionHeading
          eyebrow="Eventos"
          title={
            <>
              Próximo
              <br />
              evento.
            </>
          }
          description="Horários do servidor. Chegue cedo e entre pela hora certa."
        />

        <div className="mt-8 flex flex-col rounded-[44px] border border-accent/60 bg-[linear-gradient(160deg,rgb(60_42_10/0.6),rgb(8_14_34/0.95))] px-6 pt-7 pb-6 shadow-[0_0_60px_-14px_rgb(240_180_67/0.7),0_30px_60px_-26px_#000,inset_0_1px_0_rgb(255_255_255/0.14)] sm:px-7">
          {loading ? (
            <p className="text-muted-foreground">Carregando horários…</p>
          ) : status === 'error' ? (
            <p className="text-muted-foreground">Horários indisponíveis no momento. Tente novamente mais tarde.</p>
          ) : !highlight ? (
            <p className="text-muted-foreground">Nenhum evento agendado.</p>
          ) : (
            <>
              <p className="text-[11px] font-semibold tracking-[0.26em] text-accent uppercase">
                {highlight.open ? 'Entrada aberta' : 'Começa em'}
              </p>
              <p className="text-gold mt-2 mb-5 font-serif text-3xl font-black sm:text-[34px]">{highlight.name}</p>
              {highlight.open ? (
                <p className="rounded-[24px] border border-[#37e08a]/50 bg-[#37e08a]/10 py-6 text-center font-serif text-3xl font-black text-[#8ef0be]">
                  Acontecendo agora
                </p>
              ) : (
                <CountdownTiles ms={highlight.remaining} />
              )}
              {highlight.open ? null : (
                <button
                  type="button"
                  onClick={() => downloadReminder(highlight)}
                  className="btn-frame mt-5 h-[52px] text-xs"
                >
                  <BellRing className="size-4" aria-hidden />
                  Lembrar-me
                </button>
              )}
            </>
          )}
        </div>
        {highlight && !highlight.open ? (
          <p className="mt-3 px-4 text-xs text-muted-foreground">
            O lembrete baixa um arquivo de agenda com aviso 10 minutos antes.
          </p>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-4">
        {events.length === 0 && !loading && status !== 'error' ? (
          <p className="glass rounded-full px-7 py-5 text-center text-muted-foreground">Nenhum evento agendado.</p>
        ) : null}
        <ul className="flex flex-col gap-4">
          {events.map((event, index) => {
            const Icon = event.icon
            const first = index === 0
            return (
              <li
                key={event.id}
                className={`glass flex flex-wrap items-center gap-4 rounded-[36px] p-4 sm:flex-nowrap sm:gap-5 sm:rounded-full sm:py-0 sm:pr-8 sm:pl-5 sm:min-h-32 ${
                  first ? 'border-accent/55 shadow-[0_0_40px_-12px_rgb(240_180_67/0.6),0_24px_60px_-24px_#000]' : ''
                }`}
              >
                <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-[rgb(140_196_255/0.55)] bg-[radial-gradient(circle,rgb(90_162_255/0.4),rgb(61_139_255/0.08))] text-[#e6f1ff] shadow-[0_0_30px_-4px_var(--primary)] sm:size-[84px]">
                  <Icon className="size-8 sm:size-10" strokeWidth={1.6} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif text-xl font-black sm:text-[26px]">{event.name}</h3>
                  {event.description ? <p className="mt-1 text-sm text-muted-foreground">{event.description}</p> : null}
                  <span
                    className={`mt-2 inline-block rounded-full border px-3.5 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase ${
                      event.open
                        ? 'border-[#37e08a]/45 bg-[#37e08a]/10 text-[#8ef0be]'
                        : 'border-primary/30 bg-primary/15 text-[#a9bde0]'
                    }`}
                  >
                    {serverNow === null ? '' : chipLabel(event, serverNow)}
                  </span>
                </div>
                <div className="ml-auto text-right">
                  <p className="font-serif text-2xl font-black text-[#8cc4ff] sm:text-[30px]">{formatTime(event.start)}</p>
                  {event.schedule ? <p className="text-sm text-muted-foreground">{event.schedule}</p> : null}
                </div>
              </li>
            )
          })}
        </ul>

        {serverNow !== null && events.length > 0 ? <DayTimeline events={events} now={serverNow} /> : null}
      </div>
    </section>
  )
}

/** Barra do dia (00h–24h): progresso até agora e um marcador por início de evento hoje. */
function DayTimeline({ events, now }: { events: LiveEvent[]; now: number }) {
  const dayStart = startOfDay(now)
  const position = (ms: number) => `${((ms - dayStart) / DAY) * 100}%`
  const nextStart = events.find((event) => !event.open)?.start
  const markers = events
    .flatMap((event) => (event.today?.length ? event.today : [event.next]).map((iso) => new Date(iso).getTime()))
    .filter((ms) => ms >= dayStart && ms < dayStart + DAY)

  return (
    <div className="mt-2 rounded-[32px] border border-[rgb(130_175_255/0.26)] bg-[rgb(5_12_32/0.7)] px-6 py-5 sm:rounded-full sm:px-8">
      <div className="mb-3 flex justify-between text-[11px] tracking-[0.2em] text-[#6f86b3] uppercase" aria-hidden>
        <span>Hoje</span>
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>24h</span>
      </div>
      <div
        className="relative h-2.5 rounded-full bg-primary/15"
        role="img"
        aria-label={`Agora são ${formatTime(now)}; ${markers.length} horários de evento hoje`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#1d4fb8] to-ring"
          style={{ width: position(now) }}
        />
        {markers.map((ms) => (
          <span
            key={ms}
            className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
              ms === nextStart
                ? 'border-accent bg-accent shadow-[0_0_14px_var(--accent)]'
                : ms < now
                  ? 'border-ring bg-ring'
                  : 'border-ring bg-[#071230]'
            }`}
            style={{ left: position(ms) }}
            title={formatTime(ms)}
          />
        ))}
        <span
          className="absolute top-1/2 size-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-background bg-[#dce7ff] shadow-[0_0_14px_rgb(220_231_255/0.8)]"
          style={{ left: position(now) }}
          aria-hidden
        />
      </div>
    </div>
  )
}
