import { SERVER } from '@/lib/server-info'
import { cn } from '@/lib/utils'

export function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.86-.61 1.25a18.3 18.3 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.88 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1 0-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1 0 .13c-.6.35-1.22.64-1.87.89a.08.08 0 0 0-.04.11c.36.7.77 1.36 1.22 1.99a.08.08 0 0 0 .09.03 19.8 19.8 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.09-2.15-2.42s.95-2.42 2.15-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42Z" />
    </svg>
  )
}

/** Link para o Discord. Não renderiza nada enquanto SERVER.discordUrl estiver vazio. */
export function DiscordLink({
  variant = 'button',
  className,
  onClick,
}: {
  variant?: 'button' | 'icon'
  className?: string
  onClick?: () => void
}) {
  if (!SERVER.discordUrl) return null

  if (variant === 'icon') {
    return (
      <a
        href={SERVER.discordUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        aria-label="Discord do MU Reborn"
        className={cn(
          'flex size-11 items-center justify-center rounded-full border border-[#5865f2]/60 bg-[#5865f2]/15 text-[#c9cdfb] transition-colors hover:bg-[#5865f2]/30 hover:text-white',
          className,
        )}
      >
        <DiscordIcon className="size-5" />
      </a>
    )
  }

  return (
    <a
      href={SERVER.discordUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2.5 rounded-full border border-[#8b93ff]/70 bg-gradient-to-b from-[#6f7bff] to-[#4049c9] font-semibold tracking-[0.14em] text-white uppercase shadow-[0_8px_30px_-8px_#5865f2] transition-[filter] hover:brightness-110',
        className,
      )}
    >
      <DiscordIcon className="size-5" />
      Entrar no Discord
    </a>
  )
}
