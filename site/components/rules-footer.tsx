import { SectionHeading } from '@/components/section-heading'
import { SERVER } from '@/lib/server-info'

const rules = [
  'Servidor de amigos: nada de trapaças, hacks, bots ou exploração de bugs.',
  'Não divulgue o link do cliente nem o IP fora do grupo.',
  `Máximo de ${SERVER.maxAccountsPerIp} contas por IP.`,
  'Respeite os outros jogadores dentro e fora do jogo.',
  'Problemas? Fale com o administrador informando login, horário e o que aconteceu.',
]

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

export function Rules() {
  return (
    <section
      id="regras"
      className="bg-[radial-gradient(ellipse_60%_70%_at_0%_0%,rgb(61_139_255/0.22),transparent_70%)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-24 md:px-20 lg:flex-row lg:gap-[60px]">
        <div className="shrink-0 lg:w-[380px]">
          <SectionHeading
            eyebrow="Regras"
            title={
              <>
                O código
                <br />
                de honra.
              </>
            }
            description="Poucas regras, levadas a sério. Quem quebrar perde o convite."
          />
          <svg width="130" height="150" viewBox="0 0 130 150" className="mt-9 hidden lg:block" aria-hidden>
            <path
              d="M65 6l52 20v44c0 36-22 58-52 74C35 128 13 106 13 70V26z"
              fill="rgb(240 180 67 / 0.08)"
              stroke="#f0b443"
              strokeWidth="2"
            />
            <path
              d="M65 26l30 12v30c0 22-12 36-30 46-18-10-30-24-30-46V38z"
              fill="none"
              stroke="#f0b443"
              strokeOpacity=".5"
            />
            <path d="M65 52l12 18-12 18-12-18z" fill="#f0b443" />
          </svg>
        </div>
        <ol className="flex flex-1 flex-col gap-3">
          {rules.map((rule, index) => (
            <li
              key={rule}
              className="flex items-center gap-[22px] rounded-[30px] border border-[rgb(130_175_255/0.24)] bg-[linear-gradient(160deg,rgb(20_44_100/0.5),rgb(5_12_32/0.8))] py-[15px] pr-7 pl-[15px] text-[17px] leading-snug sm:rounded-full"
            >
              <span
                className="flex size-[46px] shrink-0 items-center justify-center rounded-full border border-accent/60 bg-card font-serif font-black text-[#f7c955] shadow-[0_0_18px_-4px_rgb(240_180_67/0.7)]"
                aria-hidden
              >
                {NUMERALS[index]}
              </span>
              {rule}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer className="px-4 pb-7 md:px-10">
      <div className="glass mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 rounded-[36px] px-10 py-6 text-center text-[13px] text-muted-foreground md:h-[72px] md:flex-row md:rounded-full md:py-0 md:text-left">
        <p className="font-serif text-lg font-black tracking-[0.22em]">
          <span className="text-chrome">MU</span> <span className="text-gold">REBORN</span>{' '}
          <span className="text-[11px] text-muted-foreground">{SERVER.version}</span>
        </p>
        <p className="text-pretty">Servidor privado sem fins lucrativos. MU Online é marca registrada da Webzen.</p>
      </div>
    </footer>
  )
}
