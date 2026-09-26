import type { Load } from '../design/schema'
import { cite, noReference, STRUCTURE, JOINTS_DOC, VALUES, type Source } from '../sources'

// Engineering assumptions as data, to calibrate them without touching the rules, each with its source (ASSUMPTION_SOURCES). Pine plywood from Home Depot MX.
// What depends on the board (its stiffness) is in materials/grades.ts.

export const ASSUMPTIONS = {
  /** Final sag ÷ initial sag: a load that stays (books, dishes, clothes, a TV) makes it grow; one that passes (a person) does not (NDS K_cr, Eurocode 5, Wood Handbook). */
  creep: { permanent: 2, passing: 1 },
  /** kg/m² on the shelf. */
  loads: { none: 0, light: 50, medium: 100, heavy: 150 } satisfies Record<Load, number>,
  gravity: 9.81,
  /** Final sag is compared with span / limit: past the first it shows, past the second the shelf looks badly bowed. */
  deflectionLimit: { recommended: 360, critical: 100 },
  racking: {
    /** From this height up, a carcass that can rack is critical. */
    criticalHeight: 600,
    /** A back this thick squares the carcass when it is joined to this many pieces of the perimeter; thinner, only glued in a groove or rabbet. */
    nailedBackThickness: 6,
    backJoins: 3,
    /** Rigid rails (one of them the top back rail or the kick) that square a carcass with no back. */
    rigidRails: 2,
  },
  /** Depth of a groove or rabbet as a fraction of the thickness that takes it. */
  penetration: { recommended: 1 / 3, critical: 1 / 2 },
  /** Up to this thickness a piece is only nailed, or goes in a groove or rabbet. */
  nailOnlyThickness: 3,
  screws: {
    /** The least a screw goes into the piece that takes it. */
    minPenetration: 25,
    /** The least distance from a screw to the end of the joint, so the edge does not split. */
    endDistance: 25,
    /** Face against face, a screw stays this far short of coming out the other side. */
    faceMargin: 3,
    /** Between the two screws of a joint, besides each one's end distance. */
    pairRoom: 20,
    /** The pocket screw that does not poke out, by the thickness of the piece with the pocket (Kreg's table), and the catalog item that is it. */
    pocketScrews: [
      { upTo: 13, length: 25.4, hardwareId: 'pocket-screw-1' },
      { upTo: 16, length: 25.4, hardwareId: 'pocket-screw-1' },
      { upTo: 19, length: 31.75, hardwareId: 'pocket-screw-1-1/4' },
    ],
  },
  tipping: {
    /** Furniture with drawers or doors from this height up is anchored, whatever its depth: the threshold of ASTM F2057-23. */
    storageHeight: 686,
    /** Open furniture (no drawers or doors): height ÷ depth from which it is anchored, and from which it is very unstable past criticalHeight. */
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
  /** A floor rests on a run (a kick, a rail) that is under at least this share of its length. */
  floorRunShare: 0.8,
  /** A piece this many times longer than wide shows its grain running across. */
  grainRatio: 1.5,
  drawers: {
    /** How much wider than the maker asks the runner gap may be, and how much narrower: a slide takes a little more, never less. */
    runnerTolerance: { over: 0.8, under: 0 },
    minBottom: 6,
    /** Past this width, a drawer bottom thinner than the minimum sags. */
    thinBottomWidth: 300,
    /** Minimum gap between a drawer and the ground, so it opens without dragging. */
    floorClearance: 10,
    /** Gap around a drawer front, so it does not rub what is beside it. */
    frontClearance: 2,
  },
} as const

/**
 * Where each assumption comes from, by its path in ASSUMPTIONS; a group's source covers what is inside it.
 * sources.test.ts fails when an assumption has none or a row is not in its file.
 */
export const ASSUMPTION_SOURCES: Record<string, Source> = {
  creep: cite(VALUES, '4-pandeo', 'Fluencia (flecha final ÷ flecha inicial)'),
  'loads.none': cite(VALUES, '5-cargas', 'Sin carga'),
  'loads.light': cite(VALUES, '5-cargas', 'Carga ligera'),
  'loads.medium': cite(VALUES, '5-cargas', 'Carga media'),
  'loads.heavy': cite(VALUES, '5-cargas', 'Carga pesada (libros)'),
  gravity: noReference('standard gravity in m/s², physics rather than a craft number'),
  'deflectionLimit.recommended': cite(VALUES, '4-pandeo', 'Flecha final sin pandeo visible'),
  'deflectionLimit.critical': cite(VALUES, '4-pandeo', 'Flecha final límite'),
  'racking.criticalHeight': cite(STRUCTURE, '2-rigidez-y-escuadrado-racking', 'A partir de ≈ 600 mm de alto'),
  'racking.nailedBackThickness': cite(STRUCTURE, '2-rigidez-y-escuadrado-racking', 'trasera de 6 mm unida a por lo menos 3 piezas del perímetro'),
  'racking.backJoins': cite(STRUCTURE, '2-rigidez-y-escuadrado-racking', 'trasera de 6 mm unida a por lo menos 3 piezas del perímetro'),
  'racking.rigidRails': cite(STRUCTURE, '2-rigidez-y-escuadrado-racking', 'un marco con al menos 2 travesaños rígidos'),
  // The reference gives ⅓ and ½ for a groove and ½ and ⅔ for a rabbet: both are checked with the groove's, the stricter.
  penetration: cite(VALUES, '6-uniones', 'Profundidad de ranura'),
  nailOnlyThickness: cite(JOINTS_DOC, '7-largo-de-tornillo-por-combinación-de-espesores', 'Trasera 3 → canto de 12/15/18'),
  'screws.minPenetration': cite(VALUES, '6-uniones', 'Tornillo a tope: penetración en el canto'),
  'screws.endDistance': cite(VALUES, '6-uniones', 'Tornillo a tope: distancia al extremo / separación'),
  'screws.faceMargin': cite(JOINTS_DOC, '7-largo-de-tornillo-por-combinación-de-espesores', 'que no se asome: largo ≤ ta + tb − 3'),
  'screws.pairRoom': noReference('Knotty’s room between two screws near the ends of a short joint; the reference only spaces them 150–200 apart on long ones'),
  'screws.pocketScrews': cite(VALUES, '6-uniones', 'Tornillo de bolsillo'),
  'tipping.storageHeight': cite(VALUES, '12-vuelco-y-anclaje', 'Altura desde la que se ancla'),
  'tipping.recommendedRatio': cite(VALUES, '12-vuelco-y-anclaje', 'Librero sin cajones'),
  'tipping.criticalRatio': cite(VALUES, '12-vuelco-y-anclaje', 'Librero sin cajones'),
  'tipping.criticalHeight': cite(VALUES, '12-vuelco-y-anclaje', 'Librero sin cajones'),
  'doors.hinges': cite(VALUES, '8-puertas', 'Bisagras por altura de puerta'),
  'doors.maxWidth': cite(VALUES, '8-puertas', 'Ancho máximo de una hoja'),
  floorSpan: cite(STRUCTURE, '71-patas-o-zoclo', 'un piso de más de 800 mm sin apoyo intermedio necesita revisión'),
  floorRunShare: noReference('how Knotty reads «zoclo corrido»: a run under most of the floor, not a block at one end'),
  grainRatio: noReference('where a piece starts to read as long, so grain across it shows; the reference only says the grain runs along the span'),
  'drawers.runnerTolerance': cite(VALUES, '9-cajones', 'Holgura de corredera de balines'),
  'drawers.minBottom': cite(VALUES, '9-cajones', 'Fondo de cajón'),
  'drawers.thinBottomWidth': cite(STRUCTURE, '43-fondo-de-cajón-3-contra-6-mm', '3 mm solo en cajones de menos de 300 mm de ancho'),
  'drawers.floorClearance': noReference('Knotty’s least gap under a drawer so it clears an uneven floor; the reference gives none'),
  'drawers.frontClearance': cite(VALUES, '8-puertas', 'Separación entre frentes'),
}

/** The pocket screw for the piece with the pocket: 1" up to 16 mm, 1¼" for 18–19 mm. Undefined past the table. */
export const pocketScrewFor = (thickness: number) => ASSUMPTIONS.screws.pocketScrews.find((f) => thickness <= f.upTo)
/** The catalog id of that screw; past the table, the longest one there is. */
export const pocketScrewId = (thickness: number) => (pocketScrewFor(thickness) ?? ASSUMPTIONS.screws.pocketScrews.at(-1)!).hardwareId

/** Whether a load stays (what a shelf holds) or passes (a person on a bed or a bench): only the first creeps. */
export type LoadDuration = keyof typeof ASSUMPTIONS.creep

/** How many hinges a door this tall takes; taller than the table, as many as its last row. */
export const hingesFor = (height: number) => (ASSUMPTIONS.doors.hinges.find((b) => height <= b.upTo) ?? ASSUMPTIONS.doors.hinges.at(-1)!).n
