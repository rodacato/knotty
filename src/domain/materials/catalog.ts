import { z } from 'zod'
import { FinishProductId } from './finishes'
import { GRADE_IDS } from './grades'

// The catalog is data, not code: it loads from public/catalog/*.json and the person can override prices.
// Its field names are the JSON's; the person's saved prices refer to material and hardware ids.

/** What a board is for: the carcass (sides, shelves, tops, fronts) or the back and drawer bottoms. What it is goes in `grade`. */
export const BOARD_USES = ['carcass', 'back'] as const
export const BoardUse = z.enum(BOARD_USES)
export type BoardUse = z.infer<typeof BoardUse>

/** A catalog cached before `type` was split in `use` and `grade`: every board then was pine plywood. */
const LEGACY_USE: Record<string, BoardUse> = { plywood: 'carcass', back: 'back' }
const fromLegacyType = (data: unknown) => {
  if (!data || typeof data !== 'object' || 'use' in data || !('type' in data)) return data
  const { type, ...rest } = data as { type: unknown }
  return { ...rest, use: LEGACY_USE[String(type)] ?? type, grade: 'pine-plywood' }
}

const BoardFields = z.object({
  id: z.string(),
  name: z.string(),
  use: BoardUse,
  grade: z.enum(GRADE_IDS),
  thickness: z.number().positive(),
  sheet: z.object({ length: z.number().positive(), width: z.number().positive() }),
  sku: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
})
export const BoardMaterial = z.preprocess(fromLegacyType, BoardFields)
export type BoardMaterial = z.infer<typeof BoardFields>

/** What a hardware item is for: code asks the catalog for a role, never for an id or an id's prefix. */
export const HARDWARE_ROLES = [
  'screw', 'pocket-screw', 'nail', 'dowel', 'cam-lock', 'bracket', 'shelf-pin', 'hinge', 'drawer-slide',
  'glue', 'edge-banding', 'leveling-foot', 'handle', 'anti-tip',
] as const
export const HardwareRole = z.enum(HARDWARE_ROLES)
export type HardwareRole = z.infer<typeof HardwareRole>

/** How a door sits on the upright its hinge is screwed to: over all its edge, over half of it (two doors share it) or inside the opening. */
export const DOOR_MOUNTS = ['overlay', 'half-overlay', 'inset'] as const
export const DoorMount = z.enum(DOOR_MOUNTS)
export type DoorMount = z.infer<typeof DoorMount>

export const Hardware = z.object({
  id: z.string(),
  name: z.string(),
  role: HardwareRole,
  unit: z.enum(['piece', 'pack', 'meter', 'jar']),
  perPack: z.number().int().positive().nullable(),
  length: z.number().positive().nullable().default(null).describe('Screws and slides: length in mm'),
  sideClearance: z.number().nonnegative().nullable().default(null).describe('Slides: space per side between the drawer and the furniture'),
  mount: DoorMount.nullable().default(null).describe('Cup hinges: the door they are for (straight, cranked or super-cranked arm)'),
  sku: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
})
export type Hardware = z.infer<typeof Hardware>

/** A finish product as the store sells it: one container size. Code asks for a product, never for an id. */
export const FinishSku = z.object({
  id: z.string(),
  name: z.string(),
  product: FinishProductId,
  litres: z.number().positive(),
  sku: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
})
export type FinishSku = z.infer<typeof FinishSku>

export const LayoutSettings = z.object({
  trim: z.number().nonnegative().describe('Factory edge trimmed per side'),
  kerf: z.number().nonnegative().describe('Width of the cut'),
  clearance: z.number().nonnegative().describe('Clearance per piece'),
})
export type LayoutSettings = z.infer<typeof LayoutSettings>

export const Catalog = z
  .object({
    materials: z.array(BoardMaterial).min(1),
    hardware: z.array(Hardware),
    /** A catalog cached before finishes existed has none. */
    finishes: z.array(FinishSku).default([]),
    layout: LayoutSettings,
    priceNote: z.string().nullable().default(null),
  })
  .refine((c) => BOARD_USES.every((use) => c.materials.some((m) => m.use === use)), { message: 'The catalog needs at least one board of each use', path: ['materials'] })
