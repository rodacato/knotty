import { z } from 'zod'
import { startAt, partway, endAt, ref, extent, makeJoint } from '../../design/builders'
import { DIMENSION_OF_AXIS, Pulls, type Extent, type FaceRef, type Design, type Hole, type Piece, type Joint, type Round } from '../../design/schema'
import { Assembly, assemblyFields, assemblyPart, describeAssembly, knockDown } from './assembly'
import { describeEdgeBanding, EDGE_BANDING, EdgeBanding, edgeBandingField, withEdges } from './edgeBanding'
import { completeJoints } from '../../design/joints'
import { resolveGeometry } from '../../design/resolve'
import type { DesignKind } from '../../design/kind'
import { backBoard, materialById, type Catalog } from '../../materials/catalog'
import { stiffness } from '../../materials/grades'
import { cite, noReference, STRUCTURE, type Source } from '../../sources'
import { maxSpan } from '../../checks/structure/rules/deflection'
import { ASSUMPTIONS, pocketScrewId } from '../../assumptions'
import { addDrawers, wholeMillimetres, CABLE_HOLE, CABLE_RISE, KICK_HEIGHT, KICK_SETBACK, LEG_LEAN, LEG_WIDTH, legLayers, lower, MAX_SPAN, measuresSummary, panelOf, supportsAcross, thicknessOf, type AddDrawer, outsideRules, PLAN_MEASURE, drawersShort, DEFAULT_THICKNESS } from './common'
import { describeLegStyle, LEANING_LEG_STYLE, LEANING_LEG_STYLE_LABELS, LeaningLegStyle, legStyleField, legStyleNote, splayed, styled, styledLegs } from './legs'
import { withFrontCuts } from '../../design/frontCuts'
import { notchNote, pullFor } from './fronts'
import { choice, fromLabels, material, note, number, numbers, optionsOf, section, stepper, yesNo, type FieldSpec } from './fields'
import type { FurnitureModule, Labels } from './module'
import { counted, woodPart, type Parts } from './parts'

// A table or a desk from its ficha: a top on two panel ends or on four legs, tied by aprons, with cleats under the top and, on a desk, a drawer pedestal.

/** The most drawers a desk pedestal takes. */
export const MAX_PEDESTAL_DRAWERS = 4

export const TablePlan = z.object({
  kind: z.literal('table'),
  use: z.enum(['dining', 'coffee', 'side', 'desk', 'standing', 'seat']).describe('dining: dining table; coffee: coffee table; side: side table or nightstand; desk: desk to sit at; standing: work surface to stand at, a workbench or a standing desk; seat: a stool or a bench with no back, its top is sat on'),
  name: z.string().describe('Name of the furniture for the person, in Spanish: "Escritorio con cajonera", "Mesa de centro"'),
  material: z.string().describe('Plywood id, usually "T18"'),
  dimensions: z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() }).describe('Outside length (width), height and depth in mm'),
  overhang: z.number().nonnegative().describe('How far the top sticks out past the sides, in mm; 0 if the sides reach the edge'),
  shelf: z.boolean().describe('Low shelf between the sides (coffee and side tables, workbenches); a desk has none, it gets in the way of the legs'),
  pedestal: z.object({
    side: z.enum(['none', 'left', 'right']).describe('Which side the pedestal goes on, seen from the front of the desk'),
    drawers: z.number().int().min(0).max(MAX_PEDESTAL_DRAWERS).describe('How many drawers the pedestal has; 0 if there is none'),
    pulls: Pulls.optional().describe('How its drawer fronts are opened: none, notch or handle; absent: notch'),
  }),
  legs: z.enum(['panel', 'legs']).default('panel').describe('panel: two panel ends; legs: four straight legs from floor to top with an apron all round (the pedestal side keeps its panel); the height of the table is the length of the legs'),
  legStyle: LeaningLegStyle.optional().describe(LEANING_LEG_STYLE),
  stretcher: z.enum(['none', 'ends', 'h']).optional().describe('Low stretcher between the legs: none (default); ends: front leg to back leg at each end; h: those and a long one joining them. Not with a shelf; no h on a desk'),
  corners: z.enum(['square', 'rounded']).optional().describe('Corners of the top; rounded only where it overhangs'),
  cable: z.boolean().optional().describe('A cable hole through the top of a desk'),
  assembly: Assembly.optional().describe('glued (default); bolts or cams: no glue, comes apart to move'),
  edges: EdgeBanding.optional().describe(EDGE_BANDING),
})
export type TablePlan = z.infer<typeof TablePlan>

export const TABLE_LABELS = {
  /** `name` is what each use is called. */
  use: {
    dining: { option: 'Comedor', name: 'Mesa de comedor' },
    coffee: { option: 'Centro', name: 'Mesa de centro' },
    side: { option: 'Lateral', name: 'Mesa lateral' },
    desk: { option: 'Escritorio', name: 'Escritorio' },
    standing: { option: 'De pie', name: 'Mesa de trabajo' },
    seat: { option: 'Asiento', name: 'Banco' },
  } satisfies Record<TablePlan['use'], { option: string; name: string }>,
  pedestal: {
    none: { option: 'Sin cajonera', phrase: 'sin cajonera' },
    left: { option: 'Izquierda', phrase: 'cajonera a la izquierda' },
    right: { option: 'Derecha', phrase: 'cajonera a la derecha' },
  } satisfies Labels<TablePlan['pedestal']['side']>,
  pulls: {
    none: { option: 'Ninguna', phrase: 'cajones sin jaladeras' },
    notch: { option: 'Muesca', phrase: 'cajones con muesca para abrir' },
    handle: { option: 'Jaladera', phrase: 'cajones con jaladera' },
  } satisfies Labels<Pulls>,
  legs: {
    panel: { option: 'Costados de panel', phrase: 'con costados de panel' },
    legs: { option: 'Cuatro patas', phrase: 'con cuatro patas' },
  } satisfies Labels<TablePlan['legs']>,
  stretcher: {
    none: { option: 'Sin travesaño', phrase: 'sin travesaños bajos' },
    ends: { option: 'En los extremos', phrase: 'con un travesaño bajo en cada extremo', hint: 'Une abajo la pata de enfrente con la de atrás, en cada extremo: amarra las patas y deja libre el paso de los pies.' },
    h: { option: 'En H', phrase: 'con travesaños bajos en H', hint: 'Además de los dos de los extremos, un larguero los une por el centro, como una H vista desde arriba.' },
  } satisfies Labels<NonNullable<TablePlan['stretcher']>>,
  corners: {
    square: { option: 'Rectas', phrase: 'cubierta de esquinas rectas' },
    rounded: { option: 'Redondeadas', phrase: 'cubierta de esquinas redondeadas' },
  } satisfies Labels<NonNullable<TablePlan['corners']>>,
}

