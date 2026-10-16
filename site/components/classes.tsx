import Image from 'next/image'
import { SectionHeading } from '@/components/section-heading'

const classes = [
  {
    name: 'Dark Knight',
    evolution: 'Blade Knight',
    image: '/images/dark-knight.png',
    position: 'object-[50%_30%]',
    text: 'Corpo a corpo puro. Muita vida, dano físico brutal e o temido Twisting Slash.',
  },
  {
    name: 'Dark Wizard',
    evolution: 'Soul Master',
    image: '/images/dark-wizard.png',
    position: 'object-[50%_20%]',
    text: 'Domina a magia arcana. Evil Spirit e Hellfire limpam mapas inteiros.',
  },
  {
    name: 'Fairy Elf',
    evolution: 'Muse Elf',
    image: '/images/fairy-elf.png',
    position: 'object-[50%_25%]',
    text: 'Arqueira e suporte. Buffs de defesa e dano que toda party quer por perto.',
  },
  {
    name: 'Magic Gladiator',
    evolution: 'Classe especial',
    image: '/images/magic-gladiator.png',
    position: 'object-[50%_25%]',
    text: 'Híbrido de espada e magia. Liberado ao alcançar o level 220 com outro personagem.',
  },
  {
    name: 'Dark Lord',
    evolution: 'Comandante',
    image: '',
    position: '',
    text: 'Lidera corvos e cavalos sombrios. Força bruta com comando e presença de campo.',
  },
]

export function Classes() {
  return (
    <section
      id="classes"
      className="bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgb(61_139_255/0.24),transparent_70%)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-24 md:px-16">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading eyebrow="Classes" title="Escolha seu caminho." />
          <p className="max-w-[340px] text-lg leading-relaxed text-muted-foreground md:text-right">
            As cinco classes da versão 99b, cada uma com seu estilo de jogo e sua evolução.
          </p>
        </div>
        <ul className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-5">
          {classes.map((cls) => (
            <li
              key={cls.name}
              className="group gold-ring relative h-[468px] overflow-hidden rounded-t-[108px] rounded-b-[30px]"
            >
              {cls.image ? (
                <Image
                  src={cls.image}
                  alt={`Arte do personagem ${cls.name}`}
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 50vw, 100vw"
                  className={`object-cover transition-transform duration-700 group-hover:scale-105 ${cls.position}`}
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgb(90_162_255/0.55),rgb(61_20_110/0.85)_55%,#08051a)]">
                  <svg viewBox="0 0 200 300" className="absolute inset-0 size-full" aria-hidden>
                    <g fill="none" stroke="#bfe0ff" strokeOpacity=".5">
                      <circle cx="100" cy="110" r="62" />
                      <circle cx="100" cy="110" r="44" strokeOpacity=".3" />
                      <path d="M100 38v144M28 110h144M49 59l102 102M151 59L49 161" strokeOpacity=".22" />
                    </g>
                    <text
                      x="100"
                      y="132"
                      textAnchor="middle"
                      fontFamily="var(--font-cinzel), serif"
                      fontWeight="900"
                      fontSize="64"
                      fill="#e9f0fb"
                    >
                      DL
                    </text>
                  </svg>
                </div>
              )}
              <div className="absolute inset-0 bg-[linear-gradient(0deg,#040916_4%,rgb(4_9_22/0.78)_34%,rgb(4_9_22/0)_62%)]" />
              <div className="absolute inset-x-5 bottom-[22px] text-center">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-accent uppercase">{cls.evolution}</p>
                <h3 className="mt-1.5 mb-2 font-serif text-xl font-black">{cls.name}</h3>
                <p className="text-[13px] leading-normal text-[#b4c4e4]">{cls.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
