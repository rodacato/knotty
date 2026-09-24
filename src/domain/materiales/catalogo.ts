import { z } from 'zod'

// El catálogo es dato, no código: se carga de public/catalogo/*.json y el usuario puede sobreescribir precios.

export const MaterialTablero = z.object({
  id: z.string(),
  nombre: z.string(),
  tipo: z.enum(['triplay', 'trasera']),
  espesor: z.number().positive(),
  hoja: z.object({ largo: z.number().positive(), ancho: z.number().positive() }),
  sku: z.string().nullable(),
  precio: z.number().nonnegative().nullable(),
})
export type MaterialTablero = z.infer<typeof MaterialTablero>

export const Herraje = z.object({
  id: z.string(),
  nombre: z.string(),
  unidad: z.enum(['pieza', 'paquete', 'metro', 'frasco']),
  porPaquete: z.number().int().positive().nullable(),
  largo: z.number().positive().nullable().default(null).describe('Tornillos: largo en mm'),
  sku: z.string().nullable(),
  precio: z.number().nonnegative().nullable(),
})
export type Herraje = z.infer<typeof Herraje>

export const Acomodo = z.object({
  refilado: z.number().nonnegative().describe('Canto de fábrica que se recorta por lado'),
  sierra: z.number().nonnegative().describe('Ancho del corte'),
  holgura: z.number().nonnegative().describe('Holgura por pieza'),
})
export type Acomodo = z.infer<typeof Acomodo>

export const Catalogo = z.object({
  materiales: z.array(MaterialTablero).min(1),
  herrajes: z.array(Herraje),
  acomodo: Acomodo,
  notaPrecios: z.string().nullable().default(null),
})
export type Catalogo = z.infer<typeof Catalogo>

export const materialPorId = (catalogo: Catalogo, id: string) => catalogo.materiales.find((m) => m.id === id)

/** La hoja sin el canto de fábrica: lo máximo que mide una pieza sin empalmar tableros. */
export const hojaUtil = (catalogo: Catalogo, material: MaterialTablero) => ({
  largo: material.hoja.largo - 2 * catalogo.acomodo.refilado,
  ancho: material.hoja.ancho - 2 * catalogo.acomodo.refilado,
})

/** Lo que el usuario cambia del catálogo en su dispositivo: precios de su tienda y parámetros de corte. */
export interface AjustesCatalogo {
  precios: Record<string, number | null>
  acomodo: Acomodo | null
}

export const SIN_AJUSTES: AjustesCatalogo = { precios: {}, acomodo: null }

export function aplicarAjustes(c: Catalogo, a: AjustesCatalogo): Catalogo {
  const precio = <T extends { id: string; precio: number | null }>(x: T): T => (x.id in a.precios ? { ...x, precio: a.precios[x.id] } : x)
  return { ...c, materiales: c.materiales.map(precio), herrajes: c.herrajes.map(precio), acomodo: a.acomodo ?? c.acomodo }
}
