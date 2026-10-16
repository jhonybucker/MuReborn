import Image from 'next/image'
import { Coins, Gem, ShieldCheck, Users } from 'lucide-react'
import { SERVER } from '@/lib/server-info'

const features = [
  {
    icon: Gem,
    stat: SERVER.rates.drop,
    statClass: 'text-gold',
    title: 'Drop que vale ouro',
    text: 'Cada Jewel of Bless, Soul e Chaos tem peso real. Itens excelentes são conquista, não rotina.',
  },
  {
    icon: Coins,
    stat: SERVER.rates.zen,
    statClass: 'text-gold',
    title: 'Economia apertada',
    text: 'Zen escasso mantém o mercado entre jogadores vivo. Trocar e negociar faz parte da progressão.',
  },
  {
    icon: ShieldCheck,
    stat: SERVER.version,
    statClass: 'text-chrome',
    title: 'Fiel ao original',
    text: 'Classes clássicas, mapas originais e mecânicas da versão 99b. Sem cash shop, sem atalhos.',
  },
  {
    icon: Users,
    stat: String(SERVER.maxAccountsPerIp),
    statClass: 'text-chrome',
    title: 'Comunidade fechada',
    text: `Servidor piloto entre amigos, com no máximo ${SERVER.maxAccountsPerIp} contas por IP.`,
  },
]

export function ServerFeatures() {
  return (
    <section
      id="servidor"
      className="bg-[radial-gradient(ellipse_60%_70%_at_0%_0%,rgb(61_139_255/0.2),transparent_70%)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-24 sm:gap-6 md:px-[72px] lg:flex-row">
        <div className="gold-ring relative min-h-[300px] shrink-0 overflow-hidden rounded-t-[150px] rounded-b-[32px] sm:min-h-[420px] sm:rounded-t-[200px] sm:rounded-b-[40px] lg:w-[470px]">
          <Image
            src="/fundo.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 470px, 100vw"
            className="object-cover object-[64%_50%]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,#040916_8%,rgb(4_9_22/0.55)_45%,transparent_75%)]" />
          <div className="absolute inset-x-6 bottom-6 sm:inset-x-9 sm:bottom-9">
            <p className="eyebrow">O servidor</p>
            <h2 className="text-chrome mt-3 font-serif text-[32px] leading-[1.08] font-black sm:mt-3.5 sm:text-4xl md:text-[44px]">
              Hard de verdade.
              <br />
              Sem pressa,
              <br />
              sem atalho.
            </h2>
          </div>
        </div>

        <ul className="grid flex-1 grid-cols-2 gap-3 sm:gap-6">
          {features.map(({ icon: Icon, stat, statClass, title, text }) => (
            <li
              key={title}
              className="glass flex flex-col justify-between gap-4 rounded-[28px] bg-[linear-gradient(160deg,rgb(20_44_100/0.6),rgb(5_12_32/0.9))] p-4 sm:min-h-[260px] sm:gap-6 sm:rounded-[40px] sm:px-8 sm:py-7"
            >
              <div className="flex items-start justify-between">
                <span className={`font-serif text-[40px] leading-none font-black sm:text-7xl ${statClass}`}>{stat}</span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full sm:size-13 border border-[rgb(140_196_255/0.45)] bg-primary/15 text-[#bfe0ff] shadow-[0_0_22px_-4px_var(--primary)]">
                  <Icon className="size-4 sm:size-6" strokeWidth={1.8} aria-hidden />
                </span>
              </div>
              <div>
                <h3 className="mb-1.5 font-serif text-[15px] leading-tight font-bold sm:mb-2 sm:text-[22px]">{title}</h3>
                <p className="text-[13px] leading-snug text-[#9db2d9] sm:text-base sm:leading-relaxed">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
