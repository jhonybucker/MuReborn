'use client'

import { Download, Menu, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
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
  const [open, setOpen] = useState(false)

  // Fecha com Esc e quando a tela cresce até o menu completo aparecer.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    const desktop = window.matchMedia('(min-width: 1024px)')
    const onResize = () => desktop.matches && setOpen(false)
    window.addEventListener('keydown', onKey)
    desktop.addEventListener('change', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      desktop.removeEventListener('change', onResize)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4 md:px-10 md:pt-6">
      <div className="glass mx-auto flex h-15 max-w-7xl items-center justify-between gap-4 rounded-full pr-2 pl-5 backdrop-blur-md sm:pl-6 md:pl-8">
        <a
          href="/"
          onClick={close}
          className="flex items-baseline gap-2 font-serif text-base font-black tracking-[0.18em] sm:text-lg md:text-xl md:tracking-[0.22em]"
        >
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
          <span className="hidden sm:contents">
            <a href="/painel" className="btn-frame h-11 px-4 text-xs md:px-5">
              <UserRound className="size-4" aria-hidden />
              Entrar
            </a>
            <a
              href={SERVER.clientUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-play h-11 px-5 text-xs md:px-6"
            >
              Baixar cliente
            </a>
          </span>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            className="flex size-11 items-center justify-center rounded-full border border-[rgb(130_175_255/0.35)] bg-[rgb(4_9_22/0.55)] text-foreground transition-colors hover:border-accent hover:text-accent lg:hidden"
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 -z-10 bg-[rgb(4_9_22/0.6)] backdrop-blur-[2px] lg:hidden"
          />
          <nav
            id="menu-mobile"
            aria-label="Menu"
            className="glass animate-rise mx-auto mt-3 max-w-7xl rounded-[32px] p-3 backdrop-blur-md lg:hidden"
          >
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={close}
                    className="flex h-12 items-center gap-3 rounded-full px-5 text-sm tracking-[0.16em] text-[#cfdcf5] uppercase transition-colors hover:bg-primary/15 hover:text-accent"
                  >
                    <span className="size-1.5 rotate-45 bg-accent" aria-hidden />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid gap-2 border-t border-[rgb(130_175_255/0.2)] pt-3 sm:hidden">
              <a href="/painel" onClick={close} className="btn-frame h-12 text-xs">
                <UserRound className="size-4" aria-hidden />
                Entrar
              </a>
              <a
                href={SERVER.clientUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="btn-play h-12 text-sm"
              >
                <Download className="size-4" aria-hidden />
                Baixar cliente
              </a>
            </div>
          </nav>
        </>
      ) : null}
    </header>
  )
}
