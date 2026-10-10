import Image from 'next/image'
import { Download, Swords } from 'lucide-react'
import { CopyButton } from '@/components/copy-button'
import { SERVER } from '@/lib/server-info'

export function Hero() {
  return (
    <section id="topo" className="relative isolate flex min-h-svh items-end overflow-hidden pt-16">
      <Image
        src="/images/hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-center opacity-70"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-background/20" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-16 md:px-6 md:pb-24">
        <div className="flex max-w-2xl flex-col gap-6">
          <p className="animate-rise inline-flex w-fit items-center gap-2 border border-accent/60 bg-accent/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-foreground">
            <Swords className="size-4 text-primary" aria-hidden />
            Servidor Hard · Versão {SERVER.version}
          </p>
          <h1
            className="animate-rise font-serif text-6xl font-black leading-none tracking-wide text-balance md:text-8xl"
            style={{ animationDelay: '120ms' }}
          >
            <span className="text-gold">MU</span>
            <br />
            <span className="text-gold">REBORN</span>
          </h1>
          <p
            className="animate-rise max-w-xl text-lg leading-relaxed text-pretty text-foreground/85"
            style={{ animationDelay: '240ms' }}
          >
            O MU clássico como você lembra — sem atalhos. Drop e zen escassos, reset acumulativo e um master reset
            reservado para quem chegar ao limite.
          </p>
          <div className="animate-rise flex flex-wrap items-center gap-3" style={{ animationDelay: '360ms' }}>
            <a
              href={SERVER.clientUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Download className="size-5" aria-hidden />
              Baixar cliente {SERVER.version}
            </a>
            <a
              href="#conta"
              className="inline-flex items-center gap-2 rounded-sm border border-primary/60 px-6 py-3 font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              Pedir conta
            </a>
          </div>
        </div>

        <dl
          className="animate-rise gold-frame grid grid-cols-2 bg-card/80 backdrop-blur-sm md:grid-cols-4"
          style={{ animationDelay: '480ms' }}
        >
          <div className="flex flex-col gap-1 border-b border-r border-border p-4 md:border-b-0">
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">Experiência</dt>
            <dd className="font-serif text-2xl font-bold text-foreground">{SERVER.rates.exp}</dd>
          </div>
          <div className="flex flex-col gap-1 border-b border-border p-4 md:border-b-0 md:border-r">
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">Drop</dt>
            <dd className="font-serif text-2xl font-bold text-foreground">{SERVER.rates.drop}</dd>
          </div>
          <div className="flex flex-col gap-1 border-r border-border p-4">
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">Zen</dt>
            <dd className="font-serif text-2xl font-bold text-foreground">{SERVER.rates.zen}</dd>
          </div>
          <div className="flex flex-col gap-1 p-4">
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">IP do servidor</dt>
            <dd className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-lg text-foreground">{SERVER.ip}</span>
              <CopyButton value={SERVER.ip} label="Copiar" className="px-2" />
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
