import { z } from 'zod'
import { startAt, partway, endAt, ref, extent, makeJoint } from '../../design/builders'
import { DIMENSION_OF_AXIS, type Extent, type FaceRef, type Design, type Piece, type Joint } from '../../design/schema'
import { completeJoints } from '../../design/joints'
import type { DesignKind } from '../../design/kind'
import { backBoard, materialById, type Catalog } from '../../materials/catalog'
import { stiffness } from '../../materials/grades'
import { maxSpan } from '../../checks/structure/rules/deflection'
import { ASSUMPTIONS, pocketScrewId } from '../../assumptions'
import { addDrawers, KICK_HEIGHT, KICK_SETBACK, LEG_WIDTH, legLayers, lower, MAX_SPAN, measuresSummary, panelOf, supportsAcross, thicknessOf, type AddDrawer } from './common'
import { choice, fromLabels, material, number, numbers, optionsOf, section, stepper, yesNo, type FieldSpec } from './fields'
import type { FurnitureModule, Labels } from './module'
import { counted, woodPart, type Parts } from './parts'

// A table or a desk from its ficha: a top on two panel ends or on four legs, tied by aprons, with cleats under the top and, on a desk, a drawer pedestal.

/** The most drawers a desk pedestal takes. */
export const MAX_PEDESTAL_DRAWERS = 4

export const TablePlan = z.object({
  kind: z.literal('table'),
  use: z.enum(['dining', 'coffee', 'side', 'desk', 'standing']).describe('dining: dining table; coffee: coffee table; side: side table or nightstand; desk: desk to sit at; standing: work surface to stand at, a workbench or a standing desk'),
  name: z.string().describe('Name of the furniture for the person, in Spanish: "Escritorio con cajonera", "Mesa de centro"'),
  material: z.string().describe('Plywood id, usually "T18"'),
  dimensions: z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() }).describe('Outside length (width), height and depth in mm'),
  overhang: z.number().nonnegative().describe('How far the top sticks out past the sides, in mm; 0 if the sides reach the edge'),
  shelf: z.boolean().describe('Low shelf between the sides (coffee and side tables, workbenches); a desk has none, it gets in the way of the legs'),
  pedestal: z.object({
    side: z.enum(['none', 'left', 'right']).describe('Which side the pedestal goes on, seen from the front of the desk'),
    drawers: z.number().int().min(0).max(MAX_PEDESTAL_DRAWERS).describe('How many drawers the pedestal has; 0 if there is none'),
  }),
  legs: z.enum(['panel', 'legs']).default('panel').describe('panel: two panel ends; legs: four straight legs from floor to top with an apron all round (the pedestal side keeps its panel); the height of the table is the length of the legs'),
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
  } satisfies Record<TablePlan['use'], { option: string; name: string }>,
  pedestal: {
    none: { option: 'Sin cajonera', phrase: 'sin cajonera' },
    left: { option: 'Izquierda', phrase: 'cajonera a la izquierda' },
    right: { option: 'Derecha', phrase: 'cajonera a la derecha' },
  } satisfies Labels<TablePlan['pedestal']['side']>,
  legs: {
    panel: { option: 'Costados de panel', phrase: 'con costados de panel' },
    legs: { option: 'Cuatro patas', phrase: 'con cuatro patas' },
  } satisfies Labels<TablePlan['legs']>,
}

/** Typical outside measures for each use, in mm, when the person gives none. */
export const TYPICAL_TABLE_DIMENSIONS: Record<TablePlan['use'], TablePlan['dimensions']> = {
  dining: { width: 1500, height: 750, depth: 900 },
  coffee: { width: 1000, height: 420, depth: 550 },
  side: { width: 500, height: 550, depth: 400 },
  desk: { width: 1200, height: 750, depth: 600 },
  standing: { width: 1500, height: 900, depth: 700 },
}

const APRON = 80
/** On a desk the back apron runs lower: it braces the ends and hides the legs from the front. */
const MODESTY = 300
const SHELF_HEIGHT = 120
const PEDESTAL = 420
/** Past this inset the ends would stand under the middle of the top, not at its sides. */
const MAX_END_INSET = 50

