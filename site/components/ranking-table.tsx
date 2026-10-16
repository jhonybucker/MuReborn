import { className } from '@/lib/mu'

export type CharacterRow = { name: string; level: number; class: number; master: boolean; resets: number }
export type GuildRow = { name: string; master: string; members: number; score: number }

// Ouro, prata e bronze para o pódio.
const MEDALS = [
  'bg-gradient-to-b from-[#fff3c4] to-[#c9780f] text-[#2a1700] border-0',
  'bg-gradient-to-b from-[#f2f6ff] to-[#8d9dbb] text-[#0b1330] border-0',
  'bg-gradient-to-b from-[#f0b07a] to-[#8a4a1c] text-[#1f0e02] border-0',
]

const rowClass = (index: number, podium: boolean) =>
  `[&>td]:border-y [&>td]:bg-[rgb(12_28_66/0.7)] [&>td:first-child]:rounded-l-full [&>td:first-child]:border-l [&>td:last-child]:rounded-r-full [&>td:last-child]:border-r ${
    podium && index === 0
      ? '[&>td]:border-accent/60 shadow-[0_0_36px_-10px_var(--accent)]'
      : '[&>td]:border-[rgb(130_175_255/0.26)]'
  }`

function Position({ index, podium }: { index: number; podium: boolean }) {
  return (
    <td className="py-2 pl-2 sm:py-2.5 sm:pl-2.5">
      <span
        className={`flex size-9 items-center justify-center rounded-full border border-input bg-secondary font-serif text-lg font-black text-muted-foreground sm:size-11 ${
          podium ? (MEDALS[index] ?? '') : ''
        }`}
      >
        {index + 1}
      </span>
    </td>
  )
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="glass rounded-full px-7 py-5 text-center text-muted-foreground">
        {text}
      </td>
    </tr>
  )
}

const TABLE = 'w-full border-separate border-spacing-y-2.5'
const HEAD = 'text-[11px] tracking-[0.22em] text-[#6f86b3] uppercase'

export const characterHref = (name: string) => `/personagem/${encodeURIComponent(name)}`

/**
 * Tabela de personagens. `podium` pinta ouro/prata/bronze nos 3 primeiros (desligue em listas
 * que não são ranking, como quem está online). `extra` acrescenta uma coluna antes do M.
 */
export function CharacterTable({
  rows,
  emptyText,
  podium = true,
  extra,
}: {
  rows: CharacterRow[]
  emptyText: string
  podium?: boolean
  extra?: { label: string; render: (row: CharacterRow) => React.ReactNode }
}) {
  const columns = extra ? 7 : 6
  return (
    <table className={TABLE}>
      <thead>
        <tr className={HEAD}>
          <th className="w-12 sm:w-14" />
          <th className="text-left font-normal">Personagem</th>
          <th className="hidden w-40 font-normal sm:table-cell">Classe</th>
          <th className="w-14 text-right font-normal sm:w-20">Level</th>
          <th className="w-14 text-right font-normal sm:w-20">Resets</th>
          {extra ? <th className="hidden w-36 text-right font-normal md:table-cell">{extra.label}</th> : null}
          <th className="w-10 pr-4 font-normal sm:w-12 sm:pr-7">
            <abbr title="Master reset" className="no-underline">
              M
            </abbr>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={columns} text={emptyText} />
        ) : (
          rows.map((r, i) => (
            <tr key={r.name} className={rowClass(i, podium)}>
              <Position index={i} podium={podium} />
              <td className="max-w-0 truncate pl-2 font-serif font-bold sm:text-lg">
                <a href={characterHref(r.name)} className="hover:text-accent">
                  {r.name}
                </a>
                <span className="block text-[11px] font-normal tracking-[0.12em] text-muted-foreground uppercase sm:hidden">
                  {className(r.class)}
                </span>
              </td>
              <td className="hidden text-center sm:table-cell">
                <span className="inline-block w-36 rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5 text-xs tracking-[0.12em] text-[#a9bde0] uppercase">
                  {className(r.class)}
                </span>
              </td>
              <td className="text-right font-serif text-xl font-black text-[#8cc4ff] sm:text-2xl">{r.level}</td>
              <td className="text-right text-muted-foreground">↺ {r.resets}</td>
              {extra ? <td className="hidden text-right text-sm text-[#a9bde0] md:table-cell">{extra.render(r)}</td> : null}
              <td className="pr-4 text-center text-xl text-accent sm:pr-7">
                {r.master ? <span aria-label="Master reset">★</span> : null}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}

export function GuildTable({ rows, emptyText }: { rows: GuildRow[]; emptyText: string }) {
  return (
    <table className={TABLE}>
      <thead>
        <tr className={HEAD}>
          <th className="w-12 sm:w-14" />
          <th className="text-left font-normal">Guild</th>
          <th className="hidden text-left font-normal sm:table-cell">Líder</th>
          <th className="w-20 text-right font-normal">Membros</th>
          <th className="w-24 pr-5 text-right font-normal sm:pr-7">Pontos</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={5} text={emptyText} />
        ) : (
          rows.map((g, i) => (
            <tr key={g.name} className={rowClass(i, true)}>
              <Position index={i} podium />
              <td className="max-w-0 truncate pl-2 font-serif font-bold sm:text-lg">
                {g.name}
                <span className="block text-[11px] font-normal text-muted-foreground sm:hidden">Líder: {g.master}</span>
              </td>
              <td className="hidden sm:table-cell">
                <a href={characterHref(g.master)} className="hover:text-accent">
                  {g.master}
                </a>
              </td>
              <td className="text-right text-muted-foreground">{g.members}</td>
              <td className="pr-5 text-right font-serif text-xl font-black text-[#8cc4ff] sm:pr-7">
                {g.score.toLocaleString('pt-BR')}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
