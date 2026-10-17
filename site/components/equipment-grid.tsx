'use client'

import Image from 'next/image'
import { useState } from 'react'
import { type TooltipTone, buildTooltip } from '@/lib/item-tooltip'

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
  /** Grupo e índice do item no Item.txt (imagem /images/items/<grupo>-<indice>.webp). */
  group?: number
  index?: number
  /** Durabilidade atual, quando a API mandar. */
  durability?: number
}

const LABELS: Record<EquipmentSlot, string> = {
  pet: 'Pet',
  helm: 'Elmo',
  wings: 'Asas',
  weapon: 'Arma',
  pendant: 'Colar',
  armor: 'Armadura',
  shield: 'Escudo',
  gloves: 'Luvas',
  ring1: 'Anel',
  pants: 'Calça',
  ring2: 'Anel',
  boots: 'Botas',
}

// Posição de cada espaço na imagem da janela de equipamento (193 × 184 px na original).
const IMG_W = 193
const IMG_H = 184
const BOXES: Record<EquipmentSlot, [x: number, y: number, w: number, h: number]> = {
  pet: [5, 8, 44, 45],
  helm: [73, 8, 45, 45],
  wings: [120, 8, 65, 45],
  weapon: [5, 57, 44, 66],
  pendant: [50, 58, 22, 20],
  armor: [73, 57, 45, 66],
  shield: [142, 57, 43, 66],
  gloves: [5, 130, 44, 44],
  ring1: [50, 130, 22, 20],
  pants: [73, 130, 45, 44],
  ring2: [120, 130, 21, 20],
  boots: [142, 130, 43, 44],
}
const pct = (value: number, total: number) => `${(value / total) * 100}%`
const SMALL: EquipmentSlot[] = ['pendant', 'ring1', 'ring2']

/** Cor do nome como no jogo: ancient azul-claro, excelente verde, +7 ou mais dourado, +4 a +6 azul. */
function nameColor(item: EquipmentItem) {
  if (item.ancient) return 'text-[#6fd3ff]'
  if (item.excellent?.length) return 'text-[#7cf5a4]'
  if (item.level >= 7) return 'text-[#f7c955]'
  if (item.level >= 4) return 'text-[#a9d4ff]'
  return 'text-white'
}

/** "Divine Staff of Archangel" → "divine-staff-of-archangel" (nome do arquivo do ícone). */
const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Imagens a tentar, em ordem: pelo nome do item e depois por grupo-índice. */
function imageCandidates(item: EquipmentItem) {
  const keys = [slug(item.name)]
  if (item.group !== undefined && item.index !== undefined) keys.push(`${item.group}-${item.index}`)
  return keys
}

const fullName = (item: EquipmentItem) =>
  `${item.ancient ? `${item.ancient} ` : ''}${item.name}${item.level > 0 ? ` +${item.level}` : ''}`

