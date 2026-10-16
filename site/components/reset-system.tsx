import { SectionHeading } from '@/components/section-heading'
import { SERVER } from '@/lib/server-info'

const fmt = (n: number) => n.toLocaleString('pt-BR')

const stages = [
  {
    level: `Level 1 → ${SERVER.resetLevel}`,
    title: 'Evolua',
    text: `Suba até o level ${SERVER.resetLevel} distribuindo seus pontos de atributo como quiser.`,
    height: 'md:h-[250px]',
  },
  {
    level: `Level ${SERVER.resetLevel}`,
    title: 'Reset acumulativo',
    text: 'Seu personagem volta ao level 1, mas todos os pontos conquistados ficam com você.',
    height: 'md:h-[290px]',
  },
  {
    level: `Atributos ${fmt(SERVER.statCap)}`,
    title: 'Teto atingido',
    text: `Os atributos param em ${fmt(SERVER.statCap)}. Encheu tudo? Pronto para o próximo passo.`,
    height: 'md:h-[335px]',
  },
  {
    level: `Full + level ${SERVER.resetLevel}`,
    title: 'Master reset',
    text: `Libera o teto de atributos até ${fmt(SERVER.masterStatCap)}. Para quem chegou ao limite.`,
    height: 'md:h-[385px]',
  },
]

export function ResetSystem() {
  return (
    <section
      id="reset"
      className="overflow-hidden bg-[radial-gradient(ellipse_50%_60%_at_90%_10%,rgb(240_180_67/0.16),transparent_70%),radial-gradient(ellipse_70%_50%_at_20%_100%,rgb(30_80_200/0.28),transparent_70%)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-20 px-4 pt-24 md:px-20">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
          <SectionHeading
            eyebrow="Sistema de reset"
            title={
              <>
                Cada reset
                <br />
                fica com você.
              </>
            }
          />
          <div className="md:text-right">
            <p className="text-[11px] tracking-[0.26em] text-muted-foreground uppercase">Teto de atributos</p>
            <p className="mt-2.5 flex items-baseline gap-4 font-serif md:justify-end">
              <span className="text-3xl text-[#6f86b3] line-through decoration-[#6f86b3]/50">{fmt(SERVER.statCap)}</span>
              <span className="text-[28px] text-accent" aria-hidden>
                →
              </span>
              <span className="text-gold text-5xl leading-none font-black md:text-[64px]">{fmt(SERVER.masterStatCap)}</span>
            </p>
          </div>
        </div>

        <ol className="grid items-end gap-14 md:grid-cols-4 md:gap-5">
          {stages.map((stage, index) => {
            const master = index === stages.length - 1
            return (
              <li
                key={stage.title}
                className={`relative rounded-t-[44px] border border-b-0 px-6 pt-[70px] pb-7 text-center ${stage.height} ${
                  master
                    ? 'border-accent/70 bg-[linear-gradient(180deg,rgb(240_180_67/0.38),rgb(40_26_6/0.95))] shadow-[0_0_70px_-12px_rgb(240_180_67/0.7)]'
                    : 'border-[rgb(130_175_255/0.3)] bg-[linear-gradient(180deg,rgb(40_90_200/0.5),rgb(8_18_46/0.95))]'
                }`}
              >
                <span
                  className={`absolute -top-[30px] left-1/2 flex size-[60px] -translate-x-1/2 items-center justify-center rounded-full border-2 font-serif text-[26px] font-black ${
                    master
                      ? 'border-[#f7c955] bg-gradient-to-b from-[#fff3c4] to-[#c9780f] text-[#2a1700] shadow-[0_0_34px_2px_rgb(240_180_67/0.8)]'
                      : 'border-ring bg-[#071230] text-[#bfe0ff] shadow-[0_0_28px_-2px_var(--primary)]'
                  }`}
                >
                  {index + 1}
                </span>
                <p className="text-xs font-semibold tracking-[0.22em] text-accent uppercase">{stage.level}</p>
                <h3 className={`mt-2.5 mb-3 font-serif font-bold ${master ? 'text-gold text-[28px]' : 'text-2xl'}`}>
                  {stage.title}
                </h3>
                <p className={`leading-relaxed ${master ? 'text-[#e8d6a8]' : 'text-[#a9bde0]'}`}>{stage.text}</p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
