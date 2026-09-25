import { z } from 'zod'

// What a piece of furniture is, as data: one vocabulary for the modules Knotty builds (cabinet, bed, table) and for the checks by use (a bookcase, a desk, a dining table).
// A module kind is the general word; a use is more precise and says which checks apply. 'cabinet' and 'table' alone mean "a box" or "a table" whose use is not known.

export const DESIGN_KINDS = [
  'cabinet', 'bookcase', 'wardrobe', 'wallCabinet', 'shoeRack', 'drawers', 'nightstand',
  'bed',
  'table', 'desk', 'diningTable', 'coffeeTable', 'sideTable',
  'bench',
] as const
export const DesignKind = z.enum(DESIGN_KINDS)
export type DesignKind = z.infer<typeof DesignKind>

/** Mattress sizes sold in Mexico; their measures live with the bed module. */
export const MATTRESS_SIZES = ['individual', 'matrimonial', 'queen', 'king'] as const
export const MattressSize = z.enum(MATTRESS_SIZES)
export type MattressSize = z.infer<typeof MattressSize>
