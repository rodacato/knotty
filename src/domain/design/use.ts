import type { DesignKind } from './kind'
import type { Design } from './schema'

/** Words in a name that say what the furniture is: the fallback for a design that does not say it (designed piece by piece, or saved before designs did). */
const WORDS: [DesignKind, RegExp][] = [
  ['bed', /\bcama\b|\bbase de cama\b/],
  ['benchtop', /sobre ?mesa|sobre ?banco/],
  ['workbench', /banco de trabajo|mesa de trabajo|mes[oó]n|escritorio (alto|de pie)/],
  ['desk', /escritorio/],
  ['wallCabinet', /alacena|gabinete de pared/],
  ['kitchenBase', /gabinete (bajo|de cocina)|isla de cocina|mueble de fregadero/],
  ['drawers', /cajonera|c[oó]moda/],
  ['nightstand', /bur[oó]|mesa de noche/],
  ['sideboard', /aparador|trinchador|credenza|bufetera/],
  ['tvStand', /mueble (bajo )?(de|para) (la )?(tv|tele)|\btv\b|televisi[oó]n/],
  ['bookcase', /librer|estante/],
  ['wardrobe', /cl[oó]set|ropero|armario/],
  ['shoeRack', /zapatera/],
  ['bench', /\bbanca\b|\bbanco\b/],
  ['table', /\bmesa\b/],
]

/** What some words say the furniture is ("Buró con cajón" → drawers); null if they do not say. */
export function kindFromWords(text: string): DesignKind | null {
  const words = text.toLowerCase()
  return WORDS.find(([, pattern]) => pattern.test(words))?.[0] ?? null
}

export function useOf(design: Pick<Design, 'name'> & Partial<Pick<Design, 'kind'>>): DesignKind | null {
  const kind = design.kind ?? kindFromWords(design.name)
  if (kind !== 'table') return kind
  const name = design.name.toLowerCase()
  return /centro|caf[eé]/.test(name) ? 'coffeeTable' : /comedor|cocina/.test(name) ? 'diningTable' : 'sideTable'
}
