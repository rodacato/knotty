import type { Design } from '../design/schema'
import type { Rule } from '../structure/finding'
import type { DesignKind } from '../design/kind'
import { evaluateConstraints } from './constraint'
import { CATEGORY_CONSTRAINTS } from './constraints'

// Which kind of furniture a design is, and R10: the checks its kind needs (in constraints.ts).

/** Words in a name that say what the furniture is: the fallback for a design that does not say it (designed piece by piece, or saved before designs did). */
const WORDS: [DesignKind, RegExp][] = [
  ['bed', /\bcama\b|\bbase de cama\b/],
  ['desk', /escritorio/],
  ['wallCabinet', /alacena|gabinete de pared/],
  ['drawers', /cajonera|c[oó]moda|bur[oó]|mesa de noche/],
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

/** What the furniture is: what its design says, or else what its name suggests. Null: a kind Knotty does not recognize. */
export function detectKind(design: Pick<Design, 'name'> & Partial<Pick<Design, 'kind'>>): DesignKind | null {
  return design.kind ?? kindFromWords(design.name)
}

/** The kind the checks go by: a table that does not say which one is judged by its name. */
export function useOf(design: Pick<Design, 'name'> & Partial<Pick<Design, 'kind'>>): DesignKind | null {
  const kind = detectKind(design)
  if (kind !== 'table') return kind
  const name = design.name.toLowerCase()
  return /centro|caf[eé]/.test(name) ? 'coffeeTable' : /comedor|cocina/.test(name) ? 'diningTable' : 'sideTable'
}

/** R10: what this kind of furniture needs to be used safely. */
export const typologyRule: Rule = (ctx) => evaluateConstraints(CATEGORY_CONSTRAINTS, ctx, useOf(ctx.design))
