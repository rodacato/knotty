import type { Load } from '../design/schema'

// Engineering assumptions as data, to calibrate them without touching the rules. Pine plywood from Home Depot MX.
// What depends on the board (its stiffness) is in materials/grades.ts.

export const ASSUMPTIONS = {
  /** Final sag ÷ initial sag: a load that stays (books, dishes, clothes, a TV) makes it grow; one that passes (a person) does not.
   * docs/carpinteria/valores-de-referencia.md §4 «Fluencia» (NDS K_cr, Eurocode 5, Wood Handbook). */
  creep: { permanent: 2, passing: 1 },
  /** kg/m² on the shelf. */
  loads: { none: 0, light: 50, medium: 100, heavy: 150 } satisfies Record<Load, number>,
  gravity: 9.81,
  /** Final sag is compared with span / limit: past the first it shows, past the second the shelf looks badly bowed.
   * docs/carpinteria/valores-de-referencia.md §4 «Flecha final sin pandeo visible» and «Flecha final límite». */
  deflectionLimit: { recommended: 360, critical: 100 },
  /** From this height up, a carcass that can rack is critical. */
  criticalRackingHeight: 600,
  /** Depth of a groove or rabbet as a fraction of the thickness that takes it. */
  penetration: { recommended: 1 / 3, critical: 1 / 2 },
  /** Up to this thickness a piece is only nailed, or goes in a groove or rabbet. */
  nailOnlyThickness: 3,
  screws: {
    /** The least a screw goes into the piece that takes it. */
    minPenetration: 25,
    /** The least distance from a screw to the end of the joint, so the edge does not split. */
    endDistance: 25,
    /** The pocket screw that does not poke out, by the thickness of the piece with the pocket (Kreg's table), and the catalog item that is it. */
    pocketScrews: [
      { upTo: 13, length: 25.4, hardwareId: 'pocket-screw-1' },
      { upTo: 16, length: 25.4, hardwareId: 'pocket-screw-1' },
      { upTo: 19, length: 31.75, hardwareId: 'pocket-screw-1-1/4' },
    ],
  },
  tipping: {
    /** Furniture with drawers or doors from this height up is anchored, whatever its depth: the threshold of ASTM F2057-23.
     * docs/carpinteria/valores-de-referencia.md §12 «Altura desde la que se ancla». */
    storageHeight: 686,
    /** Open furniture (no drawers or doors): height ÷ depth from which it is anchored, and from which it is very unstable past criticalHeight.
     * docs/carpinteria/valores-de-referencia.md §12 «Librero sin cajones». */
    recommendedRatio: 3,
    criticalRatio: 4,
    criticalHeight: 1200,
  },
  /** Hinges by the height of the door (Blum's table, the rows past a sheet's length would never apply), and the widest single leaf. */
  doors: {
    hinges: [
      { upTo: 900, n: 2 },
      { upTo: 1600, n: 3 },
      { upTo: 2000, n: 4 },
      { upTo: 2400, n: 5 },
    ],
    maxWidth: 600,
  },
  /** The longest span of a floor with no support in between, when it does not rest on the ground. */
  floorSpan: 800,
  drawers: {
    /** How far the runner gap may be from what the maker asks. */
    runnerTolerance: 1,
    minBottom: 6,
    /** Past this width, a drawer bottom thinner than the minimum sags. */
    thinBottomWidth: 450,
    /** Minimum gap between a drawer and the ground, so it opens without dragging. */
    floorClearance: 10,
  },
} as const

/** The pocket screw for the piece with the pocket: 1" up to 16 mm, 1¼" for 18–19 mm. Undefined past the table. */
export const pocketScrewFor = (thickness: number) => ASSUMPTIONS.screws.pocketScrews.find((f) => thickness <= f.upTo)
/** The catalog id of that screw; past the table, the longest one there is. */
export const pocketScrewId = (thickness: number) => (pocketScrewFor(thickness) ?? ASSUMPTIONS.screws.pocketScrews.at(-1)!).hardwareId

/** Whether a load stays (what a shelf holds) or passes (a person on a bed or a bench): only the first creeps. */
export type LoadDuration = keyof typeof ASSUMPTIONS.creep

/** How many hinges a door this tall takes; taller than the table, as many as its last row. */
export const hingesFor = (height: number) => (ASSUMPTIONS.doors.hinges.find((b) => height <= b.upTo) ?? ASSUMPTIONS.doors.hinges.at(-1)!).n
