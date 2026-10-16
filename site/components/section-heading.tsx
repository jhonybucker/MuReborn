import { cn } from '@/lib/utils'

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string
  title: React.ReactNode
  description?: string
  className?: string
}) {
  return (
    <div className={cn('flex max-w-2xl flex-col gap-4', className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="text-chrome font-serif text-4xl leading-[1.02] font-black text-balance md:text-6xl">{title}</h2>
      {description ? <p className="text-lg leading-relaxed text-pretty text-muted-foreground">{description}</p> : null}
    </div>
  )
}