export type Catalog = z.infer<typeof Catalog>

export const materialById = (catalog: Catalog, id: string) => catalog.materials.find((m) => m.id === id)

/** The boards for a use, in catalog order. */
export const boardsFor = (catalog: Catalog, use: BoardUse) => catalog.materials.filter((m) => m.use === use)
/** The thinnest board for a use that is at least this thick. */
export const thinnestBoard = (catalog: Catalog, use: BoardUse, atLeast: number) =>
  boardsFor(catalog, use)
    .filter((m) => m.thickness >= atLeast)
    .sort((a, b) => a.thickness - b.thickness)[0]

/** The back a module puts on and a carcass is squared with: the thickest back board, which can be nailed (6 mm in the shipped catalog). */
export const backBoard = (catalog: Catalog): BoardMaterial => boardsFor(catalog, 'back').reduce((a, b) => (b.thickness > a.thickness ? b : a))

/** The catalog's hardware of a role, in catalog order. */
export const hardwareByRole = (catalog: Catalog, role: HardwareRole) => catalog.hardware.filter((h) => h.role === role)
/** The first item of a role that meets the condition: with several of a role, the first in the catalog is the usual one. */
export const pickHardware = (catalog: Catalog, role: HardwareRole, predicate: (h: Hardware) => boolean = () => true) => hardwareByRole(catalog, role).find(predicate)

/** The catalog's hinge for a door that sits this way; undefined when it sells none (a catalog that does not say what its hinges are for). */
export const hingeFor = (catalog: Catalog, mount: DoorMount) => pickHardware(catalog, 'hinge', (h) => h.mount === mount)

/** A drawer slide that says what placing it takes: its length and the gap it needs on each side of the box. */
export type Slide = Hardware & { length: number; sideClearance: number }
/** The catalog's drawer slides that say their length and side gap, in catalog order. */
export const slidesOf = (catalog: Catalog) => hardwareByRole(catalog, 'drawer-slide').filter((h): h is Slide => h.length !== null && h.sideClearance !== null)
/** What a slide leaves free behind it, past the end of the box. */
export const SLIDE_BACK_CLEARANCE = 10
/**
 * The longest slide that fits a drawer with this much depth behind its front, leaving the clearance at the back.
 * Undefined when not even the shortest fits. Every place that picks a slide asks here, so a deep drawer gets a long one.
 */
export const slideFor = (catalog: Catalog, depth: number): Slide | undefined =>
  slidesOf(catalog)
    .filter((s) => s.length <= depth - SLIDE_BACK_CLEARANCE + 0.5)
    .sort((a, b) => b.length - a.length)[0]
/** The slide for a box already built, which is as long as its slide: a box shorter than every slide gets the shortest, and R9 says it does not fit. */
export const slideForBox = (catalog: Catalog, boxLength: number): Slide | undefined =>
  slideFor(catalog, boxLength + SLIDE_BACK_CLEARANCE) ?? [...slidesOf(catalog)].sort((a, b) => a.length - b.length)[0]

/** The containers the catalog sells of a finish product, in catalog order. */
export const finishSkus = (catalog: Catalog, product: FinishProductId) => catalog.finishes.filter((f) => f.product === product)

/** The sheet without its factory edge: the most a piece can measure without joining boards. */
export const usableSheet = (catalog: Catalog, material: BoardMaterial) => ({
  length: material.sheet.length - 2 * catalog.layout.trim,
  width: material.sheet.width - 2 * catalog.layout.trim,
})

/** What the person changes in the catalog on their device: their store's prices and cutting settings. */
export interface CatalogSettings {
  prices: Record<string, number | null>
  layout: LayoutSettings | null
}

export const NO_SETTINGS: CatalogSettings = { prices: {}, layout: null }

export function applySettings(c: Catalog, a: CatalogSettings): Catalog {
  const priced = <T extends { id: string; price: number | null }>(x: T): T => (x.id in a.prices ? { ...x, price: a.prices[x.id] } : x)
  return { ...c, materials: c.materials.map(priced), hardware: c.hardware.map(priced), finishes: c.finishes.map(priced), layout: a.layout ?? c.layout }
}