/** Typical outside measures for each use, in mm, when the person gives none. */
export const TYPICAL_TABLE_DIMENSIONS: Record<TablePlan['use'], TablePlan['dimensions']> = {
  dining: { width: 1500, height: 750, depth: 900 },
  coffee: { width: 1000, height: 420, depth: 550 },
  side: { width: 500, height: 550, depth: 400 },
  desk: { width: 1200, height: 750, depth: 600 },
  standing: { width: 1500, height: 900, depth: 700 },
  // The reference's bench: a seat 450 high and 350 deep (muebles-y-medidas.md §2.2), 1 200 long for two people (estructura.md §7.2).
  seat: { width: 1200, height: 450, depth: 350 },
}

const APRON = 80
/** On a desk the back apron runs lower: it braces the ends and hides the legs from the front. */
const MODESTY = 300
const SHELF_HEIGHT = 120
const PEDESTAL = 420
/** A low stretcher: how far its underside is from the floor, and the lowest table that keeps as much clear over it as the stretcher is tall. */
const STRETCHER_RISE = 150
const STRETCHER_MIN_HEIGHT = STRETCHER_RISE + 3 * APRON + DEFAULT_THICKNESS
/** Past this inset the ends would stand under the middle of the top, not at its sides. */
const MAX_END_INSET = 50
/** The radius a corner of the top is rounded to. */
const TOP_ROUND = 40

/** What each use is, for the checks by kind of furniture: the design says it, so renaming it does not change them. */
export const TABLE_KIND: Record<TablePlan['use'], DesignKind> = { dining: 'diningTable', coffee: 'coffeeTable', side: 'sideTable', desk: 'desk', standing: 'workbench', seat: 'bench' }

const LOAD: Record<TablePlan['use'], Piece['load']> = { dining: 'medium', coffee: 'light', side: 'light', desk: 'medium', standing: 'heavy', seat: 'heavy' }

export const TABLE_SOURCES: Record<string, Source> = {
  MAX_PEDESTAL_DRAWERS: noReference('Module limit: the pedestal supports up to four drawers; not a hardware rating.'),
  APRON: cite(STRUCTURE, '21-mesas-y-escritorios-patas-faldón-y-bamboleo', 'de 80–120 mm de alto'),
  MODESTY: noReference('Construction choice: a 300 mm rear panel. The reference recommends 100–150 mm; this difference still needs craft review.'),
  SHELF_HEIGHT: noReference('Construction choice: the low shelf starts 120 mm above the floor.'),
  PEDESTAL: noReference('Construction choice: a 420 mm pedestal; available legroom is checked separately.'),
  STRETCHER_RISE: noReference('Construction choice: the reference asks a stool for stretchers and a footrest (muebles-y-medidas.md §1.3) and a workbench for low stretchers, and gives no height; 150 clears a broom and a shoe, the height Knotty gives legs under a box. Its section is the apron\'s.'),
  MAX_END_INSET: noReference('Module limit: supports are inset at most 50 mm from the ends.'),
  TOP_ROUND: noReference('Construction choice: a radius the size of a jar lid, easy to mark and to saw; the reference only asks 3 mm or more on corners a child can reach.'),
}

const ENDS = ['left', 'right'] as const
type End = (typeof ENDS)[number]
type Row = 'front' | 'back'

/** What the plan settles once and every part of the table reads. */
function layoutOf(plan: TablePlan, catalog: Catalog) {
  const desk = plan.use === 'desk'
  const inset = Math.min(plan.overhang, MAX_END_INSET)
  const backInset = desk ? 0 : inset
  const pedestal = desk && plan.pedestal.side !== 'none' && plan.pedestal.drawers > 0 ? plan.pedestal.side : null
  return {
    plan,
    catalog,
    t: thicknessOf(catalog, plan.material),
    panel: panelOf(plan.material),
    desk,
    inset,
    backInset,
    pedestal,
    // Four legs instead of two panel ends; the side that carries the pedestal keeps its panel.
    legs: { left: plan.legs === 'legs' && pedestal !== 'left', right: plan.legs === 'legs' && pedestal !== 'right' },
    endY: extent(ref('furniture.y0'), ref('top.y0')),
    endsZ: extent(ref('furniture.z0', backInset), ref('furniture.z1', -inset)),
  }
}
type Layout = ReturnType<typeof layoutOf>

/** One side of the open part under the top: the face that bounds it, and the piece an apron meets there in each row. */
type Bound = { face: FaceRef } & Record<Row, string>

/** The open part, between its left and right bounds. */
type Open = [Bound, Bound]

const endThickness = (l: Layout, end: End) => (l.legs[end] ? 2 * l.t : l.t)

/** The inner face of an end: its panel, or the inner layer of its legs. */
function endBound(l: Layout, end: End): Bound {
  const face = end === 'left' ? 'x1' : 'x0'
  if (!l.legs[end]) return { face: `side-${end}.${face}`, front: `side-${end}`, back: `side-${end}` }
  return { face: `leg-front-${end}-2.${face}`, front: `leg-front-${end}-2`, back: `leg-back-${end}-2` }
}

/** The side of a leg that faces the other row: the one a tapered leg is cut on. */
const INNER = { front: 'start', back: 'end' } as const

/** How far the supports of a row stand in from its edge of the top. */
const rowInset = (l: Layout, row: Row) => (row === 'front' ? l.inset : l.backInset)

/** A corner leg leans out to its edge of the top only while its foot stays under it; without that room it narrows instead. */
const leans = (l: Layout, row: Row) => l.plan.legStyle === 'splayed' && rowInset(l, row) >= LEG_LEAN

/** A leg that does not lean is cut as the plan says, and one asked to lean, narrowed. */
const upright = (plan: TablePlan) => (plan.legStyle === 'splayed' ? 'tapered' : plan.legStyle)

function ends(l: Layout): Piece[] {
  const { plan, inset, backInset, endY } = l
  const lean = { front: leans(l, 'front') ? LEG_LEAN : 0, back: leans(l, 'back') ? LEG_LEAN : 0 }
  const legZ = { front: extent(null, ref('furniture.z1', lean.front - inset), LEG_WIDTH + lean.front), back: extent(ref('furniture.z0', backInset - lean.back), null, LEG_WIDTH + lean.back) }
  return ENDS.flatMap((end) => {
    const [side, name, towards] = end === 'left' ? ['izquierdo', 'izquierda', 'right' as const] : ['derecho', 'derecha', 'left' as const]
    const x = end === 'left' ? startAt(ref('furniture.x0', plan.overhang)) : endAt(ref('furniture.x1', -plan.overhang))
    if (!l.legs[end]) return [l.panel({ id: `side-${end}`, name: `Costado ${side}`, role: 'side', normal: 'x', x, y: endY, z: l.endsZ })]
    return (['front', 'back'] as const).flatMap((row) => {
      const layers = legLayers(plan.material, `leg-${row}-${end}`, `Pata ${row === 'front' ? 'delantera' : 'trasera'} ${name}`, x, towards, endY, legZ[row])
      return lean[row] ? splayed(layers, INNER[row]) : styled(layers, upright(plan), INNER[row])
    })
  })
}

