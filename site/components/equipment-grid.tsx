// Itens equipados no formato de GET /api/characters/:name → equipment (docs/api-site.md).
// A API decodifica Character.Inventory com o Item.txt do servidor e manda os nomes prontos.

export type EquipmentSlot =
  | 'weapon'
  | 'shield'
  | 'helm'
  | 'armor'
  | 'pants'
  | 'gloves'
  | 'boots'
  | 'wings'
  | 'pet'
  | 'pendant'
  | 'ring1'
  | 'ring2'

export type EquipmentItem = {
  slot: EquipmentSlot
  name: string
  level: number
  skill?: boolean
  luck?: boolean
  /** Opção adicional (+4, +8, +12, +16…), em pontos. */
  option?: number
  /** Opções excelentes já em texto (ex.: "Dano +2%"). */
  excellent?: string[]
  /** Nome do set ancient, quando for. */
  ancient?: string | null
}

// Posições como na janela de equipamento do jogo: 4 linhas × 3 colunas.
const SLOTS: { slot: EquipmentSlot; label: string }[] = [
  { slot: 'pet', label: 'Pet' },
  { slot: 'helm', label: 'Elmo' },
  { slot: 'wings', label: 'Asas' },
  { slot: 'weapon', label: 'Arma' },
  { slot: 'armor', label: 'Armadura' },
  { slot: 'shield', label: 'Escudo' },
  { slot: 'gloves', label: 'Luvas' },
  { slot: 'pants', label: 'Calça' },
  { slot: 'pendant', label: 'Colar' },
  { slot: 'ring1', label: 'Anel' },
  { slot: 'boots', label: 'Botas' },
  { slot: 'ring2', label: 'Anel' },
]

/** Cor do nome como no jogo: excelente verde, ancient azul, +7 ou mais dourado, +4 a +6 azul claro. */
function nameColor(item: EquipmentItem) {
  if (item.ancient) return 'text-[#6fd3ff]'
  if (item.excellent?.length) return 'text-[#7cf5a4]'
  if (item.level >= 7) return 'text-[#f7c955]'
  if (item.level >= 4) return 'text-[#a9d4ff]'
  return 'text-foreground'
}

export function EquipmentGrid({ items }: { items: EquipmentItem[] | undefined }) {
  return (
    <section aria-labelledby="equipamentos" className="mt-12 flex flex-col gap-5">
      <h2 id="equipamentos" className="eyebrow">
        Equipamentos
      </h2>
      {items === undefined ? (
        <p className="glass rounded-full px-7 py-5 text-center text-muted-foreground">
          Equipamentos indisponíveis no momento.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {SLOTS.map(({ slot, label }) => {
            const item = items.find((i) => i.slot === slot)
            return (
              <li
                key={slot}
                className={`glass flex min-h-[132px] flex-col gap-2 rounded-[28px] p-4 sm:p-5 ${
                  item?.excellent?.length || item?.ancient ? 'border-[#7cf5a4]/35' : ''
                } ${item ? '' : 'opacity-55'}`}
              >
                <span className="text-[10px] tracking-[0.22em] text-[#6f86b3] uppercase">{label}</span>
                {item ? (
                  <>
                    <p className={`font-serif text-base leading-snug font-bold sm:text-lg ${nameColor(item)}`}>
                      {item.ancient ? `${item.ancient} ` : ''}
                      {item.name}
                      {item.level > 0 ? ` +${item.level}` : ''}
                    </p>
                    <ul className="flex flex-wrap gap-1.5 text-[11px] tracking-[0.08em] uppercase">
                      {item.skill ? <Tag>Skill</Tag> : null}
                      {item.luck ? <Tag>Luck</Tag> : null}
                      {item.option ? <Tag>+{item.option} opção</Tag> : null}
                    </ul>
                    {item.excellent?.length ? (
                      <ul className="flex flex-col gap-0.5 text-xs text-[#7cf5a4]">
                        {item.excellent.map((option) => (
                          <li key={option}>{option}</li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Vazio</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-[#a9bde0]">{children}</li>
  )
}
