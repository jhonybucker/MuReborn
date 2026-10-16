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
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-24 md:px-[72px] lg:flex-row">
        <div className="gold-ring relative min-h-[420px] shrink-0 overflow-hidden rounded-t-[200px] rounded-b-[40px] lg:w-[470px]">
          <Image
            src="/fundo.png"
            alt=""
            fill
            sizes="(min-width: 1024px) 470px, 100vw"
            className="object-cover object-[64%_50%]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,#040916_8%,rgb(4_9_22/0.55)_45%,transparent_75%)]" />
          <div className="absolute inset-x-9 bottom-9">
            <p className="eyebrow">O servidor</p>
            <h2 className="text-chrome mt-3.5 font-serif text-4xl leading-[1.08] font-black md:text-[44px]">
              Hard de verdade.
              <br />
              Sem pressa,
              <br />
              sem atalho.
            </h2>
          </div>
        </div>

        <ul className="grid flex-1 gap-6 sm:grid-cols-2">
          {features.map(({ icon: Icon, stat, statClass, title, text }) => (
            <li
              key={title}
              className="glass flex min-h-[260px] flex-col justify-between gap-6 rounded-[40px] bg-[linear-gradient(160deg,rgb(20_44_100/0.6),rgb(5_12_32/0.9))] px-8 py-7"
            >
              <div className="flex items-start justify-between">
                <span className={`font-serif text-7xl leading-none font-black ${statClass}`}>{stat}</span>
                <span className="flex size-13 items-center justify-center rounded-full border border-[rgb(140_196_255/0.45)] bg-primary/15 text-[#bfe0ff] shadow-[0_0_22px_-4px_var(--primary)]">
                  <Icon className="size-6" strokeWidth={1.8} aria-hidden />
                </span>
              </div>
              <div>
                <h3 className="mb-2 font-serif text-[22px] font-bold">{title}</h3>
                <p className="leading-relaxed text-[#9db2d9]">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