/** The drawer pedestal of a desk: its box, its drawers, and its inner side as the bound of the open part. */
function pedestalBox(l: Layout, side: End): { pieces: Piece[]; drawers: AddDrawer[]; bound: Bound } {
  const { plan, catalog, panel, t, endY } = l
  const outer = `side-${side}`
  const [left, right]: [FaceRef, FaceRef] = side === 'left' ? ['side-left.x1', 'ped-div.x0'] : ['ped-div.x1', 'side-right.x0']
  const between = extent(ref(left), ref(right))
  const zBox = extent(ref('ped-back.z1'), ref(`${outer}.z1`))
  const n = plan.pedestal.drawers
  const pieces = [
    panel({ id: 'ped-div', name: 'Costado interior de la cajonera', role: 'divider', normal: 'x', x: side === 'left' ? startAt(ref('side-left.x1', PEDESTAL - 2 * t)) : endAt(ref('side-right.x0', -(PEDESTAL - 2 * t))), y: endY, z: l.endsZ }),
    panel({ id: 'ped-back', name: 'Fondo de la cajonera', role: 'back', normal: 'z', x: between, y: endY, z: startAt(ref(`${outer}.z0`)) }),
    panel({ id: 'ped-kick', name: 'Zoclo de la cajonera', role: 'kick', normal: 'z', x: between, y: extent(ref('furniture.y0'), null, KICK_HEIGHT.pedestal), z: endAt(ref(`${outer}.z1`, -KICK_SETBACK)) }),
    panel({ id: 'ped-bottom', name: 'Piso de la cajonera', role: 'bottom', normal: 'y', x: between, y: startAt(ref('ped-kick.y1')), z: zBox, load: 'medium' }),
    ...Array.from({ length: n - 1 }, (_, i) => i + 1).map((k) =>
      panel({ id: `ped-sep-${k}`, name: `Separador ${k} de la cajonera`, role: 'shelf', normal: 'y', x: between, y: startAt(partway('ped-bottom.y1', 'top.y0', k / n, -t / 2)), z: zBox, load: 'light' }),
    ),
  ]
  const drawers = Array.from({ length: n }, (_, i): AddDrawer => ({
    op: 'addDrawer',
    group: `drawer-${i + 1}`,
    name: `Cajón ${i + 1}`,
    left,
    right,
    bottom: i === 0 ? 'ped-bottom.y1' : `ped-sep-${i}.y1`,
    top: i === n - 1 ? 'top.y0' : `ped-sep-${i + 1}.y0`,
    front: `${outer}.z1`,
    back: 'ped-back.z1',
    material: plan.material,
    bottomMaterial: backBoard(catalog).id,
  }))
  return { pieces, drawers, bound: { face: side === 'left' ? 'ped-div.x1' : 'ped-div.x0', front: 'ped-div', back: 'ped-div' } }
}

/** How the plan opens the drawers of its pedestal, whose fronts sit inside their openings. */
const pedestalPulls = (plan: TablePlan): Pulls => pullFor(plan.pedestal.pulls, 'inset')

/** How the drawers of the pedestal are opened, once they are in place: a notch routed in each front, or a handle the purchase counts from the design. */
function withPulls(design: Design, pulls: Pulls, catalog: Catalog): { design: Design; notes: string[] } {
  const fronts = design.pieces.filter((p) => p.role === 'drawer-front').length
  const geo = pulls === 'none' || !fronts ? null : resolveGeometry(design, catalog)
  if (!geo?.ok) return { design, notes: [] }
  const cut = pulls === 'notch' ? withFrontCuts(design, geo.value.boxes, () => ({ notch: true, grooved: false })) : design
  return { design: { ...cut, pulls }, notes: pulls === 'notch' ? [notchNote(fronts)] : [] }
}

/** Aprons front and back tie the ends; screwed from inside with pocket screws, they keep the table square. Legs take one more on each side. */
function aprons(l: Layout, open: Open): { pieces: Piece[]; joints: Joint[] } {
  const { panel, t, desk } = l
  const screws = [{ hardwareId: pocketScrewId(t), count: 2 }]
  const x = extent(ref(open[0].face), ref(open[1].face))
  const pieces = [
    panel({ id: 'apron-front', name: 'Faldón del frente', role: 'apron', normal: 'z', x, y: extent(null, ref('top.y0'), APRON), z: endAt(ref('furniture.z1', -l.inset)) }),
    panel({ id: 'apron-back', name: desk ? 'Faldón trasero' : 'Faldón de atrás', role: 'apron', normal: 'z', x, y: extent(null, ref('top.y0'), desk ? MODESTY : APRON), z: startAt(ref('furniture.z0', l.backInset)) }),
  ]
  const joints = (['front', 'back'] as const).flatMap((row) => open.map((bound) => makeJoint(`j-apron-${row}-${bound[row]}`, `apron-${row}`, bound[row], 'pocket-screw', screws)))
  for (const end of ENDS) {
    if (!l.legs[end]) continue
    const [front, back] = [`leg-front-${end}-1`, `leg-back-${end}-1`]
    pieces.push(panel({ id: `apron-${end}`, name: `Faldón ${end === 'left' ? 'izquierdo' : 'derecho'}`, role: 'apron', normal: 'x', x: end === 'left' ? startAt(ref(`${front}.x0`)) : endAt(ref(`${front}.x1`)), y: extent(null, ref('top.y0'), APRON), z: extent(ref(`${back}.z1`), ref(`${front}.z0`)) }))
    for (const leg of [front, back]) joints.push(makeJoint(`j-apron-${end}-${leg}`, `apron-${end}`, leg, 'pocket-screw', screws))
  }
  return { pieces, joints }
}

