import { cite, noReference, STRUCTURE, JOINTS_DOC, VALUES, type Source } from './sources'

// Engineering assumptions as data, to calibrate them without touching the rules, each with its source (ASSUMPTION_SOURCES). Pine plywood from Home Depot MX.
// What depends on the board (its stiffness) is in materials/grades.ts.

export const ASSUMPTIONS = {
  /** Final sag ÷ initial sag: a load that stays (books, dishes, clothes, a TV) makes it grow; one that passes (a person) does not (NDS K_cr, Eurocode 5, Wood Handbook). */
  creep: { permanent: 2, passing: 1 },
  /** kg/m² on the shelf. */
  loads: { none: 0, light: 50, medium: 100, heavy: 150 },
  gravity: 9.81,
  /** A board is thinner than its nominal thickness by this much (18 → 17.5); the sag is judged with the real one. */
  realThicknessAllowance: 0.5,
  /** Thinner boards (backs, drawer bottoms) are not taken to fall short: the allowance is only known for the carcass boards. */
  realThicknessFrom: 9,
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
    /** Share of storageHeight just below it where the verdict is a recommendation, so a few mm of measuring do not flip it between critical and nothing. */
    storageMargin: 0.1,
    /** Mass of plywood in the balance, kg/m³: the light density, since a lighter piece is the worst case for tipping. */
    density: 500,
    /** Clothes in a drawer, kg per m³ of its inside (the stability test of ASTM F2057-23). */
    drawerLoad: 136,
    /** A child hanging from the edge of the highest drawer that is no higher than reach: kg and mm. */
    child: { mass: 27.2, reach: 1422 },
    /** From this share of what pulls the furniture forward against what holds it up, the verdict is a recommendation; at 1 it is critical. */
    balanceMargin: 0.8,
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
  /** Sliding doors: each leaf runs in a groove of the board under its opening and another of the board over it. */
  sliding: {
    /** How far two leaves overlap where they meet; a single leaf covers half of its opening and half of this. */
    overlap: 25,
    /** The wood left in front of the first groove. */
    lip: 10,
    /** The gap between two leaves, so one passes the other. */
    between: 3,
    /** How far a leaf goes into each groove, as a share of the board; the groove above is cut twice as deep, so the leaf lifts in and out. */
    engagement: 1 / 4,
    /** Under this width of opening, sliding leaves leave little room to reach in: with two, less than half of it. */
    narrowOpening: 500,
  },
  /** A lid that lifts: the floor of an open cell, hinged at the back, over a chest. */
  lids: {
    /** The strip that stays fixed at the back, which the hinge is screwed to: wide enough for two screws at each end. */
    strip: 80,
    /** The least a lid has to open, in degrees, before what is above it gets in the way of reaching in. */
    minOpening: 60,
    /** What one friction stay holds, in N·m, and how many a lid takes at most: one by each wall. */
    stayTorque: 3,
    maxStays: 2,
  },
  /** A closet rod: a tube between two uprights, under the top of its opening. */
  pulls: {
    /** Less room than this beside an edge of a front and a finger does not get behind it. */
    fingerRoom: 20,
  },
  rods: {
    /** From the board over it down to the middle of the rod: room to get a hanger's hook over it. */
    drop: 50,
    /** The longest a rod runs with no support in the middle. */
    maxSpan: 1000,
    /** The least clear height under it: what a shirt or a jacket takes hanging. */
    shortHang: 900,
  },
  /** The longest span of a floor with no support in between, when it does not rest on the ground. */
  floorSpan: 800,
  /** A floor rests on a run (a kick, a rail) that is under at least this share of its length. */
  floorRunShare: 0.8,
  legs: {
    /** The widest gap between two legs, along the width, before the furniture needs legs in between. */
    maxSpan: 1200,
    /** A piece on the floor no longer or deeper than this is a leg, not a panel or a kick. */
    footprint: 150,
  },
  /** A piece this many times longer than wide shows its grain running across. */
  grainRatio: 1.5,
  drawers: {
    /** How much wider than the maker asks the runner gap may be, and how much narrower: a slide takes a little more, never less. */
    runnerTolerance: { over: 0.8, under: 0 },
    /** The gap the box is built with on each side: the middle of what a ball-bearing slide takes, so a cut half a millimetre off still goes in. */
    boxClearance: 13,
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
  realThicknessAllowance: cite(VALUES, '1-material', 'Espesor real'),
  realThicknessFrom: noReference('the reference gives the shortfall for 15 and 18 mm boards only; Knotty does not extend it to the 3 and 6 mm backs and bottoms'),
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
  'tipping.storageMargin': noReference('Knotty’s tolerance for reading a height off a photo or a tape; the reference gives the 686 line and no band around it, and says depth does not rescue a chest'),
  'tipping.density': cite(STRUCTURE, '6-vuelco-y-anclaje', 'triplay de 500 kg/m³'),
  'tipping.drawerLoad': cite(VALUES, '12-vuelco-y-anclaje', 'ropa 136 kg/m³'),
  'tipping.child': cite(VALUES, '12-vuelco-y-anclaje', '27.2 kg en la orilla del cajón más alto (hasta 1422 mm)'),
  'tipping.balanceMargin': noReference('Knotty’s tolerance for a balance built from a simplified model (drawers fully out, doors open at 90°); the reference gives the test and no band around it'),
  'tipping.recommendedRatio': cite(VALUES, '12-vuelco-y-anclaje', 'Librero sin cajones'),
  'tipping.criticalRatio': cite(VALUES, '12-vuelco-y-anclaje', 'Librero sin cajones'),
  'tipping.criticalHeight': cite(VALUES, '12-vuelco-y-anclaje', 'Librero sin cajones'),
  'doors.hinges': cite(VALUES, '8-puertas', 'Bisagras por altura de puerta'),
  'doors.maxWidth': cite(VALUES, '8-puertas', 'Ancho máximo de una hoja'),
  'sliding.overlap': cite(STRUCTURE, '5-puertas', 'traslape entre hojas de 20–30 mm'),
  'sliding.lip': noReference('the wood Knotty leaves in front of the first groove so its wall does not break out; the reference gives none'),
  'sliding.between': noReference('the same gap as between two fronts, so one leaf passes the other; the reference has no play for sliding doors'),
  // A quarter below and so half above: the deeper groove stays at the most the reference lets a groove go.
  'sliding.narrowOpening': noReference('Knotty’s own: two leaves open half an opening less their overlap, and under about 230 mm a hand with a plate does not pass; the reference gives no least width for sliding doors'),
  'sliding.engagement': cite(VALUES, '6-uniones', 'Profundidad de ranura'),
  'lids.strip': noReference('the same width as the rail a wall cabinet hangs from, which takes two screws at each end; the reference gives no width for the fixed part of a lid'),
  'lids.stayTorque': cite(JOINTS_DOC, '64-otros-herrajes', 'Compás de fricción'),
  'lids.maxStays': noReference('one stay by each wall of the chest is all there is room for; the reference gives no count'),
  'lids.minOpening': noReference('where Knotty calls a lid hard to reach under; the reference gives no opening angle'),
  'pulls.fingerRoom': noReference('about the thickness of a finger; the reference names the pull and the inset front and gives no room to grip an edge'),
  'rods.drop': noReference('room for the hook of a hanger between the rod and the board over it; the reference places the rod from the back and from the floor, not under its shelf'),
  'rods.maxSpan': cite(VALUES, '10-medidas-de-muebles-y-ergonomía', 'Clóset: claro del tubo sin soporte al centro'),
  'rods.shortHang': cite(VALUES, '10-medidas-de-muebles-y-ergonomía', 'Clóset: hueco para colgado corto'),
  floorSpan: cite(STRUCTURE, '71-patas-o-zoclo', 'un piso de más de 800 mm sin apoyo intermedio necesita revisión'),
  'legs.maxSpan': cite(STRUCTURE, '71-patas-o-zoclo', 'más de ≈ 1 200 mm de ancho → patas intermedias'),
  'legs.footprint': noReference('how Knotty tells a leg from a panel on the floor: a laminated leg of 2 × 18 × 72 fits with room, a side or a kick is far longer'),
  floorRunShare: noReference('how Knotty reads «zoclo corrido»: a run under most of the floor, not a block at one end'),
  grainRatio: noReference('where a piece starts to read as long, so grain across it shows; the reference only says the grain runs along the span'),
  'drawers.runnerTolerance': cite(VALUES, '9-cajones', 'Holgura de corredera de balines'),
  'drawers.boxClearance': cite(VALUES, '9-cajones', 'Ancho de la caja del cajón'),
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

/** The weight of a lid about its hinge, in N·m: its mass at half its reach. */
export const lidTorque = (width: number, reach: number, thickness: number) => ((width * reach * thickness * ASSUMPTIONS.tipping.density) / 1e9) * (ASSUMPTIONS.gravity / 1000) * (reach / 2)
/** How many friction stays hold a lid: by its weight about the hinge, never more than there is room for. */
export const staysFor = (torque: number) => Math.min(ASSUMPTIONS.lids.maxStays, Math.max(1, Math.ceil(torque / ASSUMPTIONS.lids.stayTorque)))