export function EquipmentGrid({ items }: { items: EquipmentItem[] | undefined }) {
  const [hovered, setHovered] = useState<EquipmentSlot | null>(null)
  const [tapped, setTapped] = useState<EquipmentSlot | null>(null)
  const [brokenImages, setBrokenImages] = useState<Set<string>>(() => new Set())
  const equipped = items ?? []
  const itemAt = (slot: EquipmentSlot | null) => (slot ? equipped.find((item) => item.slot === slot) : undefined)
  const shown = hovered ?? tapped

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
        <div className="flex flex-col items-center gap-4 lg:items-start">
          <div
            className="relative w-full max-w-[579px] overflow-visible rounded-[6px] shadow-[0_30px_60px_-20px_#000,0_0_0_1px_rgb(240_180_67/0.25)]"
            style={{ aspectRatio: `${IMG_W} / ${IMG_H}` }}
            onMouseLeave={() => setHovered(null)}
          >
            <Image
              src="/images/inventario.webp"
              alt=""
              fill
              sizes="579px"
              className="rounded-[6px] object-fill select-none"
              draggable={false}
            />

            {(Object.keys(BOXES) as EquipmentSlot[]).map((slot) => {
              const [x, y, w, h] = BOXES[slot]
              const item = itemAt(slot)
              const imageKey = item ? (imageCandidates(item).find((key) => !brokenImages.has(key)) ?? null) : null
              const showImage = imageKey !== null
              const small = SMALL.includes(slot)
              return (
                <button
                  key={slot}
                  type="button"
                  onMouseEnter={() => setHovered(slot)}
                  onFocus={() => setHovered(slot)}
                  onBlur={() => setHovered(null)}
                  onClick={() => setTapped((current) => (current === slot ? null : slot))}
                  aria-label={item ? `${LABELS[slot]}: ${fullName(item)}` : `${LABELS[slot]}: vazio`}
                  className={`absolute flex items-center justify-center overflow-hidden rounded-[2px] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-accent ${
                    shown === slot ? 'shadow-[inset_0_0_0_2px_rgb(240_180_67/0.9)]' : 'hover:shadow-[inset_0_0_0_2px_rgb(240_180_67/0.6)]'
                  }`}
                  style={{ left: pct(x, IMG_W), top: pct(y, IMG_H), width: pct(w, IMG_W), height: pct(h, IMG_H) }}
                >
                  {item ? (
                    <>
                      {/* Esconde a silhueta do espaço vazio que vem desenhada na imagem de fundo. */}
                      <span className="absolute inset-[3%] bg-[radial-gradient(circle,rgb(30_30_34/0.92),rgb(8_8_10/0.97))]" />
                      {showImage ? (
                        // Imagens dos itens são opcionais: sem o arquivo, cai no nome do item.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/images/items/${imageKey}.webp`}
                          alt=""
                          className="relative h-[85%] w-[85%] object-contain drop-shadow-[0_2px_4px_#000]"
                          onError={() => setBrokenImages((set) => new Set(set).add(imageKey!))}
                        />
                      ) : (
                        <span
                          className={`relative px-[6%] text-center font-serif leading-tight font-bold [text-shadow:0_1px_2px_#000] ${nameColor(item)} ${
                            small ? 'text-[clamp(6px,1.4vw,9px)]' : 'text-[clamp(8px,2.2vw,13px)]'
                          }`}
                        >
                          {small ? item.name.split(' ').at(-1) : item.name}
                        </span>
                      )}
                      {item.level > 0 && !small ? (
                        <span className="absolute top-[4%] right-[7%] font-serif text-[clamp(8px,1.8vw,12px)] font-black text-accent [text-shadow:0_1px_2px_#000]">
                          +{item.level}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </button>
              )
            })}

            {/* Caixa de informação flutuante (telas médias e grandes), ao lado do espaço. */}
            {shown ? (
              <FloatingTooltip slot={shown} item={itemAt(shown)} className="hidden sm:block" />
            ) : null}
          </div>

          {/* No celular a caixa aparece embaixo da janela. */}
          <div className="w-full max-w-[579px] sm:hidden">
            {shown ? (
              <ItemInfo slot={shown} item={itemAt(shown)} />
            ) : (
              <p className="text-center text-xs text-muted-foreground">Toque em um item para ver os detalhes.</p>
            )}
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">Passe o mouse sobre um item para ver os detalhes.</p>
        </div>
      )}
    </section>
  )
}

function FloatingTooltip({
  slot,
  item,
  className,
}: {
  slot: EquipmentSlot
  item: EquipmentItem | undefined
  className?: string
}) {
  const [x, y, w] = BOXES[slot]
  // Espaços da metade esquerda abrem a caixa à direita, e vice-versa, como no jogo.
  const leftSide = x + w / 2 < IMG_W / 2
  return (
    <div
      className={`pointer-events-none absolute z-30 w-60 ${className ?? ''}`}
      style={{
        top: pct(y, IMG_H),
        ...(leftSide ? { left: pct(x + w + 3, IMG_W) } : { right: pct(IMG_W - x + 3, IMG_W) }),
      }}
      role="tooltip"
    >
      <ItemInfo slot={slot} item={item} />
    </div>
  )
}

/** Caixa de informação no estilo do jogo: fundo preto translúcido, texto centralizado, opções em azul. */
// Cores das linhas como na caixa de item do jogo: atributos em branco, opções em azul.
const TONES: Record<TooltipTone, string> = {
  white: 'text-white/90',
  gray: 'text-white/55',
  blue: 'text-[#7fa6ff]',
  gold: 'text-[#f7c955]',
  red: 'text-[#ff6b6b]',
}

function ItemInfo({ slot, item }: { slot: EquipmentSlot; item: EquipmentItem | undefined }) {
  return (
    <div className="rounded-[4px] border border-white/20 bg-black/85 px-4 py-3 text-center text-[13px] leading-snug shadow-[0_10px_30px_-8px_#000] backdrop-blur-[2px]">
      {!item ? (
        <>
          <p className="text-white/70">{LABELS[slot]}</p>
          <p className="mt-1 text-white/45">Vazio</p>
        </>
      ) : (
        <>
          {item.ancient ? <p className="text-[#6fd3ff]">Set {item.ancient}</p> : null}
          <p className={`font-bold ${nameColor(item)}`}>{fullName(item)}</p>
          <p className="mt-0.5 text-[11px] text-white/45 uppercase">{LABELS[slot]}</p>
          <ul className="mt-2.5 flex flex-col gap-0.5">
            {buildTooltip(item).map((line, i) =>
              line ? (
                <li key={i} className={TONES[line.tone]}>
                  {line.text}
                </li>
              ) : (
                <li key={i} className="h-2" aria-hidden />
              ),
            )}
          </ul>
        </>
      )}
    </div>
  )
}