/** What holds the top across the open part: cleats between the aprons, so it never spans more than it can, and legs in between where two would stand too far apart. */
function supports(l: Layout, open: Open): { pieces: Piece[]; middleLegs: number } {
  const { plan, panel, t, pedestal, endY } = l
  const [left, right] = [open[0].face, open[1].face]
  const openWidth = plan.dimensions.width - 2 * plan.overhang - (pedestal ? PEDESTAL + endThickness(l, pedestal === 'left' ? 'right' : 'left') : endThickness(l, 'left') + endThickness(l, 'right'))
  // A heavy top (a workbench) cannot span the usual cleat spacing: R1's own limit sets how far it goes.
  const board = materialById(l.catalog, plan.material)
  const topSpan = board ? Math.min(MAX_SPAN, maxSpan(plan.dimensions.depth, t, LOAD[plan.use], stiffness(board.grade, board.thickness).parallel)) : MAX_SPAN
  const cleats = supportsAcross(openWidth, t, topSpan)
  const middle = plan.legs === 'legs' ? supportsAcross(openWidth, 2 * t, ASSUMPTIONS.legs.maxSpan) : 0
  const onMiddleLeg = (share: number) => Array.from({ length: middle }, (_, j) => (j + 1) / (middle + 1)).some((m) => Math.abs(m - share) < 1e-9)
  const room = plan.dimensions.depth - l.backInset - l.inset - 2 * t
  const twoRows = room > 2 * LEG_WIDTH
  const pieces: Piece[] = []
  for (let k = 1; k <= middle; k++) {
    const first = startAt(partway(left, right, k / (middle + 1), -t))
    const rows: [Row | '', string, Extent][] = twoRows
      ? [['front', 'del frente', extent(null, ref('apron-front.z0'), LEG_WIDTH)], ['back', 'de atrás', extent(ref('apron-back.z1'), null, LEG_WIDTH)]]
      : [['', '', extent(ref('apron-back.z1'), ref('apron-front.z0'))]]
    for (const [row, words, z] of rows) {
      const layers = legLayers(plan.material, `leg-middle-${k}${row ? `-${row}` : ''}`, `Pata intermedia ${middle > 1 ? `${k} ` : ''}${words}`.trim(), first, 'right', endY, z)
      // A leg that fills the depth between the aprons has no inner side: it stays straight.
      pieces.push(...(row ? styled(layers, upright(plan), INNER[row]) : layers))
    }
  }
  // A cleat that falls on a middle leg runs between its front and back posts, or is the leg itself.
  for (let k = 1; k <= cleats; k++) {
    const share = k / (cleats + 1)
    const middleIndex = Math.round(share * (middle + 1))
    const atLeg = onMiddleLeg(share)
    if (atLeg && !twoRows) continue
    const z = atLeg ? extent(ref(`leg-middle-${middleIndex}-back-1.z1`), ref(`leg-middle-${middleIndex}-front-1.z0`)) : extent(ref('apron-back.z1'), ref('apron-front.z0'))
    pieces.push(panel({ id: `rail-${k}`, name: `Travesaño ${k}`, role: 'divider', normal: 'x', x: startAt(partway(left, right, share, -t / 2)), y: extent(ref('apron-front.y0'), ref('top.y0')), z }))
  }
  return { pieces, middleLegs: middle }
}

/** The low shelf of a coffee or side table, a workbench or a bench, on short feet; a desk and a long table on legs take none, and say why. */
function lowShelf(l: Layout, open: Open, middleLegs: number): { pieces: Piece[]; notes: string[] } {
  const { plan, panel, t, desk } = l
  if (!plan.shelf) return { pieces: [], notes: [] }
  if (desk) return { pieces: [], notes: ['Un escritorio no lleva repisa baja: estorba las piernas.'] }
  if (middleLegs > 0) return { pieces: [], notes: ['Una mesa tan larga sobre patas no lleva repisa baja: las patas de en medio estorban.'] }
  const [left, right] = [open[0].face, open[1].face]
  // The shelf sits close to the floor: short feet under it are simpler than anything above.
  const feet = supportsAcross(plan.dimensions.width - 2 * plan.overhang - endThickness(l, 'left') - endThickness(l, 'right'), t)
  return {
    pieces: [
      panel({ id: 'low-shelf', name: 'Repisa baja', role: 'shelf', normal: 'y', x: extent(ref(left), ref(right)), y: startAt(ref('furniture.y0', SHELF_HEIGHT)), z: l.endsZ, load: 'light' }),
      ...Array.from({ length: feet }, (_, i) => i + 1).map((k) =>
        panel({ id: `shelf-leg-${k}`, name: `Apoyo ${k} de la repisa`, role: 'divider', normal: 'x', x: startAt(partway(left, right, k / (feet + 1), -t / 2)), y: extent(ref('furniture.y0'), ref('low-shelf.y0')), z: l.endsZ }),
      ),
    ],
    notes: [],
  }
}

/** The low stretchers a table is built with: none on panel ends, under a low shelf or where they do not fit under the apron; a desk takes no long one, it is where the feet go. */
function stretcherOf(plan: TablePlan): NonNullable<TablePlan['stretcher']> {
  const asked = plan.legs === 'legs' ? (plan.stretcher ?? 'none') : 'none'
  if (plan.shelf || plan.dimensions.height < STRETCHER_MIN_HEIGHT) return 'none'
  return asked === 'h' && plan.use === 'desk' ? 'ends' : asked
}

/**
 * Low stretchers: one per end on legs, screwed to the inner face of its two legs, so a leg cut on a slant meets it the same; and for an H, a long one between them.
 * Under a leg that leans it stops where a straight leg would, inside the foot.
 */
function stretchers(l: Layout): { pieces: Piece[]; notes: string[] } {
  const run = stretcherOf(l.plan)
  const tied = run === 'none' ? [] : ENDS.filter((end) => l.legs[end])
  if (!tied.length) return { pieces: [], notes: [] }
  const y = extent(ref('furniture.y0', STRETCHER_RISE), null, APRON)
  const lean = { front: leans(l, 'front') ? LEG_LEAN : 0, back: leans(l, 'back') ? LEG_LEAN : 0 }
  const pieces = tied.map((end) =>
    l.panel({ id: `stretcher-${end}`, name: `Travesaño bajo ${end === 'left' ? 'izquierdo' : 'derecho'}`, role: 'apron', normal: 'x', x: end === 'left' ? startAt(ref('leg-front-left-2.x1')) : endAt(ref('leg-front-right-2.x0')), y, z: extent(ref(`leg-back-${end}-2.z0`, lean.back), ref(`leg-front-${end}-2.z1`, -lean.front)) }),
  )
  const long = run === 'h' && tied.length === 2
  if (long) pieces.push(l.panel({ id: 'stretcher-long', name: 'Larguero bajo', role: 'apron', normal: 'z', x: extent(ref('stretcher-left.x1'), ref('stretcher-right.x0')), y, z: startAt(partway('stretcher-left.z0', 'stretcher-left.z1', 0.5, -l.t / 2)) }))
  const ends = tied.length === 1 ? 'Travesaño bajo en el extremo con patas' : 'Travesaño bajo en cada extremo'
  return { pieces, notes: [`${ends}, a ${STRETCHER_RISE} mm del piso: va por dentro de las dos patas, pegado y atornillado a su cara.${long ? ' El larguero une los dos travesaños por el centro.' : ''}`] }
}

