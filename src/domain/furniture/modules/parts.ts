import type { JointGroupId } from '../../editing/joints/choice'
import type { Piece } from '../../design/schema'

// The parts of a piece of furniture (UI-39): the list in the panel, and what touching a piece of it opens, with the choices and joints that shape each.

export interface PartSpec<P> {
  id: string
  /** Its name in the list; `nameOf` when it depends on the plan, as a desk's pedestal does. */
  name: string
  nameOf?: (plan: P) => string
  /** Seen from outside, or kept inside the furniture. */
  side: 'outside' | 'inside'
  /** The keys of the plan's fields it gathers. */
  fields: string[]
  joints: JointGroupId[]
  /** How it is now, in one line; `finish` is the name of the design's finish. */
  summary(plan: P, finish: string): string
}

export interface Parts<P> {
  list: PartSpec<P>[]
  /** The part a piece belongs to; null for a piece edited some other way, as a cabinet's boards inside. */
  ofPiece(piece: Pick<Piece, 'id' | 'role'>): string | null
}

export const partName = <P>(part: PartSpec<P>, plan: P) => part.nameOf?.(plan) ?? part.name

const thickness = (material: string) => material.replace(/\D/g, '')

/** The board and its finish: every kind has them, and no piece to touch. */
export const woodPart = <P extends { material: string }>(): PartSpec<P> => ({
  id: 'wood',
  name: 'Madera y acabado',
  side: 'outside',
  fields: ['material'],
  joints: [],
  summary: (plan, finish) => `Triplay de ${thickness(plan.material)} mm · ${finish}`,
})

/** The outside measures, for the kinds whose plan says them. */
export const sizePart = <P extends { dimensions: { width: number; height: number; depth: number } }>(): PartSpec<P> => ({
  id: 'size',
  name: 'Tamaño',
  side: 'outside',
  fields: ['dimensions.height', 'dimensions.width', 'dimensions.depth'],
  joints: [],
  summary: ({ dimensions: d }) => `${d.height} de alto × ${d.width} de ancho × ${d.depth} de fondo, en mm`,
})

export const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
