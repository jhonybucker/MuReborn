import Image from 'next/image'
import { SectionHeading } from '@/components/section-heading'

const classes = [
  {
    name: 'Dark Knight',
    evolution: 'Blade Knight',
    image: '/images/dark-knight.png',
    text: 'Corpo a corpo puro. Muita vida, dano físico brutal e o temido Twisting Slash.',
  },
  {
    name: 'Dark Wizard',
    evolution: 'Soul Master',
    image: '/images/dark-wizard.png',
    text: 'Domina a magia arcana. Evil Spirit e Hellfire limpam mapas inteiros.',
  },
  {
    name: 'Fairy Elf',
    evolution: 'Muse Elf',
    image: '/images/fairy-elf.png',
    text: 'Arqueira e suporte. Buffs de defesa e dano que toda party quer por perto.',
  },
  {
    name: 'Magic Gladiator',
    evolution: 'Classe especial',
    image: '/images/magic-gladiator.png',
    text: 'Híbrido de espada e magia. Liberado ao alcançar o level 220 com outro personagem.',
  },
  {
    name: 'Dark Lord',
    evolution: 'Comandante',
    image: '',
    text: 'Lidera corvos e cavalos sombrios. Força bruta com comando e presença de campo.',
  },
]

export function Classes() {
  return (
    <section id="classes" className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-24 md:px-6">
      <SectionHeading
        eyebrow="Classes"
        title="Escolha seu caminho."
        description="As cinco classes da versão 99b, cada uma com seu estilo de jogo e sua evolução."
      />
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {classes.map((cls) => (
          <li key={cls.name} className="group gold-frame flex flex-col overflow-hidden bg-card">
            {cls.image ? (
              <div className="relative aspect-[3/4] overflow-hidden">
                <Image
                  src={cls.image}
                  alt={`Arte do personagem ${cls.name}`}
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
              </div>
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center bg-gradient-to-b from-accent/30 to-card">
                <span className="font-serif text-6xl font-black text-primary">DL</span>
              </div>
            )}
            <div className="flex flex-col gap-2 p-5">
              <p className="text-xs uppercase tracking-widest text-primary">{cls.evolution}</p>
              <h3 className="font-serif text-xl font-bold tracking-wide">{cls.name}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{cls.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