/** The blocks a table comes apart into: each end (its legs with their short apron and low stretcher, or its panel, and a desk's pedestal), the long aprons with their cross members and the long stretcher, the low shelf on its feet, each middle leg and the top. */
function blockOf(l: Layout): (piece: Piece) => string {
  return ({ id }) => {
    if (id === 'top') return 'top'
    if (id.startsWith('ped-')) return `end-${l.pedestal}`
    if (id === 'low-shelf' || id.startsWith('shelf-leg-')) return 'shelf'
    if (id.startsWith('leg-middle-')) return id.replace(/-\d+$/, '')
    const end = /-(left|right)(-|$)/.exec(id)
    return end ? `end-${end[1]}` : 'frame'
  }
}

/** What stands under a corner of the top has its own corner this far in from both edges; the round covers it while it stays inside the arc. */
const roundCovers = (inset: number) => inset >= TOP_ROUND * (1 - Math.SQRT1_2)

/** The corners of the top that can be rounded without showing what is under them: none where an end reaches the edge, as the back of a desk does. */
function topRounds(l: Layout): Round[] {
  if (l.plan.corners !== 'rounded') return []
  const rows = [['start', l.backInset], ['end', l.inset]] as const
  return rows.flatMap(([z, inset]) => (roundCovers(Math.min(l.plan.overhang, inset)) ? (['start', 'end'] as const).map((x): Round => ({ x, y: null, z, radius: TOP_ROUND })) : []))
}

/** Why legs asked to lean do not, where they stand at the edge of the top. */
function leanNote(l: Layout): string[] {
  if (l.plan.legStyle !== 'splayed' || !ENDS.some((end) => l.legs[end])) return []
  if (!leans(l, 'front')) return [`Las patas no se abren con la cubierta a menos de ${LEG_LEAN} mm de vuelo: el pie saldría de la cubierta. Solo se adelgazan; dale más vuelo para abrirlas.`]
  return leans(l, 'back') ? [] : ['Las patas de atrás no se abren: van a la orilla, contra el muro. Solo se adelgazan.']
}

const roundsNote = (plan: TablePlan, rounds: number): string[] =>
  plan.corners !== 'rounded'
    ? []
    : rounds === 0
      ? ['Con la cubierta al ras no se redondean las esquinas: asomaría lo que va debajo. Dale vuelo a la cubierta.']
      : [`Cubierta con ${rounds} esquinas redondeadas a ${TOP_ROUND} mm de radio: se marcan con un compás o una tapa, se cortan con caladora y se emparejan con lija.${rounds < 4 ? ' Atrás quedan rectas, donde los costados llegan a la orilla.' : ''}`]

/** Cables come up through the top of what is worked at. */
const passesCables = (plan: TablePlan) => !!plan.cable && (plan.use === 'desk' || plan.use === 'standing')

/**
 * The hole of a cable pass in the top: a diameter in front of the back apron, as near the middle of the length as it finds nothing under it.
 * The low shelf and the low stretchers do not count, a leg, a cleat or a drawer does; none when the whole length is taken.
 */
function topHole(design: Design, catalog: Catalog): Hole | null {
  const geo = resolveGeometry(design, catalog)
  const [top, apron] = geo.ok ? [geo.value.boxes.get('top'), geo.value.boxes.get('apron-back')] : []
  if (!geo.ok || !top || !apron) return null
  const r = CABLE_HOLE / 2
  const z = apron.z1 + CABLE_RISE
  const under = design.pieces.filter((p) => p.id !== 'top' && p.id !== 'low-shelf' && !p.id.startsWith('shelf-leg-') && !p.id.startsWith('stretcher-')).flatMap((p) => geo.value.boxes.get(p.id) ?? [])
  const clear = (x: number) => under.every((b) => b.x1 <= x - r || b.x0 >= x + r || b.z1 <= z - r || b.z0 >= z + r)
  const middle = (top.x0 + top.x1) / 2
  const reach = (top.x1 - top.x0) / 2 - TOP_ROUND - r
  for (let off = 0; off <= reach; off += 10) for (const x of off ? [middle - off, middle + off] : [middle]) if (clear(x)) return { x: x - top.x0, y: null, z: z - top.z0, diameter: CABLE_HOLE }
  return null
}

const cableNote = (hole: Hole | null): string =>
  hole
    ? `Pasacables: un barreno de ${CABLE_HOLE} mm en la cubierta, a ${Math.round(hole.z!)} mm de la orilla de atrás y a ${Math.round(hole.x!)} mm de la izquierda. Se hace con broca sierra.`
    : 'No cupo un pasacables en la cubierta: lo que va debajo ocupa todo el largo.'

export function buildTable(plan: TablePlan, catalog: Catalog): { design: Design; notes: string[] } {
  const l = layoutOf(plan, catalog)
  const rounds = topRounds(l)
  const top = l.panel({ id: 'top', name: 'Cubierta', role: 'top', normal: 'y', x: extent(ref('furniture.x0'), ref('furniture.x1')), y: endAt(ref('furniture.y1')), z: extent(ref('furniture.z0'), ref('furniture.z1')), load: LOAD[plan.use], edges: ['front', 'back', 'left', 'right'], ...(rounds.length ? { rounds } : {}) })
  const box = l.pedestal ? pedestalBox(l, l.pedestal) : null
  // The open part between the ends, or between the pedestal and the far end.
  const open: Open = [l.pedestal === 'left' && box ? box.bound : endBound(l, 'left'), l.pedestal === 'right' && box ? box.bound : endBound(l, 'right')]
  const tied = aprons(l, open)
  const held = supports(l, open)
  const shelf = lowShelf(l, open, held.middleLegs)
  const low = stretchers(l)

  const pieces = [top, ...ends(l), ...(box?.pieces ?? []), ...tied.pieces, ...held.pieces, ...shelf.pieces, ...low.pieces]
  const design = wholeMillimetres({ schema: 1, name: plan.name, dimensions: { ...plan.dimensions }, wallAnchored: false, notes: '', pieces, joints: tied.joints, kind: TABLE_KIND[plan.use] }, catalog)
  const placed = addDrawers(design, box?.drawers ?? [], catalog)
  const opened = withPulls(placed.design, pedestalPulls(plan), catalog)
  const hole = passesCables(plan) ? topHole(opened.design, catalog) : null
  const holed = hole ? { ...opened.design, pieces: opened.design.pieces.map((p) => (p.id === 'top' ? { ...p, holes: [hole] } : p)) } : opened.design
  const notes = [...shelf.notes, ...low.notes, ...placed.notes, ...opened.notes, ...legStyleNote(styledLegs(placed.design.pieces)), ...leanNote(l), ...roundsNote(plan, rounds.length), ...(passesCables(plan) ? [cableNote(hole)] : [])]
  return { design: withEdges(knockDown(completeJoints(holed, catalog), plan.assembly, catalog, blockOf(l)), plan.edges), notes }
}

