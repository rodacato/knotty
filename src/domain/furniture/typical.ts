import type { DesignKind } from '../design/kind'
import type { Dimensions } from '../design/schema'
import { TYPICAL_TABLE_DIMENSIONS } from './modules/table'

// Where a design starts when the person adds measures: the usual size of that kind of furniture.
// From docs/carpinteria/muebles-y-medidas.md where it gives one; cabinet, shoe rack, drawers, sideboard, TV stand, benchtop and bench are workshop estimates.

export const TYPICAL_DIMENSIONS: Record<DesignKind, Dimensions> = {
  cabinet: { width: 600, height: 800, depth: 580 },
  bookcase: { width: 800, height: 2000, depth: 280 },
  wardrobe: { width: 1000, height: 2010, depth: 580 },
  wallCabinet: { width: 600, height: 700, depth: 330 },
  shoeRack: { width: 800, height: 1000, depth: 330 },
  drawers: { width: 800, height: 900, depth: 450 },
  nightstand: { width: 450, height: 660, depth: 400 },
  sideboard: { width: 1600, height: 900, depth: 450 },
  tvStand: { width: 1600, height: 500, depth: 400 },
  kitchenBase: { width: 600, height: 900, depth: 600 },
  // A matrimonial mattress (1350 × 1900) with its play, on a base of 350.
  bed: { width: 1960, height: 350, depth: 1390 },
  table: TYPICAL_TABLE_DIMENSIONS.dining,
  diningTable: TYPICAL_TABLE_DIMENSIONS.dining,
  desk: TYPICAL_TABLE_DIMENSIONS.desk,
  coffeeTable: TYPICAL_TABLE_DIMENSIONS.coffee,
  sideTable: TYPICAL_TABLE_DIMENSIONS.side,
  workbench: TYPICAL_TABLE_DIMENSIONS.standing,
  benchtop: { width: 1050, height: 136, depth: 500 },
  bench: TYPICAL_TABLE_DIMENSIONS.seat,
}

/** What Capture accepts for each measure, in mm; a bed is the deepest furniture Knotty builds. */
export const MEASURE_RANGE: Record<keyof Dimensions, readonly [number, number]> = { height: [100, 2400], width: [200, 2400], depth: [150, 2400] }

/** Where measures start when the kind is not chosen yet: the size Capture always started from. */
export const DEFAULT_DIMENSIONS: Dimensions = { width: 600, height: 1800, depth: 300 }

export const typicalDimensions = (kind: DesignKind | null): Dimensions => (kind ? TYPICAL_DIMENSIONS[kind] : DEFAULT_DIMENSIONS)
