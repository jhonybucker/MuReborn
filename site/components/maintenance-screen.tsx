'use client'

import Image from 'next/image'
import { Check, Wrench } from 'lucide-react'
import { CountdownTiles } from '@/components/countdown-tiles'
import { DiscordLink } from '@/components/discord-link'
import { MAINTENANCE, type MaintenanceStep } from '@/lib/maintenance'
import { SERVER } from '@/lib/server-info'
import { useNow } from '@/lib/use-now'

const STEP_STYLE: Record<MaintenanceStep['status'], { mark: React.ReactNode; className: string; sr: string }> = {
  done: {
    mark: <Check className="size-4" strokeWidth={3} aria-hidden />,
    className: 'bg-[#37e08a]/20 text-[#37e08a]',
    sr: 'concluído',
  },
  doing: {
    mark: <span className="size-2.5 animate-pulse rounded-full bg-accent" aria-hidden />,
    className: 'bg-accent/20',
    sr: 'em andamento',
  },
  todo: {
    mark: <span className="size-2.5 rounded-full border border-muted-foreground" aria-hidden />,
    className: 'bg-[rgb(130_175_255/0.14)]',
    sr: 'a fazer',
  },
}

export function MaintenanceScreen() {
  const now = useNow(1000)
  const until = MAINTENANCE.until ? new Date(MAINTENANCE.until).getTime() : null
  const remaining = until !== null && now !== null ? until - now : null

  return (
    <main className="relative isolate flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden px-4 py-12">
      <Image src="/fundo.webp" alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[60%_40%]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_70%_at_50%_50%,rgb(4_9_22/0.35),rgb(4_9_22/0.92)_80%),linear-gradient(0deg,#040916_0%,transparent_40%)]" />

      <p className="font-serif text-xl font-black tracking-[0.24em]">
        <span className="text-chrome">MU</span> <span className="text-gold">REBORN</span>{' '}
        <span className="text-[11px] tracking-[0.1em] text-muted-foreground">{SERVER.version}</span>
      </p>

      <section className="w-full max-w-[620px] rounded-[44px] border border-accent/50 bg-[linear-gradient(160deg,rgb(22_50_115/0.62),rgb(5_12_32/0.95))] px-6 pt-10 pb-9 text-center shadow-[0_0_0_8px_rgb(240_180_67/0.06),0_50px_100px_-24px_#000,inset_0_1px_0_rgb(255_255_255/0.14)] sm:rounded-[56px] sm:px-12 sm:pt-11">
        <span className="mx-auto mb-5 flex size-[84px] items-center justify-center rounded-full border border-accent/70 bg-[radial-gradient(circle,rgb(240_180_67/0.35),rgb(240_180_67/0.05))] text-[#f7dfa4] shadow-[0_0_40px_-4px_rgb(240_180_67/0.6)]">
          <Wrench className="size-10" strokeWidth={1.7} aria-hidden />
        </span>
        <p className="eyebrow justify-center after:h-px after:w-11 after:bg-gradient-to-l after:from-transparent after:to-accent after:content-['']">
          Manutenção programada
        </p>
        <h1 className="text-chrome mt-4 mb-3 font-serif text-4xl leading-[1.05] font-black sm:text-[50px]">
          Estamos afiando
          <br />
          as espadas.
        </h1>
        <p className="mb-7 leading-relaxed text-[#a9bde0] sm:text-[17px]">{MAINTENANCE.message}</p>

        <p className="mb-3 text-[11px] font-semibold tracking-[0.26em] text-accent uppercase">Previsão de retorno</p>
        {until === null ? (
          <p className="mb-7 font-serif text-2xl font-bold">Sem previsão definida</p>
        ) : remaining !== null && remaining <= 0 ? (
          <p className="mb-7 font-serif text-2xl font-bold">Voltando a qualquer momento</p>
        ) : (
          <div className="mb-7">
            <CountdownTiles ms={remaining} tone="gold" />
          </div>
        )}

        {MAINTENANCE.steps.length > 0 ? (
          <ol className="flex flex-col gap-2 text-left">
            {MAINTENANCE.steps.map((step) => {
              const style = STEP_STYLE[step.status]
              return (
                <li
                  key={step.label}
                  className={`flex items-center gap-3.5 rounded-full border border-[rgb(130_175_255/0.2)] bg-[rgb(4_9_22/0.55)] py-3 pr-5 pl-3 text-[15px] text-[#cfdcf5] ${
                    step.status === 'todo' ? 'opacity-60' : ''
                  }`}
                >
                  <span className={`flex size-[30px] shrink-0 items-center justify-center rounded-full ${style.className}`}>
                    {style.mark}
                  </span>
                  {step.label}
                  <span className="sr-only">({style.sr})</span>
                </li>
              )
            })}
          </ol>
        ) : null}
      </section>

      <div className="flex flex-col items-center gap-4 text-center text-[13px] text-muted-foreground">
        <DiscordLink className="h-11 px-5 text-xs" />
        <p>
          {SERVER.discordUrl ? 'Acompanhe os avisos no Discord do servidor · ' : ''}Servidor privado sem fins
          lucrativos
        </p>
      </div>
    </main>
  )
}