function describeTableChanges(before: TablePlan, after: TablePlan): string[] {
  const changes: string[] = []
  if (before.use !== after.use) changes.push(`ahora ${lower(TABLE_LABELS.use[after.use].name)}`)
  else if (before.name !== after.name) changes.push(`se llama «${after.name}»`)
  const [a, b] = [before.dimensions, after.dimensions]
  if (a.height !== b.height || a.width !== b.width || a.depth !== b.depth) changes.push(`medidas ${b.height} × ${b.width} × ${b.depth} mm`)
  if (before.material !== after.material) changes.push(`material ${after.material}`)
  if (before.overhang !== after.overhang) changes.push(after.overhang ? `cubierta que sobresale ${after.overhang} mm` : 'costados a la orilla')
  if ((before.corners ?? 'square') !== (after.corners ?? 'square')) changes.push(TABLE_LABELS.corners[after.corners ?? 'square'].phrase)
  if (passesCables(before) !== passesCables(after)) changes.push(passesCables(after) ? 'con pasacables' : 'sin pasacables')
  if (before.shelf !== after.shelf) changes.push(after.shelf ? 'con repisa baja' : 'sin repisa baja')
  if (before.legs !== after.legs) changes.push(TABLE_LABELS.legs[after.legs].phrase)
  if (after.legs === 'legs') changes.push(...describeLegStyle(before, after))
  if (stretcherOf(before) !== stretcherOf(after)) changes.push(TABLE_LABELS.stretcher[stretcherOf(after)].phrase)
  if (before.pedestal.side !== after.pedestal.side) changes.push(TABLE_LABELS.pedestal[after.pedestal.side].phrase)
  if (after.pedestal.side !== 'none' && before.pedestal.drawers !== after.pedestal.drawers) changes.push(`${after.pedestal.drawers} ${after.pedestal.drawers === 1 ? 'cajón' : 'cajones'} en la cajonera`)
  if (after.pedestal.side !== 'none' && pedestalPulls(before) !== pedestalPulls(after)) changes.push(TABLE_LABELS.pulls[pedestalPulls(after)].phrase)
  return [...changes, ...describeAssembly(before, after), ...describeEdgeBanding(before, after)]
}

function benchTables(): [string, TablePlan][] {
  const table = (use: TablePlan['use'], name: string, dimensions: TablePlan['dimensions'], extra: Partial<TablePlan> = {}): TablePlan => ({ kind: 'table', use, name, material: 'T18', dimensions, overhang: 0, shelf: false, pedestal: { side: 'none', drawers: 0, pulls: 'none' }, legs: 'panel', legStyle: 'straight', stretcher: 'none', corners: 'square', cable: false, assembly: 'glued', edges: 'banded', ...extra })
  const variants: [string, TablePlan][] = [
    ['comedor', table('dining', 'Mesa de comedor', { width: 1500, height: 750, depth: 900 }, { overhang: 50 })],
    ['comedor largo', table('dining', 'Mesa de comedor', { width: 1800, height: 750, depth: 900 }, { overhang: 50 })],
    ['centro', table('coffee', 'Mesa de centro', { width: 1000, height: 420, depth: 550 }, { shelf: true })],
    ['lateral', table('side', 'Mesa lateral', { width: 500, height: 550, depth: 400 }, { shelf: true })],
    ['escritorio', table('desk', 'Escritorio', { width: 1200, height: 750, depth: 600 })],
    ['mesa de trabajo', table('standing', 'Mesa de trabajo', { width: 1500, height: 900, depth: 700 }, { overhang: 30, shelf: true })],
    ['escritorio de pie', table('standing', 'Escritorio de pie', { width: 1200, height: 1050, depth: 700 }, { overhang: 30 })],
    ['banco', table('seat', 'Banco', { width: 1200, height: 450, depth: 350 }, { shelf: true })],
    ['banco para uno', table('seat', 'Banco', { width: 400, height: 450, depth: 350 }, { overhang: 30 })],
    ...([1, 2, 3, 4] as const).flatMap((drawers) =>
      (['left', 'right'] as const).map((side): [string, TablePlan] => [`escritorio con ${drawers} cajones a la ${side === 'left' ? 'izquierda' : 'derecha'}`, table('desk', 'Escritorio con cajonera', { width: 1300, height: 750, depth: 600 }, { pedestal: { side, drawers } })]),
    ),
  ]
  const onLegs = variants.map(([name, plan]): [string, TablePlan] => [`${name} con patas`, { ...plan, legs: 'legs' }])
  const tapered = onLegs.filter(([name]) => /^(comedor|comedor largo|centro|escritorio con 2 cajones a la izquierda) con patas$/.test(name)).map(([name, plan]): [string, TablePlan] => [`${name} cónicas`, { ...plan, legStyle: 'tapered' }])
  // Splayed: a top that overhangs all round, the same on a long table with legs in between, a desk whose back legs stay at the wall, and a flush top, where none can lean.
  const splayedLegs = onLegs.filter(([name]) => /^(comedor|comedor largo|centro|escritorio) con patas$/.test(name)).map(([name, plan]): [string, TablePlan] => [`${name} abiertas`, { ...plan, overhang: Math.max(plan.overhang, 40), legStyle: 'splayed' }])
  const flushSplayed: [string, TablePlan] = ['comedor al ras con patas abiertas', { ...onLegs.find(([name]) => name === 'comedor con patas')![1], overhang: 0, legStyle: 'splayed' }]
  const all = [...variants, ...onLegs, ...tapered, ...splayedLegs, flushSplayed]
  // Knocked down: bolts where the aprons meet the legs or the panel ends, and minifix in a desk with its pedestal.
  const knockedDown = (['comedor largo', 'comedor largo con patas', 'mesa de trabajo con patas'] as const).map((name): [string, TablePlan] => [`${name}, desarmable con pernos`, { ...all.find(([n]) => n === name)![1], assembly: 'bolts' }])
  const desk = all.find(([n]) => n === 'escritorio con 3 cajones a la izquierda')![1]
  // Rounded corners: all four where the top overhangs all round, and only the front two on a desk, whose ends reach the back edge.
  const rounded = (['comedor con patas', 'mesa de trabajo'] as const).map((name): [string, TablePlan] => [`${name}, de esquinas redondeadas`, { ...all.find(([n]) => n === name)![1], corners: 'rounded' }])
  // Cable passes: in the middle of a plain desk, moved off a cleat or a pedestal, and through a top that also has rounded corners.
  const wired = all.filter(([n]) => /^(escritorio|escritorio con 3 cajones a la izquierda|escritorio con patas)$/.test(n)).map(([name, plan]): [string, TablePlan] => [`${name}, con pasacables`, { ...plan, cable: true }])
  const wiredRounded: [string, TablePlan] = ['escritorio de esquinas redondeadas con pasacables', { ...all.find(([n]) => n === 'escritorio')![1], overhang: 30, corners: 'rounded', cable: true }]
  const roundedDesk: [string, TablePlan] = ['escritorio de esquinas redondeadas', { ...all.find(([n]) => n === 'escritorio')![1], overhang: 30, corners: 'rounded' }]
  // Low stretchers: an H under a long table, between its middle legs, with every leg style and knocked down; one at the leg end of a desk; an H under a stool.
  const of = (name: string) => all.find(([n]) => n === name)![1]
  const tiedLow: [string, TablePlan][] = [
    ...(['comedor con patas', 'comedor con patas cónicas', 'comedor con patas abiertas'] as const).map((name): [string, TablePlan] => [`${name}, con travesaños en H`, { ...of(name), stretcher: 'h' }]),
    ['comedor largo con patas, con travesaños en H, desarmable con pernos', { ...of('comedor largo con patas'), stretcher: 'h', assembly: 'bolts' }],
    ['escritorio con 2 cajones a la izquierda con patas cónicas, con travesaño', { ...of('escritorio con 2 cajones a la izquierda con patas cónicas'), stretcher: 'ends' }],
    ['escritorio con patas abiertas, con travesaños', { ...of('escritorio con patas abiertas'), stretcher: 'ends' }],
    ['banco para uno con patas, con travesaños en H', { ...of('banco para uno con patas'), stretcher: 'h' }],
  ]
  const pulled = (['notch', 'handle'] as const).map((pulls): [string, TablePlan] => [`escritorio con 3 cajones a la izquierda, con ${pulls === 'notch' ? 'muesca' : 'jaladeras'}`, { ...desk, pedestal: { ...desk.pedestal, pulls } }])
  return [...all, ...tiedLow, ...pulled, ...knockedDown, ...rounded, roundedDesk, ...wired, wiredRounded, ['escritorio con 3 cajones a la izquierda, desarmable con minifix', { ...desk, assembly: 'cams' }], ['escritorio con 3 cajones a la izquierda, cantos a la vista', { ...desk, edges: 'exposed' }]]
}

