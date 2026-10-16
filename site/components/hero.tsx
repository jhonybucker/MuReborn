import Image from 'next/image'
import { Download } from 'lucide-react'
import { DiamondDivider } from '@/components/diamond-divider'
import { SERVER } from '@/lib/server-info'

const stats = [
  { label: 'Experiência', value: SERVER.rates.exp },
  { label: 'Drop', value: SERVER.rates.drop },
  { label: 'Zen', value: SERVER.rates.zen },
  { label: 'Reset', value: `Lv ${SERVER.resetLevel}` },
]

export function Hero() {
  return (
    <section id="topo" className="relative isolate flex min-h-svh flex-col overflow-hidden pt-28 pb-10 md:pb-12">
      <Image
        src="/fundo.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[60%_50%]"
      />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_18%,rgb(160_210_255/0.34),transparent_32%),linear-gradient(90deg,rgb(4_9_22/0.96)_0%,rgb(4_9_22/0.55)_48%,rgb(4_9_22/0.05)_100%),linear-gradient(0deg,#040916_0%,transparent_42%)]" />

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-between gap-12 px-4 md:px-[72px]">
        <div className="animate-rise flex max-w-xl flex-col items-center text-center md:items-start md:text-left">
          <h1>
            <Image
              src="/logo.webp"
              alt="MU Reborn"
              width={612}
              height={408}
              priority
              className="h-auto w-80 drop-shadow-[0_0_34px_rgb(61_139_255/0.55)] md:-ml-5 md:w-[420px]"
            />
          </h1>
          <p className="-mt-1.5 font-serif text-base font-bold tracking-[0.2em] text-[#e6efff] md:text-lg">
            {SERVER.version.toUpperCase()} <span className="text-accent">◆</span> {SERVER.rates.exp} EXP{' '}
            <span className="text-accent">◆</span> RESET ACUMULATIVO
          </p>
          <DiamondDivider className="mt-6 mb-5 w-full max-w-[430px]" />
          <p className="leading-[1.9] tracking-[0.3em] text-[#cfdcf5] uppercase md:text-base">
            Reviva a lenda,
            <br />
            agora em um novo mundo!
          </p>
        </div>

        <div
          className="animate-rise flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
          style={{ animationDelay: '200ms' }}
        >
          <div className="flex w-full flex-col gap-3.5 lg:w-[430px]">
            <a
              href={SERVER.clientUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-play h-[68px] w-full text-xl"
            >
              <Download className="size-6" strokeWidth={2.2} aria-hidden />
              Baixar cliente
            </a>
            <div className="flex gap-3">
              <a href="#conta" className="btn-frame h-[46px] flex-1 text-xs">
                Criar conta
              </a>
              <a href="#comecar" className="btn-frame h-[46px] flex-1 text-xs">
                Como jogar
              </a>
            </div>
          </div>

          <dl className="glass grid grid-cols-2 rounded-[28px] px-2.5 py-1.5 backdrop-blur-md sm:grid-cols-4 lg:w-[600px]">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`px-2 py-4 text-center ${index > 0 ? 'sm:border-l sm:border-[rgb(130_175_255/0.2)]' : ''}`}
              >
                <dt className="mb-1.5 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">{stat.label}</dt>
                <dd className="text-gold font-serif text-2xl font-bold md:text-[26px]">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
