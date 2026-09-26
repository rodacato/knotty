import { boardsFor, usableSheet, type BoardMaterial, type BoardUse, type Catalog } from '../../../domain/materials/catalog'
import { DEFAULT_CONSTRUCTION, type CabinetConstruction } from '../../../domain/furniture/modules/cabinet'
import { MATTRESSES, MAX_DRAWERS_PER_SIDE } from '../../../domain/furniture/modules/bed'
import { MAX_PEDESTAL_DRAWERS, TYPICAL_TABLE_DIMENSIONS } from '../../../domain/furniture/modules/table'
import { MIN_DRAWER_OPENING_HEIGHT } from '../../../domain/editing/operations/drawer'
import { ASSUMPTIONS } from '../../../domain/checks/structure/assumptions'
import { BOOKCASE_DEPTH, DESK_HEIGHT, WARDROBE_DEPTH } from '../../../domain/checks/typology/constraints'
import { planFieldList } from '../../../ports/LLMProvider'
import { moduleGuides, moduleList, moduleSummaries } from './modulePrompts'

// The craft numbers the prompts mention, taken from the code that enforces them: a prompt writes {{name}} instead of the number.
// Each value lists its guards: literal text that must not appear in a prompt file, so nobody restates the number by hand.

export interface PromptValue {
  text: string
  guards: string[]
}

/** The text is guarded, and so is any other way of writing it. */
const value = (text: string, ...alsoGuard: string[]): PromptValue => ({ text, guards: [text, ...alsoGuard] })
/** A bare number also shows up in unrelated examples: it is guarded with its unit. */
const measure = (mm: number, ...alsoGuard: string[]): PromptValue => ({ text: String(mm), guards: [`${mm} mm`, ...alsoGuard] })

/** Text the code writes whole, with no number to restate: nothing to guard. */
const written = (text: string): PromptValue => ({ text, guards: [] })

const dims = (...mm: number[]) => mm.join(' × ')
const cm = ([min, max]: readonly [number, number]) => `${min / 10}–${max / 10} cm`
const range = ([min, max]: readonly [number, number]) => `${min}–${max}`

const FRACTIONS = ['', '¼', '½', '¾']
/** 31.75 → 1¼": how screws are sold. */
const inches = (mm: number) => {
  const quarters = Math.round((mm / 25.4) * 4)
  return `${Math.floor(quarters / 4)}${FRACTIONS[quarters % 4]}"`
}

/** Each screw with the thickest piece it goes in: consecutive rows of the same screw become one. */
function pocketScrews() {
  const rows = ASSUMPTIONS.screws.pocketScrews.filter((row, i, all) => all[i + 1]?.hardwareId !== row.hardwareId)
  return rows.map((row) => `${inches(row.length)} up to ${row.upTo} mm`).join(' and ')
}

const CONSTRUCTION_LABEL: Record<keyof CabinetConstruction, string> = { doors: 'doors', drawerFronts: 'drawers', top: 'top', back: 'back', shelves: 'shelves' }
const TABLE_ORDER = ['dining', 'coffee', 'side', 'desk'] as const

