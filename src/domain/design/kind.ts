import { z } from 'zod'

// What a piece of furniture is, as data: one vocabulary for the modules Knotty builds (cabinet, bed, table) and for the checks by use (a bookcase, a desk, a dining table).
// A module kind is the general word; a use is more precise and says which checks apply. 'cabinet' and 'table' alone mean "a box" or "a table" whose use is not known.

export const DESIGN_KINDS = [
  'cabinet', 'bookcase', 'wardrobe', 'wallCabinet', 'shoeRack', 'drawers', 'nightstand', 'sideboard', 'tvStand',
  'bed',
  'table', 'desk', 'diningTable', 'coffeeTable', 'sideTable',
  'bench',
] as const
export const DesignKind = z.enum(DESIGN_KINDS)
export type DesignKind = z.infer<typeof DesignKind>

/** Each kind as the person says it, with its article: «un librero», «una cama». */
export const KIND_NOUN: Record<DesignKind, string> = {
  cabinet: 'un gabinete', bookcase: 'un librero', wardrobe: 'un clóset', wallCabinet: 'una alacena', shoeRack: 'una zapatera', drawers: 'una cajonera',
  nightstand: 'un buró', sideboard: 'un aparador', tvStand: 'un mueble de TV',
  bed: 'una cama',
  table: 'una mesa', desk: 'un escritorio', diningTable: 'una mesa de comedor', coffeeTable: 'una mesa de centro', sideTable: 'una mesa lateral',
  bench: 'una banca',
}

/** The kind without its article, for a list: «Mesa de comedor». */
export const kindLabel = (kind: DesignKind) => {
  const noun = KIND_NOUN[kind].replace(/^una? /, '')
  return noun.charAt(0).toUpperCase() + noun.slice(1)
}

/**
 * Where the kind came from, from most to least trusted: the person chose it; an example or a plan says it; the photos show it; the words suggest it.
 * Knotty never overrides what the person chose.
 */
export const KIND_SOURCES = ['person', 'example', 'plan', 'photo', 'words'] as const
export const KindSource = z.enum(KIND_SOURCES)
export type KindSource = z.infer<typeof KindSource>

/** Mattress sizes sold in Mexico; their measures live with the bed module. */
export const MATTRESS_SIZES = ['individual', 'matrimonial', 'queen', 'king'] as const
export const MattressSize = z.enum(MATTRESS_SIZES)
export type MattressSize = z.infer<typeof MattressSize>
