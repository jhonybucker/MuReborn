import Image from 'next/image'
import { SectionHeading } from '@/components/section-heading'

const classes = [
  {
    name: 'Dark Knight',
    evolution: 'Blade Knight',
    image: '/images/classes/dark-knight.webp',
    position: 'object-[50%_20%]',
    text: 'Corpo a corpo puro. Muita vida, dano físico brutal e o temido Twisting Slash.',
  },
  {
    name: 'Dark Wizard',
    evolution: 'Soul Master',
    image: '/images/classes/dark-wizard.webp',
    position: 'object-[50%_15%]',
    text: 'Domina a magia arcana. Evil Spirit e Hellfire limpam mapas inteiros.',
  },
  {
    name: 'Fairy Elf',
    evolution: 'Muse Elf',
    image: '/images/classes/fairy-elf.webp',
    position: 'object-[50%_15%]',
    text: 'Arqueira e suporte. Buffs de defesa e dano que toda party quer por perto.',
  },
  {
    name: 'Magic Gladiator',
    evolution: 'Classe especial',
    image: '/images/classes/magic-gladiator.webp',
    position: 'object-[50%_15%]',
    text: 'Híbrido de espada e magia. Liberado ao alcançar o level 220 com outro personagem.',
  },
  {
    name: 'Dark Lord',
    evolution: 'Comandante',
    image: '/images/classes/dark-lord.webp',
    position: 'object-[50%_15%]',
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
        {/* Celular e tablet: carrossel com arraste lateral e encaixe no centro; desktop: 5 colunas. */}
        <ul
          tabIndex={0}
          aria-label="Classes: arraste para o lado para ver todas"
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 py-4 md:-mx-16 md:px-16 [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-ring lg:mx-0 lg:grid lg:snap-none lg:grid-cols-5 lg:gap-[18px] lg:overflow-visible lg:p-0 [&::-webkit-scrollbar]:hidden"
        >
          {classes.map((cls) => (
            <li
              key={cls.name}
              className="group gold-ring relative h-[440px] w-[78%] shrink-0 snap-center overflow-hidden rounded-t-[108px] rounded-b-[30px] sm:w-[44%] lg:h-[468px] lg:w-auto"
            >
              <Image
                src={cls.image}
                alt={`Arte do personagem ${cls.name}`}
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 640px) 44vw, 78vw"
                className={`object-cover transition-transform duration-700 group-hover:scale-105 ${cls.position}`}
              />
              <div className="absolute inset-0 bg-[linear-gradient(0deg,#040916_4%,rgb(4_9_22/0.78)_34%,rgb(4_9_22/0)_62%)]" />
              <div className="absolute inset-x-5 bottom-[22px] text-center">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-accent uppercase">{cls.evolution}</p>
                <h3 className="mt-1.5 mb-2 font-serif text-xl font-black">{cls.name}</h3>
                <p className="text-[13px] leading-normal text-[#b4c4e4]">{cls.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="-mt-4 flex items-center justify-center gap-2 text-xs tracking-[0.2em] text-muted-foreground uppercase lg:hidden" aria-hidden>
          Arraste para ver todas <span className="text-accent">→</span>
        </p>
      </div>
    </section>
  )
}
