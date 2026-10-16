'use client'

import { CalendarClock, Newspaper } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { formatTime, useEvents } from '@/lib/events'
import { NEWS } from '@/lib/news'
import { splitDuration } from '@/lib/use-now'

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function formatCountdown(ms: number) {
  const { hours, minutes, seconds } = splitDuration(ms)
  return hours === '00' ? `${minutes}:${seconds}` : `${Number(hours)}:${minutes}:${seconds}`
}

export function NewsEvents() {
  const { status, events, serverNow } = useEvents()
  const [highlight, ...rest] = events

  return (
    <section
      id="noticias"
      className="bg-[radial-gradient(ellipse_60%_60%_at_100%_0%,rgb(240_180_67/0.1),transparent_70%)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-24 md:px-20">
        <SectionHeading eyebrow="Notícias e eventos" title="O que está acontecendo." />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <ol className="flex flex-col gap-4">
            {NEWS.map((item) => (
              <li
                key={item.date + item.title}
                className="glass flex flex-col gap-3 rounded-[32px] bg-[linear-gradient(160deg,rgb(20_44_100/0.55),rgb(5_12_32/0.85))] p-6 md:p-8"
              >
                <div className="flex items-center gap-3 text-xs tracking-[0.2em] text-accent uppercase">
                  <Newspaper className="size-4" aria-hidden />
                  <time dateTime={item.date}>{formatDate(item.date)}</time>
                </div>
                <h3 className="font-serif text-2xl font-bold">{item.title}</h3>
                <p className="leading-relaxed text-[#a9bde0]">{item.text}</p>
              </li>
            ))}
          </ol>

          <div className="glass flex flex-col gap-5 self-start rounded-[32px] bg-[linear-gradient(160deg,rgb(22_50_115/0.65),rgb(5_12_32/0.92))] p-6 md:p-8">
            <p className="flex items-center gap-3 text-xs tracking-[0.2em] text-accent uppercase">
              <CalendarClock className="size-4" aria-hidden />
              Próximos eventos
            </p>

            {status === 'loading' || (status === 'ready' && serverNow === null) ? (
              <p className="text-muted-foreground">Carregando horários…</p>
            ) : status === 'error' ? (
              <p className="text-muted-foreground">Horários indisponíveis no momento. Tente novamente mais tarde.</p>
            ) : !highlight ? (
              <p className="text-muted-foreground">Nenhum evento agendado.</p>
            ) : (
              <>
                <div className="rounded-[24px] border border-accent/50 bg-[rgb(4_9_22/0.55)] p-5 text-center shadow-[0_0_36px_-12px_var(--accent)]">
                  <p className="font-serif text-xl font-bold">{highlight.name}</p>
                  {highlight.map ? <p className="text-sm text-muted-foreground">{highlight.map}</p> : null}
                  {highlight.open ? (
                    <p className="mt-3 font-serif text-3xl font-black text-[#37e08a]">Acontecendo agora</p>
                  ) : (
                    <p className="text-gold mt-3 font-serif text-5xl font-black tabular-nums">
                      {formatCountdown(highlight.remaining)}
                    </p>
                  )}
                  <p className="mt-2 text-xs tracking-[0.16em] text-muted-foreground uppercase">
                    {highlight.open ? 'Entrada aberta' : `Começa às ${formatTime(highlight.next)}`}
                  </p>
                </div>

                {rest.length > 0 ? (
                  <ul className="flex flex-col">
                    {rest.slice(0, 4).map((event) => (
                      <li
                        key={event.id}
                        className="flex items-center justify-between gap-4 border-b border-[rgb(130_175_255/0.15)] py-3 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{event.name}</p>
                          {event.schedule ? <p className="text-xs text-muted-foreground">{event.schedule}</p> : null}
                        </div>
                        <div className="shrink-0 text-right">
                          {event.open ? (
                            <p className="font-semibold text-[#37e08a]">Agora</p>
                          ) : (
                            <>
                              <p className="font-mono text-[#8cc4ff] tabular-nums">{formatCountdown(event.remaining)}</p>
                              <p className="text-xs text-muted-foreground">às {formatTime(event.next)}</p>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
            <a href="/eventos" className="btn-frame h-11 text-xs">
              Ver todos os eventos
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
