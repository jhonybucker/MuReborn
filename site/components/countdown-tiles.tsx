import { splitDuration } from '@/lib/use-now'

/** Contagem em três blocos (horas : minutos : segundos), como nas telas do canvas. `ms` null = "--". */
export function CountdownTiles({ ms, tone = 'chrome' }: { ms: number | null; tone?: 'chrome' | 'gold' }) {
  const parts = ms === null ? null : splitDuration(ms)
  const tiles = [
    { label: 'Horas', value: parts?.hours ?? '--' },
    { label: 'Min', value: parts?.minutes ?? '--' },
    { label: 'Seg', value: parts?.seconds ?? '--' },
  ]
  return (
    <div className="flex items-center gap-2 sm:gap-2.5" role="timer" aria-live="off">
      {tiles.map((tile, index) => (
        <div key={tile.label} className="contents">
          {index > 0 ? (
            <span className="text-2xl text-accent sm:text-3xl" aria-hidden>
              :
            </span>
          ) : null}
          <div className="flex-1 rounded-[22px] border border-accent/45 bg-gradient-to-b from-[#0f2147] to-[#071230] pt-4 pb-3 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_10px_30px_-12px_rgb(240_180_67/0.5)] sm:rounded-[26px]">
            <strong
              className={`block font-serif text-4xl leading-none font-black tabular-nums sm:text-5xl ${
                tone === 'gold' ? 'text-gold' : 'text-chrome'
              }`}
            >
              {tile.value}
            </strong>
            <small className="mt-2 block text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
              {tile.label}
            </small>
          </div>
        </div>
      ))}
    </div>
  )
}