/** What each use is, for the checks by kind of furniture: the design says it, so renaming it does not change them. */
export const TABLE_KIND: Record<TablePlan['use'], DesignKind> = { dining: 'diningTable', coffee: 'coffeeTable', side: 'sideTable', desk: 'desk', standing: 'workbench' }

const LOAD: Record<TablePlan['use'], Piece['load']> = { dining: 'medium', coffee: 'light', side: 'light', desk: 'medium', standing: 'heavy' }

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

/** The outer piece of the right end in a row, which sets where the aprons stand in depth. */
const rightEnd = (l: Layout, row: Row) => (l.legs.right ? `leg-${row}-right-1` : 'side-right')

function ends(l: Layout): Piece[] {
  const { plan, inset, backInset, endY } = l
  const legZ = { front: extent(null, ref('furniture.z1', -inset), LEG_WIDTH), back: extent(ref('furniture.z0', backInset), null, LEG_WIDTH) }
  return ENDS.flatMap((end) => {
    const [side, name, towards] = end === 'left' ? ['izquierdo', 'izquierda', 'right' as const] : ['derecho', 'derecha', 'left' as const]
    const x = end === 'left' ? startAt(ref('furniture.x0', plan.overhang)) : endAt(ref('furniture.x1', -plan.overhang))
    if (!l.legs[end]) return [l.panel({ id: `side-${end}`, name: `Costado ${side}`, role: 'side', normal: 'x', x, y: endY, z: l.endsZ })]
    return (['front', 'back'] as const).flatMap((row) => legLayers(plan.material, `leg-${row}-${end}`, `Pata ${row === 'front' ? 'delantera' : 'trasera'} ${name}`, x, towards, endY, legZ[row]))
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

/** Aprons front and back tie the ends; screwed from inside with pocket screws, they keep the table square. Legs take one more on each side. */
function aprons(l: Layout, open: Open): { pieces: Piece[]; joints: Joint[] } {
  const { panel, t, desk } = l
  const screws = [{ hardwareId: pocketScrewId(t), count: 2 }]
  const x = extent(ref(open[0].face), ref(open[1].face))
  const pieces = [
    panel({ id: 'apron-front', name: 'Faldón del frente', role: 'apron', normal: 'z', x, y: extent(null, ref('top.y0'), APRON), z: endAt(ref(`${rightEnd(l, 'front')}.z1`)) }),
    panel({ id: 'apron-back', name: desk ? 'Faldón trasero' : 'Faldón de atrás', role: 'apron', normal: 'z', x, y: extent(null, ref('top.y0'), desk ? MODESTY : APRON), z: startAt(ref(`${rightEnd(l, 'back')}.z0`)) }),
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
    const rows: [string, string, Extent][] = twoRows
      ? [['front', 'del frente', extent(null, ref('apron-front.z0'), LEG_WIDTH)], ['back', 'de atrás', extent(ref('apron-back.z1'), null, LEG_WIDTH)]]
      : [['', '', extent(ref('apron-back.z1'), ref('apron-front.z0'))]]
    for (const [row, words, z] of rows) pieces.push(...legLayers(plan.material, `leg-middle-${k}${row ? `-${row}` : ''}`, `Pata intermedia ${middle > 1 ? `${k} ` : ''}${words}`.trim(), first, 'right', endY, z))
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

/** The low shelf of a coffee or side table or a workbench, on short feet; a desk and a long table on legs take none, and say why. */
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

export function buildTable(plan: TablePlan, catalog: Catalog): { design: Design; notes: string[] } {
  const l = layoutOf(plan, catalog)
  const top = l.panel({ id: 'top', name: 'Cubierta', role: 'top', normal: 'y', x: extent(ref('furniture.x0'), ref('furniture.x1')), y: endAt(ref('furniture.y1')), z: extent(ref('furniture.z0'), ref('furniture.z1')), load: LOAD[plan.use], edges: ['front', 'back', 'left', 'right'] })
  const box = l.pedestal ? pedestalBox(l, l.pedestal) : null
  // The open part between the ends, or between the pedestal and the far end.
  const open: Open = [l.pedestal === 'left' && box ? box.bound : endBound(l, 'left'), l.pedestal === 'right' && box ? box.bound : endBound(l, 'right')]
  const tied = aprons(l, open)
  const held = supports(l, open)
  const shelf = lowShelf(l, open, held.middleLegs)

  const pieces = [top, ...ends(l), ...(box?.pieces ?? []), ...tied.pieces, ...held.pieces, ...shelf.pieces]
  const design: Design = { schema: 1, name: plan.name, dimensions: { ...plan.dimensions }, wallAnchored: false, notes: '', pieces, joints: tied.joints, kind: TABLE_KIND[plan.use] }
  const placed = addDrawers(design, box?.drawers ?? [], catalog)
  return { design: completeJoints(placed.design, catalog), notes: [...shelf.notes, ...placed.notes] }
}

function describeTableChanges(before: TablePlan, after: TablePlan): string[] {
  const changes: string[] = []
  if (before.use !== after.use) changes.push(`ahora ${lower(TABLE_LABELS.use[after.use].name)}`)
  else if (before.name !== after.name) changes.push(`se llama «${after.name}»`)
  const [a, b] = [before.dimensions, after.dimensions]
  if (a.height !== b.height || a.width !== b.width || a.depth !== b.depth) changes.push(`medidas ${b.height} × ${b.width} × ${b.depth} mm`)
  if (before.material !== after.material) changes.push(`material ${after.material}`)
  if (before.overhang !== after.overhang) changes.push(after.overhang ? `cubierta que sobresale ${after.overhang} mm` : 'costados a la orilla')
  if (before.shelf !== after.shelf) changes.push(after.shelf ? 'con repisa baja' : 'sin repisa baja')
  if (before.legs !== after.legs) changes.push(TABLE_LABELS.legs[after.legs].phrase)
  if (before.pedestal.side !== after.pedestal.side) changes.push(TABLE_LABELS.pedestal[after.pedestal.side].phrase)
  if (after.pedestal.side !== 'none' && before.pedestal.drawers !== after.pedestal.drawers) changes.push(`${after.pedestal.drawers} ${after.pedestal.drawers === 1 ? 'cajón' : 'cajones'} en la cajonera`)
  return changes
}

function benchTables(): [string, TablePlan][] {
  const table = (use: TablePlan['use'], name: string, dimensions: TablePlan['dimensions'], extra: Partial<TablePlan> = {}): TablePlan => ({ kind: 'table', use, name, material: 'T18', dimensions, overhang: 0, shelf: false, pedestal: { side: 'none', drawers: 0 }, legs: 'panel', ...extra })
  const variants: [string, TablePlan][] = [
    ['comedor', table('dining', 'Mesa de comedor', { width: 1500, height: 750, depth: 900 }, { overhang: 50 })],
    ['comedor largo', table('dining', 'Mesa de comedor', { width: 1800, height: 750, depth: 900 }, { overhang: 50 })],
    ['centro', table('coffee', 'Mesa de centro', { width: 1000, height: 420, depth: 550 }, { shelf: true })],
    ['lateral', table('side', 'Mesa lateral', { width: 500, height: 550, depth: 400 }, { shelf: true })],
    ['escritorio', table('desk', 'Escritorio', { width: 1200, height: 750, depth: 600 })],
    ['mesa de trabajo', table('standing', 'Mesa de trabajo', { width: 1500, height: 900, depth: 700 }, { overhang: 30, shelf: true })],
    ['escritorio de pie', table('standing', 'Escritorio de pie', { width: 1200, height: 1050, depth: 700 }, { overhang: 30 })],
    ...([1, 2, 3, 4] as const).flatMap((drawers) =>
      (['left', 'right'] as const).map((side): [string, TablePlan] => [`escritorio con ${drawers} cajones a la ${side === 'left' ? 'izquierda' : 'derecha'}`, table('desk', 'Escritorio con cajonera', { width: 1300, height: 750, depth: 600 }, { pedestal: { side, drawers } })]),
    ),
  ]
  return [...variants, ...variants.map(([name, plan]): [string, TablePlan] => [`${name} con patas`, { ...plan, legs: 'legs' }])]
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
      // Its name follows; only a desk keeps a pedestal, and a desk has no low shelf.
      set: (p, use) => ({ ...p, use, name: TABLE_LABELS.use[use].name, shelf: use === 'desk' ? false : p.shelf, pedestal: use === 'desk' ? p.pedestal : { side: 'none', drawers: 0 } }),
    }),
  ]),
  section('Medidas', [
    numbers(3, [
      number({ key: 'dimensions.height', label: 'Alto', lockedByDefault: true, get: (p) => p.dimensions.height, set: (p, height) => withSize(p, { height }) }),
      number({ key: 'dimensions.width', label: 'Largo', get: (p) => p.dimensions.width, set: (p, width) => withSize(p, { width }) }),
      number({ key: 'dimensions.depth', label: 'Fondo', get: (p) => p.dimensions.depth, set: (p, depth) => withSize(p, { depth }) }),
    ]),
    numbers(2, [number({ key: 'overhang', label: 'La cubierta sobresale', min: 0, get: (p) => p.overhang, set: (p, overhang) => ({ ...p, overhang: Math.max(0, overhang) }) })]),
    material({ key: 'material', label: 'Triplay', use: 'carcass', get: (p) => p.material, set: (p, material) => ({ ...p, material }) }),
  ]),
  section('Patas', [choice({ key: 'legs', label: 'Patas', part: 'Patas', lockedByDefault: true, ...fromLabels(TABLE_LABELS.legs), get: (p) => p.legs, set: (p, legs) => ({ ...p, legs }) })]),
  section((p) => (isDesk(p) ? 'Cajonera' : 'Abajo'), [
    choice({
      key: 'pedestal.side',
      label: 'Lado',
      ariaLabel: 'Lado de la cajonera',
      ...fromLabels(TABLE_LABELS.pedestal),
      visibleWhen: isDesk,
      get: (p) => p.pedestal.side,
      // A pedestal has at least one drawer; none, none.
      set: (p, side) => ({ ...p, pedestal: { side, drawers: side === 'none' ? 0 : Math.max(1, p.pedestal.drawers) } }),
    }),
    stepper({ key: 'pedestal.drawers', label: 'Cajones', ariaLabel: 'cajones de la cajonera', min: 1, max: MAX_PEDESTAL_DRAWERS, visibleWhen: (p) => isDesk(p) && p.pedestal.side !== 'none', get: (p) => p.pedestal.drawers, set: (p, drawers) => ({ ...p, pedestal: { ...p.pedestal, drawers } }) }),
    yesNo({ key: 'shelf', label: 'Repisa baja', visibleWhen: (p) => !isDesk(p), get: (p) => p.shelf, set: (p, shelf) => ({ ...p, shelf }) }),
  ]),
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
    { id: 'top', name: 'Cubierta', side: 'outside', fields: ['overhang'], joints: [], summary: (p) => (p.overhang ? `Sobresale ${p.overhang} mm` : 'Al ras de las patas') },
    { id: 'legs', name: 'Patas', side: 'outside', fields: ['legs'], joints: ['body', 'base'], summary: (p) => TABLE_LABELS.legs[p.legs].option },
    {
      id: 'under',
      name: 'Abajo',
      nameOf: (p) => (isDesk(p) ? 'Cajonera' : 'Abajo'),
      side: 'outside',
      fields: ['pedestal.side', 'pedestal.drawers', 'shelf'],
      joints: ['drawers', 'back'],
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

export const tableModule: FurnitureModule<TablePlan> = {
  kind: 'table',
  schema: TablePlan,
  label: 'una mesa',
  expert: { what: 'a table or a desk' },
  build: buildTable,
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
