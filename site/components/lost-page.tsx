import Image from 'next/image'
import { CalendarClock, Download, Trophy, UserRound } from 'lucide-react'
import { CharacterSearch } from '@/components/character-search'

// Faíscas: posição, tamanho, atraso e opacidade fixos para o HTML do servidor e do navegador baterem.
const EMBERS = [
  { left: '9%', top: '78%', size: 5, delay: '0s', opacity: 1 },
  { left: '24%', top: '92%', size: 6, delay: '1.4s', opacity: 0.8 },
  { left: '37%', top: '86%', size: 4, delay: '3.1s', opacity: 0.7 },
  { left: '50%', top: '74%', size: 3, delay: '2.2s', opacity: 0.6 },
  { left: '64%', top: '90%', size: 5, delay: '4.3s', opacity: 0.7 },
  { left: '78%', top: '82%', size: 4, delay: '0.8s', opacity: 0.8 },
  { left: '92%', top: '88%', size: 5, delay: '3.7s', opacity: 0.9 },
]

const SHORTCUTS = [
  { href: '/eventos', label: 'Eventos', icon: CalendarClock },
  { href: '/ranking', label: 'Ranking', icon: Trophy },
  { href: '/downloads', label: 'Downloads', icon: Download },
  { href: '/painel', label: 'Minha conta', icon: UserRound },
]

/** Layout das páginas de erro (404 e erro inesperado), na tela "Erro 404" do canvas. */
export function LostPage({
  eyebrow,
  title,
  text,
  badge,
  caption,
  actions,
}: {
  eyebrow: string
  title: React.ReactNode
  text: string
  badge: string
  caption: string
  actions: React.ReactNode
}) {
  return (
    <section className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_50%_70%_at_78%_40%,rgb(61_139_255/0.3),transparent_70%),radial-gradient(ellipse_50%_50%_at_0%_100%,rgb(240_180_67/0.12),transparent_70%)]">
      {EMBERS.map((ember) => (
        <span
          key={ember.left}
          className="animate-ember absolute -z-10 rounded-full bg-[#ffb04a] shadow-[0_0_10px_2px_rgb(255_160_60/0.8)]"
          style={{
            left: ember.left,
            top: ember.top,
            width: ember.size,
            height: ember.size,
            opacity: ember.opacity,
            animationDelay: ember.delay,
          }}
          aria-hidden
        />
      ))}

      <div className="mx-auto flex min-h-svh max-w-7xl flex-col-reverse items-center gap-10 px-4 pt-28 pb-16 md:px-[72px] lg:flex-row lg:justify-between lg:gap-16 lg:pt-32">
        <div className="flex w-full max-w-[560px] flex-col">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="text-chrome mt-5 mb-4 font-serif text-5xl leading-[1.02] font-black md:text-[66px]">{title}</h1>
          <p className="max-w-[470px] text-lg leading-relaxed text-[#a9bde0] md:text-[19px]">{text}</p>
          <div className="mt-9 flex flex-wrap gap-3.5">{actions}</div>

          <div className="mt-10 flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#a9bde0] uppercase">Procurando um personagem?</p>
            <CharacterSearch />
          </div>

          <nav aria-label="Atalhos" className="mt-8">
            <ul className="flex flex-wrap gap-2">
              {SHORTCUTS.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <a
                    href={href}
                    className="flex h-10 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 text-xs tracking-[0.12em] text-[#a9bde0] uppercase transition-colors hover:border-accent hover:text-accent"
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="gold-ring relative h-[320px] w-full max-w-[430px] shrink-0 overflow-hidden rounded-t-[215px] rounded-b-[48px] shadow-[0_0_0_8px_rgb(240_180_67/0.07),0_0_90px_-10px_rgb(61_139_255/0.6),0_40px_80px_-20px_#000] lg:h-[608px]">
          <Image src="/fundo.webp" alt="" fill sizes="430px" className="object-cover object-[62%_55%]" priority />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(4_9_22/0.72)_0%,rgb(4_9_22/0.1)_45%,rgb(4_9_22/0.85)_100%)]" />
          <p
            className="text-gold absolute inset-x-0 top-16 text-center font-serif text-[110px] leading-none font-black tracking-[0.04em] drop-shadow-[0_0_30px_rgb(255_160_40/0.5)] lg:top-[92px] lg:text-[150px]"
            aria-hidden
          >
            {badge}
          </p>
          <p className="absolute inset-x-0 bottom-8 text-center text-xs tracking-[0.34em] text-[#cfdcf5] uppercase">
            {caption}
          </p>
        </div>
      </div>
    </section>
  )
}
