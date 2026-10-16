// Códigos do banco do MU 99b: Class = (classe base << 4) | evolução.
export const CLASSES = ['Dark Wizard', 'Dark Knight', 'Fairy Elf', 'Magic Gladiator', 'Dark Lord'] as const

const EVOLUTIONS: (string | null)[] = ['Soul Master', 'Blade Knight', 'Muse Elf', null, null]

const CLASS_IMAGES: (string | null)[] = [
  '/images/classes/dark-wizard.webp',
  '/images/classes/dark-knight.webp',
  '/images/classes/fairy-elf.webp',
  '/images/classes/magic-gladiator.webp',
  '/images/classes/dark-lord.webp',
]

const MAPS: Record<number, string> = {
  0: 'Lorencia',
  1: 'Dungeon',
  2: 'Devias',
  3: 'Noria',
  4: 'Lost Tower',
  5: 'Exile',
  6: 'Arena',
  7: 'Atlans',
  8: 'Tarkan',
  9: 'Devil Square',
  10: 'Icarus',
  30: 'Valley of Loren',
  31: 'Land of Trials',
}

const baseIndex = (code: number) => (code >> 4) % CLASSES.length

export const className = (code: number) => CLASSES[baseIndex(code)] ?? '?'

/** Nome da evolução (Soul Master, Blade Knight, Muse Elf) ou null se ainda não evoluiu. */
export const classEvolution = (code: number) => ((code & 0x0f) > 0 ? (EVOLUTIONS[baseIndex(code)] ?? null) : null)

/** Nome atual da classe: a evolução quando já evoluiu (Soul Master), senão a base (Dark Wizard). */
export const classTitle = (code: number) => classEvolution(code) ?? className(code)

export const classImage = (code: number) => CLASS_IMAGES[baseIndex(code)] ?? null

export const isDarkLord = (code: number) => baseIndex(code) === 4

export function mapName(map: number) {
  if (MAPS[map]) return MAPS[map]
  if (map >= 11 && map <= 17) return `Blood Castle ${map - 10}`
  if (map >= 18 && map <= 23) return `Chaos Castle ${map - 17}`
  if (map >= 24 && map <= 29) return `Kalima ${map - 23}`
  return `Mapa ${map}`
}
