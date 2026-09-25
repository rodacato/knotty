import { z } from 'zod'

// The catalog is data, not code: it loads from public/catalog/*.json and the person can override prices.
// Its field names are the JSON's; the person's saved prices refer to material and hardware ids.

export const BoardMaterial = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['plywood', 'back']),
  thickness: z.number().positive(),
  sheet: z.object({ length: z.number().positive(), width: z.number().positive() }),
  sku: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
})
export type BoardMaterial = z.infer<typeof BoardMaterial>

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

export const Catalog = z.object({
  materials: z.array(BoardMaterial).min(1),
  hardware: z.array(Hardware),
  layout: LayoutSettings,
  priceNote: z.string().nullable().default(null),
})
export type Catalog = z.infer<typeof Catalog>

export const materialById = (catalog: Catalog, id: string) => catalog.materials.find((m) => m.id === id)

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
