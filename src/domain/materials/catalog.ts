import { z } from 'zod'
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

export const Hardware = z.object({
  id: z.string(),
  name: z.string(),
  role: HardwareRole,
  unit: z.enum(['piece', 'pack', 'meter', 'jar']),
  perPack: z.number().int().positive().nullable(),
  length: z.number().positive().nullable().default(null).describe('Screws and slides: length in mm'),
  sideClearance: z.number().nonnegative().nullable().default(null).describe('Slides: space per side between the drawer and the furniture'),
  sku: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
})
export type Hardware = z.infer<typeof Hardware>

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
  return { ...c, materials: c.materials.map(priced), hardware: c.hardware.map(priced), layout: a.layout ?? c.layout }
}