const isDesk = (plan: TablePlan) => plan.use === 'desk'
const withSize = (plan: TablePlan, size: Partial<TablePlan['dimensions']>): TablePlan => ({ ...plan, dimensions: { ...plan.dimensions, ...size } })

/** A table's or desk's plan: what it is for sets its heights and parts; measures, overhang, shelf and pedestal are choices. */
const tableFields: FieldSpec<TablePlan>[] = [
  section('Qué es', [
    choice({
      key: 'use',
      label: 'Uso',
      lockedByDefault: true,
      options: optionsOf(TABLE_LABELS.use),
      get: (p) => p.use,
      set: tableForUse,
    }),
  ]),
  section('Medidas', [
    numbers(3, [
      number({ key: 'dimensions.height', label: 'Alto', ...PLAN_MEASURE, lockedByDefault: true, get: (p) => p.dimensions.height, set: (p, height) => withSize(p, { height }) }),
      number({ key: 'dimensions.width', label: 'Largo', ...PLAN_MEASURE, get: (p) => p.dimensions.width, set: (p, width) => withSize(p, { width }) }),
      number({ key: 'dimensions.depth', label: 'Fondo', ...PLAN_MEASURE, get: (p) => p.dimensions.depth, set: (p, depth) => withSize(p, { depth }) }),
    ]),
    numbers(2, [number({ key: 'overhang', label: 'La cubierta sobresale', min: 0, get: (p) => p.overhang, set: (p, overhang) => ({ ...p, overhang: Math.max(0, overhang) }) })]),
    choice({ key: 'corners', label: 'Esquinas de la cubierta', ...fromLabels(TABLE_LABELS.corners), get: (p) => p.corners ?? 'square', set: (p, corners) => ({ ...p, corners }) }),
    yesNo({ key: 'cable', label: 'Pasacables en la cubierta', visibleWhen: (p) => p.use === 'desk' || p.use === 'standing', get: (p) => !!p.cable, set: (p, cable) => ({ ...p, cable }) }),
    material({ key: 'material', label: 'Triplay', use: 'carcass', get: (p) => p.material, set: (p, material) => ({ ...p, material }) }),
    edgeBandingField<TablePlan>(),
  ]),
  section('Patas', [
    choice({ key: 'legs', label: 'Patas', part: 'Patas', lockedByDefault: true, ...fromLabels(TABLE_LABELS.legs), get: (p) => p.legs, set: (p, legs) => ({ ...p, legs }) }),
    legStyleField((p) => p.legs === 'legs', LEANING_LEG_STYLE_LABELS),
    choice({ key: 'stretcher', label: 'Travesaño bajo', part: 'Patas', ...fromLabels(TABLE_LABELS.stretcher), visibleWhen: (p) => p.legs === 'legs', get: (p) => p.stretcher ?? 'none', set: (p, stretcher) => ({ ...p, stretcher }) }),
  ]),
  section((p) => (isDesk(p) ? 'Cajonera' : 'Abajo'), [
    choice({
      key: 'pedestal.side',
      label: 'Lado',
      ariaLabel: 'Lado de la cajonera',
      ...fromLabels(TABLE_LABELS.pedestal),
      visibleWhen: isDesk,
      get: (p) => p.pedestal.side,
      // A pedestal has at least one drawer; none, none.
      set: (p, side) => ({ ...p, pedestal: { ...p.pedestal, side, drawers: side === 'none' ? 0 : Math.max(1, p.pedestal.drawers) } }),
    }),
    stepper({ key: 'pedestal.drawers', label: 'Cajones', ariaLabel: 'cajones de la cajonera', min: 1, max: MAX_PEDESTAL_DRAWERS, visibleWhen: (p) => isDesk(p) && p.pedestal.side !== 'none', get: (p) => p.pedestal.drawers, set: (p, drawers) => ({ ...p, pedestal: { ...p.pedestal, drawers } }) }),
    choice({ key: 'pedestal.pulls', label: 'Jaladeras', ...fromLabels(TABLE_LABELS.pulls), visibleWhen: (p) => isDesk(p) && p.pedestal.side !== 'none', get: pedestalPulls, set: (p, pulls) => ({ ...p, pedestal: { ...p.pedestal, pulls } }) }),
    yesNo({ key: 'shelf', label: 'Repisa baja', visibleWhen: (p) => !isDesk(p), get: (p) => p.shelf, set: (p, shelf) => ({ ...p, shelf }) }),
  ]),
  section('Armado', [...assemblyFields<TablePlan>(), note('Cada extremo de la mesa se pega aparte, y los faldones largos con sus travesaños. La cubierta se atornilla encima al final.', (p) => !!p.assembly && p.assembly !== 'glued', 'assembly')]),
]

