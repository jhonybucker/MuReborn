import itemData from '@/lib/item-data.json'

// Monta a caixa de descrição do item como no MU 99b, a partir dos atributos base do cliente
// (lib/item-data.json, gerado por tools/item-icons/build_item_data.py) e das opções que a API manda.
// Fórmulas: as do servidor 99b (bônus por level, bônus de excelente e requisitos por level).

type BaseItem = {
  name: string
  level?: number
  twoHand?: boolean
  skill?: number
  damage?: number[]
  blocking?: number
  defense?: number
  attackSpeed?: number
  walkSpeed?: number
  magicPower?: number
  reqStrength?: number
  reqAgility?: number
  reqEnergy?: number
  reqVitality?: number
  reqLevel?: number
  classes?: number[]
  resistances?: number[]
}

const DATA = itemData as Record<string, BaseItem>

export type TooltipTone = 'white' | 'gray' | 'blue' | 'gold' | 'red'
export type TooltipLine = { text: string; tone: TooltipTone } | null // null = linha em branco

export type TooltipItem = {
  name: string
  level: number
  group?: number
  index?: number
  skill?: boolean
  luck?: boolean
  option?: number
  excellent?: string[]
  ancient?: string | null
  durability?: number
}

const SKILLS: Record<number, string> = {
  18: 'Defend',
  19: 'Falling Slash',
  20: 'Lunge',
  21: 'Uppercut',
  22: 'Cyclone Slash',
  23: 'Slash',
  24: 'Triple Shot',
  49: 'Raid',
  56: 'Power Slash',
  62: 'Earthquake',
  66: 'Force Wave',
}

const CLASS_NAMES = [
  ['Dark Wizard', 'Soul Master'],
  ['Dark Knight', 'Blade Knight'],
  ['Fairy Elf', 'Muse Elf'],
  ['Magic Gladiator', 'Magic Gladiator'],
  ['Dark Lord', 'Dark Lord'],
]

const RESISTANCES = ['gelo', 'veneno', 'raio', 'fogo', 'terra', 'vento', 'água']

/** Atributos base do cliente para o item, ou undefined se a API não mandou grupo/índice. */
export function baseItem(group?: number, index?: number): BaseItem | undefined {
  return group === undefined || index === undefined ? undefined : DATA[`${group}-${index}`]
}