/** Values that come from the domain alone. */
const DOMAIN = {
  minDrawerOpening: measure(MIN_DRAWER_OPENING_HEIGHT),
  maxDoorLeafWidth: measure(ASSUMPTIONS.doors.maxWidth),
  storageAnchorHeight: value(`${ASSUMPTIONS.tipping.storageHeight} mm`, `${ASSUMPTIONS.tipping.storageHeight / 10} cm`),
  tallFurnitureHeight: value(`${ASSUMPTIONS.tipping.criticalHeight / 1000} m`, `${ASSUMPTIONS.tipping.criticalHeight} mm`),
  screwPenetration: measure(ASSUMPTIONS.screws.minPenetration),
  // A whole inch (1") also closes every JSON string in the examples: only the fractional sizes guard.
  pocketScrews: value(pocketScrews(), ...new Set(ASSUMPTIONS.screws.pocketScrews.map((row) => inches(row.length)).filter((size) => !/^\d+"$/.test(size)))),
  defaultConstruction: value(
    (Object.keys(CONSTRUCTION_LABEL) as (keyof CabinetConstruction)[]).map((k) => `${CONSTRUCTION_LABEL[k]} "${DEFAULT_CONSTRUCTION[k]}"`).join(', '),
  ),
  bedDrawerCount: value(`from 1 to ${MAX_DRAWERS_PER_SIDE}`),
  pedestalDrawerCount: value(`from 1 to ${MAX_PEDESTAL_DRAWERS}`),
  typicalTableSizes: value(
    TABLE_ORDER.map((use) => `${use} ${dims(TYPICAL_TABLE_DIMENSIONS[use].width, TYPICAL_TABLE_DIMENSIONS[use].height, TYPICAL_TABLE_DIMENSIONS[use].depth)}`).join(', '),
    ...TABLE_ORDER.map((use) => dims(TYPICAL_TABLE_DIMENSIONS[use].width, TYPICAL_TABLE_DIMENSIONS[use].height, TYPICAL_TABLE_DIMENSIONS[use].depth)),
  ),
  individualMattress: value(dims(...MATTRESSES.individual), String(MATTRESSES.individual[0])),
  matrimonialMattress: value(dims(...MATTRESSES.matrimonial), String(MATTRESSES.matrimonial[0])),
  deskHeight: value(cm(DESK_HEIGHT), range(DESK_HEIGHT)),
  bookcaseDepth: value(cm(BOOKCASE_DEPTH), range(BOOKCASE_DEPTH)),
  wardrobeDepth: value(cm(WARDROBE_DEPTH), range(WARDROBE_DEPTH)),
  planFields: written(planFieldList()),
  moduleList: written(moduleList()),
  moduleGuides: written(moduleGuides()),
  moduleSummaries: written(moduleSummaries()),
} satisfies Record<string, PromptValue>

/** The word the materials list has always shown for each use: changing it changes what the expert reads (a new prompt version). */
const USE_WORD: Record<BoardUse, string> = { carcass: 'plywood', back: 'back' }

function describeCatalog(c: Catalog) {
  return [
    'Materials:',
    ...c.materials.map((m) => `- ${m.id}: ${m.name}, ${m.thickness} mm (${USE_WORD[m.use]})`),
    'Hardware:',
    ...c.hardware.map((h) => `- ${h.id}: ${h.name}`),
  ].join('\n')
}

const plywood = (c: Catalog) => boardsFor(c, 'carcass')
/** The largest plywood sheet: the limit a piece cannot pass. */
const largestSheet = (c: Catalog): BoardMaterial => [...plywood(c)].sort((a, b) => b.sheet.length * b.sheet.width - a.sheet.length * a.sheet.width)[0] ?? c.materials[0]

/** Values that depend on the catalog, which the person can edit (prices, trim). */
function fromCatalog(c: Catalog) {
  const board = largestSheet(c)
  const usable = usableSheet(c, board)
  return {
    catalog: value(describeCatalog(c)),
    materials: value(`one of ${plywood(c).map((m) => `"${m.id}" (${m.thickness} mm)`).join(', ')}`),
    usableSheet: value(dims(usable.length, usable.width), String(usable.length), String(usable.width)),
    sheet: value(dims(board.sheet.length, board.sheet.width), String(board.sheet.length), String(board.sheet.width)),
    sheetTrim: measure(c.layout.trim),
  } satisfies Record<string, PromptValue>
}

export type Placeholder = keyof typeof DOMAIN | keyof ReturnType<typeof fromCatalog>

/** Every placeholder with its value; the catalog ones only when there is a catalog. */
export function promptValues(catalog: Catalog | null): Partial<Record<Placeholder, PromptValue>> {
  return catalog ? { ...DOMAIN, ...fromCatalog(catalog) } : DOMAIN
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g

/** The placeholders a text uses, in order. */
export const placeholdersIn = (text: string) => [...text.matchAll(PLACEHOLDER)].map((m) => m[1])

/** Replaces every {{name}}; a name without a value is a bug in the prompt, not something to send. */
export function fill(text: string, catalog: Catalog | null): string {
  const values: Partial<Record<string, PromptValue>> = promptValues(catalog)
  return text.replace(PLACEHOLDER, (_, name: string) => {
    const found = values[name]
    if (!found) throw new Error(`The prompt uses {{${name}}}, which has no value${catalog ? '' : ' without a catalog'}.`)
    return found.text
  })
}
