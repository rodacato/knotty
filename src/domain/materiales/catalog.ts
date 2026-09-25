import { z } from 'zod'

// The catalog is data, not code: it loads from public/catalogo/*.json and the person can override prices.
// Its field names are the JSON's and stay in Spanish until the data moves to English (step 9).

export const BoardMaterial = z.object({
  id: z.string(),
  nombre: z.string(),
  tipo: z.enum(['triplay', 'trasera']),
  espesor: z.number().positive(),
  hoja: z.object({ largo: z.number().positive(), ancho: z.number().positive() }),
  sku: z.string().nullable(),
  precio: z.number().nonnegative().nullable(),
})
export type BoardMaterial = z.infer<typeof BoardMaterial>

export const Hardware = z.object({
  id: z.string(),
  nombre: z.string(),
  unidad: z.enum(['pieza', 'paquete', 'metro', 'frasco']),
  porPaquete: z.number().int().positive().nullable(),
  largo: z.number().positive().nullable().default(null).describe('Tornillos y correderas: largo en mm'),
  holguraLateral: z.number().nonnegative().nullable().default(null).describe('Correderas: espacio por lado entre el cajón y el mueble'),
  sku: z.string().nullable(),
  precio: z.number().nonnegative().nullable(),
})
export type Hardware = z.infer<typeof Hardware>

export const LayoutSettings = z.object({
  refilado: z.number().nonnegative().describe('Canto de fábrica que se recorta por lado'),
  sierra: z.number().nonnegative().describe('Ancho del corte'),
  holgura: z.number().nonnegative().describe('Holgura por pieza'),
})
export type LayoutSettings = z.infer<typeof LayoutSettings>

export const Catalog = z.object({
  materiales: z.array(BoardMaterial).min(1),
  herrajes: z.array(Hardware),
  acomodo: LayoutSettings,
  notaPrecios: z.string().nullable().default(null),
})
export type Catalog = z.infer<typeof Catalog>

export const materialById = (catalog: Catalog, id: string) => catalog.materiales.find((m) => m.id === id)

/** The sheet without its factory edge: the most a piece can measure without joining boards. */
export const usableSheet = (catalog: Catalog, material: BoardMaterial) => ({
  largo: material.hoja.largo - 2 * catalog.acomodo.refilado,
  ancho: material.hoja.ancho - 2 * catalog.acomodo.refilado,
})

/** What the person changes in the catalog on their device: their store's prices and cutting settings. */
export interface CatalogSettings {
  precios: Record<string, number | null>
  acomodo: LayoutSettings | null
}

export const NO_SETTINGS: CatalogSettings = { precios: {}, acomodo: null }

export function applySettings(c: Catalog, a: CatalogSettings): Catalog {
  const priced = <T extends { id: string; precio: number | null }>(x: T): T => (x.id in a.precios ? { ...x, precio: a.precios[x.id] } : x)
  return { ...c, materiales: c.materiales.map(priced), herrajes: c.herrajes.map(priced), acomodo: a.acomodo ?? c.acomodo }
}
