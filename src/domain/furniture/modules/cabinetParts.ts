import type { JointGroupId } from '../../editing/joints/choice'
import type { Piece } from '../../design/schema'

// The parts of a cabinet seen from outside (UI-39): touching a piece of the closed furniture opens its part, with the choices and joints that shape it.

export type CabinetPart = 'base' | 'body' | 'doors' | 'drawers'

interface PartSpec {
  name: string
  /** The keys of the plan's fields it gathers, in the form's order. */
  fields: string[]
  joints: JointGroupId[]
}

export const CABINET_PARTS: Record<CabinetPart, PartSpec> = {
  base: { name: 'Base', fields: ['base', 'legHeight', 'wallMounted'], joints: ['base'] },
  body: { name: 'Cuerpo', fields: ['construction.top', 'construction.back', 'material'], joints: ['body', 'back'] },
  doors: { name: 'Puertas', fields: ['construction.doors', 'construction.fronts', 'construction.hinges', 'construction.pulls'], joints: [] },
  drawers: { name: 'Cajones', fields: ['construction.drawerFronts', 'construction.drawerCorners', 'drawerFingers'], joints: ['drawers'] },
}

/** The part a piece belongs to; null for the boards inside, which the interior view edits. */
export function partOfPiece(piece: Pick<Piece, 'id' | 'role'>): CabinetPart | null {
  if (piece.role === 'door') return 'doors'
  if (piece.role.startsWith('drawer-')) return 'drawers'
  if (piece.role === 'kick' || piece.role === 'apron' || piece.id.startsWith('leg') || piece.id.startsWith('bottom-support')) return 'base'
  if (piece.role === 'side' || piece.role === 'back' || piece.id === 'hanging-rail' || /^(top|bottom)(-\d+)?$/.test(piece.id)) return 'body'
  return null
}
