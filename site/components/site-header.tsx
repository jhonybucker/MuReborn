import { Download } from 'lucide-react'
import { SERVER } from '@/lib/server-info'

const links = [
  { href: '#servidor', label: 'Servidor' },
  { href: '#reset', label: 'Reset' },
  { href: '#classes', label: 'Classes' },
  { href: '#comecar', label: 'Como jogar' },
  { href: '#conta', label: 'Conta' },
  { href: '#regras', label: 'Regras' },
]

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 md:px-6">
        <a href="#topo" className="flex items-baseline gap-2 font-serif font-bold tracking-widest">
          <span className="text-gold text-lg">MU REBORN</span>
          <span className="text-xs text-muted-foreground">{SERVER.version}</span>
        </a>
        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-6 text-sm text-muted-foreground">
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="transition-colors hover:text-primary">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a
          href={SERVER.clientUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Download className="size-4" aria-hidden />
          Baixar cliente
        </a>
      </div>
    </header>
  )
}
