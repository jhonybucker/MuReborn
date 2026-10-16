import { cn } from '@/lib/utils'

export function DiamondDivider({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-accent/80" />
      <span className="size-2.5 rotate-45 bg-accent shadow-[0_0_12px_var(--accent)]" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-accent/80" />
    </div>
  )
}