export function buildTooltip(item: TooltipItem): TooltipLine[] {
  const base = baseItem(item.group, item.index)
  const group = item.group ?? -1
  const lvl = item.level
  const excellent = Boolean(item.excellent?.length)
  const baseLevel = base?.level ?? 0
  const bonus10 = lvl >= 10 ? ((lvl - 9) * (lvl - 8)) / 2 : 0
  const isWing = group === 12 && (item.index ?? 99) <= 6
  const lines: TooltipLine[] = []
  const add = (text: string, tone: TooltipTone = 'white') => lines.push({ text, tone })

  if (!base) {
    // Sem dados base: mostra só o que a API mandou.
    appendOptions(item, group, lines)
    return lines
  }

  // Excelente: bônus na base proporcional ao level do item.
  const excellentBonus = (value: number, factor: number) =>
    excellent && baseLevel > 0 ? Math.floor((value * factor) / baseLevel) + 5 : 0

  if (base.damage?.some(Boolean)) {
    const [min = 0, max = 0] = base.damage
    const dmgMin = min + excellentBonus(min, 25) + lvl * 3 + bonus10
    const dmgMax = max + excellentBonus(max, 25) + lvl * 3 + bonus10
    add(`Dano (${base.twoHand ? 'duas mãos' : 'uma mão'}): ${dmgMin} ~ ${dmgMax}`)
  }
  if (base.magicPower) {
    const power = base.magicPower + excellentBonus(base.magicPower, 25) + lvl * 3 + bonus10
    add(`Dano mágico: +${Math.floor(power / 2)}%`)
  }
  if (isWing) {
    const first = (item.index ?? 0) <= 2
    add(`Aumento de dano: +${first ? 12 + lvl * 2 : 32 + lvl}%`)
    add(`Absorção de dano: ${first ? 12 + lvl * 2 : 25 + lvl}%`)
  }
  if (base.defense) {
    const extra = excellent && baseLevel > 0 ? Math.floor((base.defense * 12) / baseLevel) + Math.floor(baseLevel / 5) + 4 : 0
    const defense = base.defense + extra + (group === 6 ? lvl : lvl * 3) + bonus10
    add(`Defesa: ${defense}`)
  }
  if (base.blocking) {
    add(`Taxa de defesa: ${base.blocking + excellentBonus(base.blocking, 25) + lvl * 3 + bonus10}`)
  }
  if (base.attackSpeed) add(`Velocidade de ataque: ${base.attackSpeed}`)
  if (base.walkSpeed) add(`Velocidade de movimento: +${base.walkSpeed}`)
  if (item.durability !== undefined) add(`Durabilidade: ${item.durability}`)

  // Guardião e pet: efeitos fixos do 99b.
  if (group === 13 && item.index === 0) {
    add('Absorve 20% do dano recebido')
    add('HP máximo +50')
  }
  if (group === 13 && item.index === 1) add('Aumenta o dano em 30%')

  const reqLevelBase = baseLevel + (excellent ? 25 : 0)
  const requirement = (value?: number) =>
    value ? Math.floor((value * (reqLevelBase + lvl * 3) * 3) / 100) + 20 : 0
  const reqs: TooltipLine[] = []
  if (base.reqLevel) reqs.push({ text: `Level necessário: ${base.reqLevel}`, tone: 'white' })
  if (base.reqStrength) reqs.push({ text: `Força necessária: ${requirement(base.reqStrength)}`, tone: 'white' })
  if (base.reqAgility) reqs.push({ text: `Agilidade necessária: ${requirement(base.reqAgility)}`, tone: 'white' })
  if (base.reqEnergy) reqs.push({ text: `Energia necessária: ${requirement(base.reqEnergy)}`, tone: 'white' })
  if (base.reqVitality) reqs.push({ text: `Vitalidade necessária: ${requirement(base.reqVitality)}`, tone: 'white' })
  if (reqs.length) lines.push(null, ...reqs)

  const classes = (base.classes ?? [])
    .map((flag, i) => (flag ? CLASS_NAMES[i]?.[flag >= 2 ? 1 : 0] : null))
    .filter((name): name is string => Boolean(name))
  if (classes.length && classes.length < 5) {
    lines.push(null)
    for (const name of classes) add(`Pode ser equipado por ${name}`)
  }

  const resistances = (base.resistances ?? []).map((flag, i) => (flag ? RESISTANCES[i] : null)).filter(Boolean)
  if (resistances.length) {
    lines.push(null)
    for (const name of resistances) add(`Resistência a ${name}`, 'blue')
  }

  appendOptions(item, group, lines, base.skill)
  return lines
}

function appendOptions(item: TooltipItem, group: number, lines: TooltipLine[], skillId?: number) {
  const options: TooltipLine[] = []
  if (item.skill) {
    const skill = skillId ? SKILLS[skillId] : undefined
    options.push({ text: skill ? `Skill: ${skill}` : 'Skill do item', tone: 'blue' })
  }
  if (item.luck) {
    options.push({ text: 'Luck (sucesso da Jewel of Soul +25%)', tone: 'blue' })
    options.push({ text: 'Luck (taxa de dano crítico +5%)', tone: 'blue' })
  }
  if (item.option) {
    const label =
      group === 5
        ? 'Dano mágico adicional'
        : group >= 0 && group <= 4
          ? 'Dano adicional'
          : group >= 6 && group <= 11
            ? 'Defesa adicional'
            : 'Opção adicional'
    options.push({ text: `${label} +${item.option}`, tone: 'blue' })
  }
  for (const option of item.excellent ?? []) options.push({ text: option, tone: 'blue' })
  if (options.length) lines.push(null, ...options)
}
