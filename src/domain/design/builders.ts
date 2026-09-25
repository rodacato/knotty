import type { FaceRef, Position, Piece, JointType, Extent, Joint } from './schema'

// Shorthands to write pieces and joints by hand: in modules, fixtures and tests. The shapes they build are the schema's.

export const mm = (value: number): Position => ({ type: 'mm', mm: value })
export const ref = (face: FaceRef, plus = 0): Position => ({ type: 'ref', ref: face, offset: plus })
/** A point partway between two faces: `t` 0 is the first, 1 the second. */
export const partway = (a: FaceRef, b: FaceRef, t: number, plus = 0): Position => ({ type: 'between', a, b, t, offset: plus })

export const extent = (start: Position | null, end: Position | null, length: number | null = null): Extent => ({ from: start, to: end, length: length })
/** Along the normal axis: anchored by its lower face. */
export const startAt = (position: Position): Extent => extent(position, null)
/** Along the normal axis: anchored by its upper face. */
export const endAt = (position: Position): Extent => extent(null, position)

type Essential = Pick<Piece, 'id' | 'name' | 'role' | 'material' | 'normal' | 'x' | 'y' | 'z'>

export const makePiece = (p: Essential & Partial<Piece>): Piece => ({
  grain: 'length',
  load: 'none',
  support: 'fixed',
  edges: [],
  group: null,
  confidence: 'high',
  ...p,
})

export const makeJoint = (id: string, a: string, b: string, type: JointType, hardware: Joint['hardware'] = [], extra: Partial<Joint> = {}): Joint => ({
  id,
  a,
  b,
  type,
  glue: type !== 'shelf-pin' && type !== 'cup-hinge' && type !== 'drawer-slide',
  depth: null,
  hardware,
  ...extra,
})
