import type { JointGroupId } from '../../editing/joints/choice'
import type { Piece } from '../../design/schema'

// The parts of a cabinet (UI-39): the list in the panel, and what touching a piece of the closed furniture opens, with the choices and joints that shape each.

export type CabinetPart = 'size' | 'wood' | 'base' | 'body' | 'doors' | 'drawers' | 'cells'

interface PartSpec {
  name: string
  /** Seen from outside, or edited from the interior view. */
  side: 'outside' | 'inside'
  /** The keys of the plan's fields it gathers, in the form's order. */
  fields: string[]
  joints: JointGroupId[]
}

export const CABINET_PARTS: Record<CabinetPart, PartSpec> = {
  size: { name: 'Tamaño', side: 'outside', fields: ['dimensions.height', 'dimensions.width', 'dimensions.depth'], joints: [] },
  wood: { name: 'Madera y acabado', side: 'outside', fields: ['material'], joints: [] },
  base: { name: 'Base', side: 'outside', fields: ['base', 'legHeight', 'wallMounted'], joints: ['base'] },
  body: { name: 'Cuerpo', side: 'outside', fields: ['construction.top', 'construction.back'], joints: ['body', 'back'] },
  doors: { name: 'Puertas', side: 'outside', fields: ['construction.doors', 'construction.fronts', 'construction.hinges', 'construction.pulls'], joints: [] },
  drawers: { name: 'Cajones', side: 'outside', fields: ['construction.drawerFronts', 'construction.drawerCorners', 'drawerFingers'], joints: ['drawers'] },
  cells: { name: 'Huecos y repisas', side: 'inside', fields: ['construction.shelves'], joints: [] },
}

/** The part a piece of the closed furniture belongs to; null for the boards inside, which the interior view edits. */
export function partOfPiece(piece: Pick<Piece, 'id' | 'role'>): CabinetPart | null {
  if (piece.role === 'door') return 'doors'
  if (piece.role.startsWith('drawer-')) return 'drawers'
  if (piece.role === 'kick' || piece.role === 'apron' || piece.id.startsWith('leg') || piece.id.startsWith('bottom-support')) return 'base'
  if (piece.role === 'side' || piece.role === 'back' || piece.id === 'hanging-rail' || /^(top|bottom)(-\d+)?$/.test(piece.id)) return 'body'
  return null
}
