import type { Carga, TipoUnion } from '../diseno/esquema'

// Engineering assumptions as data, to calibrate them without touching the rules. Pine plywood from Home Depot MX.

export const ASSUMPTIONS = {
  /** MPa, bending of pine plywood by grain against the span. Conservative; calibrate with a test at home. */
  elasticModulus: { parallel: 6000, perpendicular: 3500 },
  /** A load held for months (books) makes the sag grow. */
  creep: 1.5,
  /** kg/m² on the shelf. */
  loads: { ninguna: 0, ligera: 50, media: 100, pesada: 150 } satisfies Record<Carga, number>,
  gravity: 9.81,
  /** Sag is compared with span / limit. */
  deflectionLimit: { recommended: 360, critical: 200 },
  /** From this height up, a carcass that can rack is critical. */
  criticalRackingHeight: 600,
  joints: {
    'tope-tornillo': { b: 15, bCritical: 12 },
    bolsillo: { a: 12, b: 12 },
    tarugo: { a: 15, b: 15 },
    minifix: { a: 15, b: 15 },
    canal: { b: 15 },
    rebaje: { b: 15 },
    'bisagra-cazoleta': { a: 15 },
    'soporte-repisa': { b: 15 },
  } satisfies Partial<Record<TipoUnion, { a?: number; b?: number; bCritical?: number }>>,
  /** Depth of a groove or rabbet as a fraction of the thickness that takes it. */
  penetration: { recommended: 1 / 3, critical: 1 / 2 },
  /** Up to this thickness a piece is only nailed, or goes in a groove or rabbet. */
  nailOnlyThickness: 3,
  screws: {
    /** The least a screw goes into the piece that takes it. */
    minPenetration: 25,
    /** The least distance from a screw to the end of the joint, so the edge does not split. */
    endDistance: 25,
    /** The pocket screw that does not poke out, by the thickness of the piece with the pocket (Kreg's table). */
    pocketScrews: [
      { upTo: 13, length: 25.4 },
      { upTo: 16, length: 25.4 },
      { upTo: 19, length: 31.75 },
    ],
  },
  tipping: { recommendedRatio: 3, criticalRatio: 4, criticalHeight: 1200 },
  doors: { hinges: [{ upTo: 900, n: 2 }, { upTo: 1500, n: 3 }, { upTo: Infinity, n: 4 }], maxWidth: 600 },
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

export const hingesFor = (alto: number) => ASSUMPTIONS.doors.hinges.find((b) => alto <= b.upTo)!.n

export const RIGID_JOINTS: TipoUnion[] = ['bolsillo', 'tarugo', 'minifix', 'canal', 'rebaje', 'escuadra']
