export function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
        <span className="h-px w-8 bg-primary" aria-hidden />
        {eyebrow}
      </p>
      <h2 className="font-serif text-3xl font-bold tracking-wide text-balance md:text-5xl">{title}</h2>
      {description ? <p className="leading-relaxed text-pretty text-muted-foreground">{description}</p> : null}
    </div>
  )
}