const TABLE_PARTS: Parts<TablePlan> = {
  list: [
    {
      id: 'size',
      name: 'Uso y tamaño',
      side: 'outside',
      fields: ['use', 'dimensions.height', 'dimensions.width', 'dimensions.depth'],
      joints: [],
      summary: ({ use, dimensions: d }) => `${TABLE_LABELS.use[use].name}, ${d.height} de alto × ${d.width} de largo × ${d.depth} de fondo`,
    },
    woodPart(),
    assemblyPart(),
    { id: 'top', name: 'Cubierta', side: 'outside', fields: ['overhang', 'corners', 'cable'], joints: [], summary: (p) => (p.overhang ? `Sobresale ${p.overhang} mm` : 'Al ras de las patas') },
    { id: 'legs', name: 'Patas', side: 'outside', fields: ['legs', 'legStyle', 'stretcher'], joints: ['body', 'base'], jointsTitle: 'Uniones de las patas y la cubierta', summary: (p) => (p.legs === 'legs' && (p.legStyle ?? 'straight') !== 'straight' ? `Con ${LEANING_LEG_STYLE_LABELS[p.legStyle!].phrase}` : TABLE_LABELS.legs[p.legs].option) },
    {
      id: 'under',
      name: 'Abajo',
      nameOf: (p) => (isDesk(p) ? 'Cajonera' : 'Abajo'),
      side: 'outside',
      fields: ['pedestal.side', 'pedestal.drawers', 'pedestal.pulls', 'shelf'],
      joints: ['drawers', 'back'],
      jointsTitle: 'Uniones de la cajonera',
      summary: (p) =>
        isDesk(p) ? (p.pedestal.side === 'none' ? 'Sin cajonera' : `${counted(p.pedestal.drawers, 'cajón', 'cajones')}, ${lower(TABLE_LABELS.pedestal[p.pedestal.side].phrase)}`) : p.shelf ? 'Con repisa baja' : 'Sin repisa baja',
    },
  ],
  ofPiece(piece) {
    if (piece.id === 'top') return 'top'
    if (piece.id.startsWith('ped-') || piece.role.startsWith('drawer-') || piece.id === 'low-shelf') return 'under'
    return 'legs'
  },
}

/** A plan saved before its rules, as what was built from it: a pedestal that never got drawn, or a shelf a desk does not take, is not part of the furniture. */
export function settleTable(plan: TablePlan): TablePlan {
  const built = plan.use === 'desk' && plan.pedestal.side !== 'none' && plan.pedestal.drawers > 0
  const noPedestal = plan.pedestal.side === 'none' && plan.pedestal.drawers === 0
  const noShelf = plan.use !== 'desk' || !plan.shelf
  if ((built || noPedestal) && noShelf) return plan
  return { ...plan, pedestal: built ? plan.pedestal : { side: 'none', drawers: 0 }, shelf: plan.use === 'desk' ? false : plan.shelf }
}

/** The same table for another use, without what that use does not take; its name follows only while it is the plain name of its use, so a name of its own stays. */
export function tableForUse(plan: TablePlan, use: TablePlan['use']): TablePlan {
  if (use === plan.use) return plan
  const name = plan.name === TABLE_LABELS.use[plan.use].name ? TABLE_LABELS.use[use].name : plan.name
  return settleTable({ ...plan, use, name })
}

/** The front and back legs of an end, each as far in as the top sticks out, with an apron between them. */
const legsDepth = (plan: TablePlan) => 2 * LEG_WIDTH + Math.min(plan.overhang, MAX_END_INSET) * (plan.use === 'desk' ? 1 : 2)
const legsFit = (plan: TablePlan) => plan.legs !== 'legs' || plan.dimensions.depth > legsDepth(plan)
/** A stretcher asked where it shows: on panel ends the plan keeps it and builds none, as it does a leg style. */
const asksStretcher = (plan: TablePlan) => plan.legs === 'legs' && (plan.stretcher ?? 'none') !== 'none'
const LEGS_TOO_SHALLOW = 'No cupo: las patas del frente y las de atrás no caben en ese fondo; hazla más honda, quítale vuelo a la cubierta o cámbiala a costados.'

export const tableModule: FurnitureModule<TablePlan> = {
  kind: 'table',
  schema: TablePlan,
  rules: [
    ...outsideRules<TablePlan>('El largo'),
    { holds: (p) => p.use === 'desk' || (p.pedestal.side === 'none' && p.pedestal.drawers === 0), message: 'Solo un escritorio lleva cajonera. Para este uso, elige sin cajonera y cero cajones.', path: ['pedestal'] },
    { holds: (p) => (p.pedestal.side === 'none') === (p.pedestal.drawers === 0), message: 'Una cajonera necesita lado y al menos un cajón; sin cajonera, el número de cajones debe ser cero.', path: ['pedestal', 'drawers'] },
    { holds: (p) => p.use !== 'desk' || !p.shelf, message: 'Un escritorio no lleva repisa baja: estorba las piernas.', path: ['shelf'] },
    { holds: legsFit, message: LEGS_TOO_SHALLOW, path: ['dimensions', 'depth'] },
    { holds: (p) => !asksStretcher(p) || !p.shelf, message: 'La repisa baja ya ocupa el lugar del travesaño bajo: quita uno de los dos.', path: ['stretcher'] },
    { holds: (p) => !asksStretcher(p) || p.dimensions.height >= STRETCHER_MIN_HEIGHT, message: `El travesaño bajo no cabe bajo el faldón en una mesa de menos de ${STRETCHER_MIN_HEIGHT} mm de alto.`, path: ['stretcher'] },
    { holds: (p) => !asksStretcher(p) || p.stretcher !== 'h' || p.use !== 'desk', message: 'Un escritorio no lleva el larguero de la H: estorba los pies. Deja los travesaños solo en los extremos.', path: ['stretcher'] },
    { holds: (p) => !asksStretcher(p) || p.stretcher !== 'h' || p.dimensions.depth >= legsDepth(p) + 3 * DEFAULT_THICKNESS, message: 'El larguero de la H no cabe entre las patas del frente y las de atrás en ese fondo: deja los travesaños solo en los extremos.', path: ['stretcher'] },
  ],
  label: 'una mesa',
  expert: { what: 'a table or a desk' },
  build: buildTable,
  builtAsAsked: (plan, design) => drawersShort(design, plan.use === 'desk' && plan.pedestal.side !== 'none' ? plan.pedestal.drawers : 0, 'en esa cajonera'),
  describeChanges: describeTableChanges,
  resize: (plan, axis, value) => ({ ok: true, plan: { ...plan, dimensions: { ...plan.dimensions, [DIMENSION_OF_AXIS[axis]]: value } } }),
  withMeasures: (plan, { width, height, depth }) => ({ ...plan, dimensions: { width, height, depth } }),
  summary: (_, dimensions) => measuresSummary(dimensions),
  measuresNote: () => null,
  traceLabel: (plan) => `Mesa (${plan.use})`,
  benchVariants: benchTables,
  fields: tableFields,
  parts: TABLE_PARTS,
}
