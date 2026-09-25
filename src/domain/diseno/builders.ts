import type { FaceRef, Position, Piece, JointType, Extent, Joint } from './schema'

// Shorthands to write pieces and joints by hand: in modules, fixtures and tests. The shapes they build are the schema's.

export const mm = (value: number): Position => ({ tipo: 'mm', mm: value })
export const ref = (face: FaceRef, plus = 0): Position => ({ tipo: 'ref', ref: face, mas: plus })
/** A point partway between two faces: `t` 0 is the first, 1 the second. */
export const partway = (a: FaceRef, b: FaceRef, t: number, plus = 0): Position => ({ tipo: 'entre', a, b, t, mas: plus })

export const extent = (start: Position | null, end: Position | null, length: number | null = null): Extent => ({ desde: start, hasta: end, largo: length })
/** Along the normal axis: anchored by its lower face. */
export const startAt = (cota: Position): Extent => extent(cota, null)
/** Along the normal axis: anchored by its upper face. */
export const endAt = (cota: Position): Extent => extent(null, cota)

type Essential = Pick<Piece, 'id' | 'nombre' | 'rol' | 'material' | 'normal' | 'x' | 'y' | 'z'>

export const makePiece = (p: Essential & Partial<Piece>): Piece => ({
  veta: 'largo',
  carga: 'ninguna',
  apoyo: 'fijo',
  cantos: [],
  grupo: null,
  confianza: 'alta',
  ...p,
})

export const makeJoint = (id: string, a: string, b: string, tipo: JointType, herrajes: Joint['herrajes'] = [], extra: Partial<Joint> = {}): Joint => ({
  id,
  a,
  b,
  tipo,
  pegamento: tipo !== 'soporte-repisa' && tipo !== 'bisagra-cazoleta' && tipo !== 'corredera',
  penetracion: null,
  herrajes,
  ...extra,
})
