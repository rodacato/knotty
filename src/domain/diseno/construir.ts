import type { CaraRef, Cota, Pieza, TipoUnion, Tramo, Union } from './esquema'

export const mm = (valor: number): Cota => ({ tipo: 'mm', mm: valor })
export const ref = (cara: CaraRef, mas = 0): Cota => ({ tipo: 'ref', ref: cara, mas })
export const entre = (a: CaraRef, b: CaraRef, t: number, mas = 0): Cota => ({ tipo: 'entre', a, b, t, mas })

export const tramo = (desde: Cota | null, hasta: Cota | null, largo: number | null = null): Tramo => ({ desde, hasta, largo })
/** Para el eje normal: anclada por su cara menor. */
export const desde = (cota: Cota): Tramo => tramo(cota, null)
/** Para el eje normal: anclada por su cara mayor. */
export const hasta = (cota: Cota): Tramo => tramo(null, cota)

type Esencial = Pick<Pieza, 'id' | 'nombre' | 'rol' | 'material' | 'normal' | 'x' | 'y' | 'z'>

export const pieza = (p: Esencial & Partial<Pieza>): Pieza => ({
  veta: 'largo',
  carga: 'ninguna',
  apoyo: 'fijo',
  cantos: [],
  grupo: null,
  confianza: 'alta',
  ...p,
})

export const union = (id: string, a: string, b: string, tipo: TipoUnion, herrajes: Union['herrajes'] = [], extra: Partial<Union> = {}): Union => ({
  id,
  a,
  b,
  tipo,
  pegamento: tipo !== 'soporte-repisa' && tipo !== 'bisagra-cazoleta' && tipo !== 'corredera',
  penetracion: null,
  herrajes,
  ...extra,
})
