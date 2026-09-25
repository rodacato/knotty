import type { CaraRef, Cota, Pieza, TipoUnion, Tramo, Union } from './esquema'

// Shorthands to write pieces and joints by hand: in modules, fixtures and tests. The shapes they build are the schema's.

export const mm = (value: number): Cota => ({ tipo: 'mm', mm: value })
export const ref = (face: CaraRef, plus = 0): Cota => ({ tipo: 'ref', ref: face, mas: plus })
/** A point partway between two faces: `t` 0 is the first, 1 the second. */
export const partway = (a: CaraRef, b: CaraRef, t: number, plus = 0): Cota => ({ tipo: 'entre', a, b, t, mas: plus })

export const extent = (start: Cota | null, end: Cota | null, length: number | null = null): Tramo => ({ desde: start, hasta: end, largo: length })
/** Along the normal axis: anchored by its lower face. */
export const startAt = (cota: Cota): Tramo => extent(cota, null)
/** Along the normal axis: anchored by its upper face. */
export const endAt = (cota: Cota): Tramo => extent(null, cota)

type Essential = Pick<Pieza, 'id' | 'nombre' | 'rol' | 'material' | 'normal' | 'x' | 'y' | 'z'>

export const makePiece = (p: Essential & Partial<Pieza>): Pieza => ({
  veta: 'largo',
  carga: 'ninguna',
  apoyo: 'fijo',
  cantos: [],
  grupo: null,
  confianza: 'alta',
  ...p,
})

export const makeJoint = (id: string, a: string, b: string, tipo: TipoUnion, herrajes: Union['herrajes'] = [], extra: Partial<Union> = {}): Union => ({
  id,
  a,
  b,
  tipo,
  pegamento: tipo !== 'soporte-repisa' && tipo !== 'bisagra-cazoleta' && tipo !== 'corredera',
  penetracion: null,
  herrajes,
  ...extra,
})
