import type { Design } from '../../design/schema'
import type { Rule } from '../structure/finding'
import type { DesignKind } from '../../design/kind'
import { evaluateConstraints } from './constraint'
import { CATEGORY_CONSTRAINTS } from './constraints'
import { pullFindings } from './pulls'
import { rodFindings } from './rods'

// Which kind of furniture a design is, and R10: the checks its kind needs (in constraints.ts).

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

/**
 * What Knotty does not design, asked for by name, with why: it holds a baby, or carries a person off the floor or on joints no rule here judges (expertos.md, Tomy's second principle).
 * A chair only when it is the piece asked for: «comedor para 6 sillas» is a table.
 */
const DECLINED: [RegExp, string][] = [
  [/\bcunas?\b/, 'Una cuna no la diseño: sus barrotes, su colchón y sus herrajes se prueban con normas que Knotty no puede revisar. Más vale una certificada. Para ese cuarto sí puedo con una cómoda, un librero o un clóset.'],
  [/\bliteras?\b|\bcamas? (alta|elevada|de dos pisos|(tipo )?loft)\b/, 'Una litera o una cama alta no la diseño: carga a una persona en altura, y su barandal y su escalera se prueban con normas que Knotty no puede revisar. Más vale una certificada. Una cama a su altura normal sí la diseño.'],
  [/^\W*((quiero|necesito|hazme|haz|dise[ñn]ame|dise[ñn]a|una?|la|mi|dos|\d+) )*sillas?\b/, 'Una silla no la diseño: sus uniones trabajan con una persona moviéndose encima, y eso Knotty no lo puede revisar. Un banco o una banca sí.'],
]

/** Why Knotty will not design what these words ask for; null when it will. */
export function declinedFor(text: string): string | null {
  const words = text.toLowerCase()
  return DECLINED.find(([pattern]) => pattern.test(words))?.[1] ?? null
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
export const typologyRule: Rule = (ctx) => [...evaluateConstraints(CATEGORY_CONSTRAINTS, ctx, useOf(ctx.design)), ...rodFindings(ctx), ...pullFindings(ctx)]
