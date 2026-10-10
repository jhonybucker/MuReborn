import { SectionHeading } from '@/components/section-heading'
import { SERVER } from '@/lib/server-info'

const fmt = (n: number) => n.toLocaleString('pt-BR')

const stages = [
  {
    level: 'Level 1 → 400',
    title: 'Evolua',
    text: `Suba até o level ${SERVER.resetLevel} distribuindo seus pontos de atributo como quiser.`,
  },
  {
    level: `Level ${SERVER.resetLevel}`,
    title: 'Reset acumulativo',
    text: 'Seu personagem volta ao level 1, mas todos os pontos conquistados ficam com você. A cada reset, mais forte.',
  },
  {
    level: `Atributos ${fmt(SERVER.statCap)}`,
    title: 'Teto atingido',
    text: `Os atributos param em ${fmt(SERVER.statCap)}. Encheu tudo? Você está pronto para o próximo passo.`,
  },
  {
    level: 'Full + level 400',
    title: 'Master reset',
    text: `Com atributos no máximo e level ${SERVER.resetLevel}, o master reset libera o teto até ${fmt(SERVER.masterStatCap)}.`,
  },
]

export function ResetSystem() {
  return (
    <section id="reset" className="border-y border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-24 md:px-6">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <SectionHeading
            eyebrow="Sistema de reset"
            title="Cada reset fica com você."
            description="No reset acumulativo nada se perde: os pontos de cada ciclo somam aos anteriores, até você romper o limite com o master reset."
          />
          <div className="flex shrink-0 items-baseline gap-3 font-serif">
            <span className="text-2xl text-muted-foreground">{fmt(SERVER.statCap)}</span>
            <span className="text-primary" aria-hidden>
              →
            </span>
            <span className="text-gold text-5xl font-black">{fmt(SERVER.masterStatCap)}</span>
            <span className="sr-only">teto de atributos após o master reset</span>
          </div>
        </div>

        <ol className="grid gap-8 md:grid-cols-4 md:gap-0">
          {stages.map((stage, index) => (
            <li key={stage.title} className="relative flex flex-col gap-4 md:pr-8">
              <div className="flex items-center gap-4">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full border font-serif font-bold ${
                    index === stages.length - 1
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-primary/60 bg-background text-primary'
                  }`}
                >
                  {index + 1}
                </span>
                {index < stages.length - 1 ? (
                  <span className="hidden h-px flex-1 bg-gradient-to-r from-primary/60 to-primary/10 md:block" aria-hidden />
                ) : null}
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent-foreground/70">{stage.level}</p>
              <h3 className="font-serif text-xl font-bold tracking-wide">{stage.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{stage.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
