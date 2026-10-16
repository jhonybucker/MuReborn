import { UserRound } from 'lucide-react'
import { SERVER } from '@/lib/server-info'

const links = [
  { href: '/#servidor', label: 'Servidor' },
  { href: '/#reset', label: 'Reset' },
  { href: '/#classes', label: 'Classes' },
  { href: '/#comecar', label: 'Como jogar' },
  { href: '/#conta', label: 'Conta' },
  { href: '/#regras', label: 'Regras' },
]

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 md:px-10 md:pt-6">
      <div className="glass mx-auto flex h-15 max-w-7xl items-center justify-between gap-6 rounded-full pr-2 pl-6 backdrop-blur-md md:pl-8">
        <a href="/" className="flex items-baseline gap-2 font-serif text-lg font-black tracking-[0.22em] md:text-xl">
          <span className="text-chrome">MU</span>
          <span className="text-gold">REBORN</span>
          <span className="text-[11px] tracking-widest text-muted-foreground">{SERVER.version}</span>
        </a>
        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-7 text-xs tracking-[0.16em] text-[#a9bde0] uppercase">
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="transition-colors hover:text-accent">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <a href="/painel" className="btn-frame h-11 px-4 text-xs md:px-5">
            <UserRound className="size-4" aria-hidden />
            Entrar
          </a>
          <span className="hidden sm:contents">
            <a
              href={SERVER.clientUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-play h-11 px-5 text-xs md:px-6"
            >
              Baixar cliente
            </a>
          </span>
        </div>
      </div>
    </header>
  )
}
