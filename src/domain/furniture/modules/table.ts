import { z } from 'zod'
import { startAt, partway, endAt, ref, extent, makeJoint } from '../../design/builders'
import { DIMENSION_OF_AXIS, type FaceRef, type Design, type Piece, type Joint } from '../../design/schema'
import { completeJoints } from '../../design/joints'
import type { DesignKind } from '../../design/kind'
import { backBoard, type Catalog } from '../../materials/catalog'
import { pocketScrewId } from '../../checks/structure/assumptions'
import { addDrawers, KICK_HEIGHT, KICK_SETBACK, lower, measuresSummary, panelOf, supportsAcross, thicknessOf, type AddDrawer } from './common'
import { choice, fromLabels, material, number, numbers, optionsOf, section, stepper, yesNo, type FieldSpec } from './fields'
import type { FurnitureModule, Labels } from './module'

// A table or a desk from its ficha: a top on two panel ends, tied by aprons, with cleats under the top and, on a desk, a drawer pedestal.

/** The most drawers a desk pedestal takes. */
export const MAX_PEDESTAL_DRAWERS = 4

export const TablePlan = z.object({
  kind: z.literal('table'),
  use: z.enum(['dining', 'coffee', 'side', 'desk']).describe('dining: dining table; coffee: coffee table; side: side table or nightstand; desk: desk'),
  name: z.string().describe('Name of the furniture for the person, in Spanish: "Escritorio con cajonera", "Mesa de centro"'),
  material: z.string().describe('Plywood id, usually "T18"'),
  dimensions: z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() }).describe('Outside length (width), height and depth in mm'),
  overhang: z.number().nonnegative().describe('How far the top sticks out past the sides, in mm; 0 if the sides reach the edge'),
  shelf: z.boolean().describe('Low shelf between the sides (coffee and side tables); a desk has none, it gets in the way of the legs'),
  pedestal: z.object({
    side: z.enum(['none', 'left', 'right']).describe('Which side the pedestal goes on, seen from the front of the desk'),
    drawers: z.number().int().min(0).max(MAX_PEDESTAL_DRAWERS).describe('How many drawers the pedestal has; 0 if there is none'),
  }),
})
export type TablePlan = z.infer<typeof TablePlan>

export const TABLE_LABELS = {
  /** `name` is what each use is called. */
  use: {
    dining: { option: 'Comedor', name: 'Mesa de comedor' },
    coffee: { option: 'Centro', name: 'Mesa de centro' },
    side: { option: 'Lateral', name: 'Mesa lateral' },
    desk: { option: 'Escritorio', name: 'Escritorio' },
  } satisfies Record<TablePlan['use'], { option: string; name: string }>,
  pedestal: {
    none: { option: 'Sin cajonera', phrase: 'sin cajonera' },
    left: { option: 'Izquierda', phrase: 'cajonera a la izquierda' },
    right: { option: 'Derecha', phrase: 'cajonera a la derecha' },
  } satisfies Labels<TablePlan['pedestal']['side']>,
}

/** Typical outside measures for each use, in mm, when the person gives none. */
export const TYPICAL_TABLE_DIMENSIONS: Record<TablePlan['use'], TablePlan['dimensions']> = {
  dining: { width: 1500, height: 750, depth: 900 },
  coffee: { width: 1000, height: 420, depth: 550 },
  side: { width: 500, height: 550, depth: 400 },
  desk: { width: 1200, height: 750, depth: 600 },
}

const APRON = 80
/** On a desk the back apron runs lower: it braces the ends and hides the legs from the front. */
const MODESTY = 300
const SHELF_HEIGHT = 120
const PEDESTAL = 420
/** Past this inset the ends would stand under the middle of the top, not at its sides. */
const MAX_END_INSET = 50

/** What each use is, for the checks by kind of furniture: the design says it, so renaming it does not change them. */
const KIND: Record<TablePlan['use'], DesignKind> = { dining: 'diningTable', coffee: 'coffeeTable', side: 'sideTable', desk: 'desk' }

const LOAD: Record<TablePlan['use'], Piece['load']> = { dining: 'medium', coffee: 'light', side: 'light', desk: 'medium' }

export function buildTable(plan: TablePlan, catalog: Catalog): { design: Design; notes: string[] } {
  const t = thicknessOf(catalog, plan.material)
  const { width, height, depth } = plan.dimensions
  const panel = panelOf(plan.material)
  const pieces: Piece[] = []
  const joints: Joint[] = []
  const notes: string[] = []
  const desk = plan.use === 'desk'
  const inset = Math.min(plan.overhang, MAX_END_INSET)
  const endsZ = extent(ref('furniture.z0', desk ? 0 : inset), ref('furniture.z1', -inset))
  const pedestal = desk && plan.pedestal.side !== 'none' && plan.pedestal.drawers > 0 ? plan.pedestal.side : null
  let drawers: AddDrawer[] = []

  pieces.push(
    panel({ id: 'top', name: 'Cubierta', role: 'top', normal: 'y', x: extent(ref('furniture.x0'), ref('furniture.x1')), y: endAt(ref('furniture.y1')), z: extent(ref('furniture.z0'), ref('furniture.z1')), load: LOAD[plan.use], edges: ['front', 'back', 'left', 'right'] }),
    panel({ id: 'side-left', name: 'Costado izquierdo', role: 'side', normal: 'x', x: startAt(ref('furniture.x0', plan.overhang)), y: extent(ref('furniture.y0'), ref('top.y0')), z: endsZ }),
    panel({ id: 'side-right', name: 'Costado derecho', role: 'side', normal: 'x', x: endAt(ref('furniture.x1', -plan.overhang)), y: extent(ref('furniture.y0'), ref('top.y0')), z: endsZ }),
  )

  // The open part between the ends, or between the pedestal and the far end.
  let openLeft: FaceRef = 'side-left.x1'
  let openRight: FaceRef = 'side-right.x0'
  if (pedestal) {
    const outer = pedestal === 'left' ? 'side-left' : 'side-right'
    const between = pedestal === 'left' ? extent(ref('side-left.x1'), ref('ped-div.x0')) : extent(ref('ped-div.x1'), ref('side-right.x0'))
    const zBox = extent(ref('ped-back.z1'), ref(`${outer}.z1`))
    pieces.push(
      panel({ id: 'ped-div', name: 'Costado interior de la cajonera', role: 'divider', normal: 'x', x: pedestal === 'left' ? startAt(ref('side-left.x1', PEDESTAL - 2 * t)) : endAt(ref('side-right.x0', -(PEDESTAL - 2 * t))), y: extent(ref('furniture.y0'), ref('top.y0')), z: endsZ }),
      panel({ id: 'ped-back', name: 'Fondo de la cajonera', role: 'back', normal: 'z', x: between, y: extent(ref('furniture.y0'), ref('top.y0')), z: startAt(ref(`${outer}.z0`)) }),
      panel({ id: 'ped-kick', name: 'Zoclo de la cajonera', role: 'kick', normal: 'z', x: between, y: extent(ref('furniture.y0'), null, KICK_HEIGHT.pedestal), z: endAt(ref(`${outer}.z1`, -KICK_SETBACK)) }),
      panel({ id: 'ped-bottom', name: 'Piso de la cajonera', role: 'bottom', normal: 'y', x: between, y: startAt(ref('ped-kick.y1')), z: zBox, load: 'medium' }),
    )
    const n = plan.pedestal.drawers
    for (let k = 1; k < n; k++)
      pieces.push(panel({ id: `ped-sep-${k}`, name: `Separador ${k} de la cajonera`, role: 'shelf', normal: 'y', x: between, y: startAt(partway('ped-bottom.y1', 'top.y0', k / n, -t / 2)), z: zBox, load: 'light' }))
    const [left, right]: [FaceRef, FaceRef] = pedestal === 'left' ? ['side-left.x1', 'ped-div.x0'] : ['ped-div.x1', 'side-right.x0']
    drawers = Array.from({ length: n }, (_, i) => ({
      op: 'addDrawer' as const,
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
    openLeft = pedestal === 'left' ? 'ped-div.x1' : 'side-left.x1'
    openRight = pedestal === 'left' ? 'side-right.x0' : 'ped-div.x0'
  }

  // Aprons front and back tie the ends; screwed from inside with pocket screws, they keep the table square.
  const apronX = extent(ref(openLeft), ref(openRight))
  pieces.push(
    panel({ id: 'apron-front', name: 'Faldón del frente', role: 'apron', normal: 'z', x: apronX, y: extent(null, ref('top.y0'), APRON), z: endAt(ref('side-right.z1')) }),
    panel({ id: 'apron-back', name: desk ? 'Faldón trasero' : 'Faldón de atrás', role: 'apron', normal: 'z', x: apronX, y: extent(null, ref('top.y0'), desk ? MODESTY : APRON), z: startAt(ref('side-right.z0')) }),
  )
  for (const apron of ['apron-front', 'apron-back'])
    for (const end of [openLeft, openRight].map((f) => f.split('.')[0]))
      joints.push(makeJoint(`j-${apron}-${end}`, apron, end, 'pocket-screw', [{ hardwareId: pocketScrewId(t), count: 2 }]))

  // Cleats between the aprons, so the top never spans more than it can.
  const openWidth = width - 2 * plan.overhang - 2 * t - (pedestal ? PEDESTAL - t : 0)
  const cleats = supportsAcross(openWidth, t)
  for (let k = 1; k <= cleats; k++)
    pieces.push(panel({ id: `rail-${k}`, name: `Travesaño ${k}`, role: 'divider', normal: 'x', x: startAt(partway(openLeft, openRight, k / (cleats + 1), -t / 2)), y: extent(ref('apron-front.y0'), ref('top.y0')), z: extent(ref('apron-back.z1'), ref('apron-front.z0')) }))

  if (plan.shelf && !desk) {
    pieces.push(panel({ id: 'low-shelf', name: 'Repisa baja', role: 'shelf', normal: 'y', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: startAt(ref('furniture.y0', SHELF_HEIGHT)), z: endsZ, load: 'light' }))
    // The shelf sits close to the floor: short feet under it are simpler than anything above.
    const feet = supportsAcross(width - 2 * plan.overhang - 2 * t, t)
    for (let k = 1; k <= feet; k++)
      pieces.push(panel({ id: `shelf-leg-${k}`, name: `Apoyo ${k} de la repisa`, role: 'divider', normal: 'x', x: startAt(partway('side-left.x1', 'side-right.x0', k / (feet + 1), -t / 2)), y: extent(ref('furniture.y0'), ref('low-shelf.y0')), z: endsZ }))
  }
  if (plan.shelf && desk) notes.push('Un escritorio no lleva repisa baja: estorba las piernas.')

  const design: Design = { schema: 1, name: plan.name, dimensions: { width: width, height: height, depth: depth }, wallAnchored: false, notes: '', pieces: pieces, joints: joints, kind: KIND[plan.use] }
  const placed = addDrawers(design, drawers, catalog)
  notes.push(...placed.notes)
  return { design: completeJoints(placed.design, catalog), notes }
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
  if (before.pedestal.side !== after.pedestal.side) changes.push(TABLE_LABELS.pedestal[after.pedestal.side].phrase)
  if (after.pedestal.side !== 'none' && before.pedestal.drawers !== after.pedestal.drawers) changes.push(`${after.pedestal.drawers} ${after.pedestal.drawers === 1 ? 'cajón' : 'cajones'} en la cajonera`)
  return changes
}

function benchTables(): [string, TablePlan][] {
  const table = (use: TablePlan['use'], name: string, dimensions: TablePlan['dimensions'], extra: Partial<TablePlan> = {}): TablePlan => ({ kind: 'table', use, name, material: 'T18', dimensions, overhang: 0, shelf: false, pedestal: { side: 'none', drawers: 0 }, ...extra })
  return [
    ['comedor', table('dining', 'Mesa de comedor', { width: 1500, height: 750, depth: 900 }, { overhang: 50 })],
    ['comedor largo', table('dining', 'Mesa de comedor', { width: 1800, height: 750, depth: 900 }, { overhang: 50 })],
    ['centro', table('coffee', 'Mesa de centro', { width: 1000, height: 420, depth: 550 }, { shelf: true })],
    ['lateral', table('side', 'Mesa lateral', { width: 500, height: 550, depth: 400 }, { shelf: true })],
    ['escritorio', table('desk', 'Escritorio', { width: 1200, height: 750, depth: 600 })],
    ...([1, 2, 3, 4] as const).flatMap((drawers) =>
      (['left', 'right'] as const).map((side): [string, TablePlan] => [`escritorio con ${drawers} cajones a la ${side === 'left' ? 'izquierda' : 'derecha'}`, table('desk', 'Escritorio con cajonera', { width: 1300, height: 750, depth: 600 }, { pedestal: { side, drawers } })]),
    ),
  ]
}

const isDesk = (plan: TablePlan) => plan.use === 'desk'
const withSize = (plan: TablePlan, size: Partial<TablePlan['dimensions']>): TablePlan => ({ ...plan, dimensions: { ...plan.dimensions, ...size } })

/** A table's or desk's plan: what it is for sets its heights and parts; measures, overhang, shelf and pedestal are choices. */
const tableFields: FieldSpec<TablePlan>[] = [
  section('Qué es', [
    choice({
      key: 'use',
      label: 'Uso',
      options: optionsOf(TABLE_LABELS.use),
      get: (p) => p.use,
      // Its name follows; only a desk keeps a pedestal, and a desk has no low shelf.
      set: (p, use) => ({ ...p, use, name: TABLE_LABELS.use[use].name, shelf: use === 'desk' ? false : p.shelf, pedestal: use === 'desk' ? p.pedestal : { side: 'none', drawers: 0 } }),
    }),
  ]),
  section('Medidas', [
    numbers(3, [
      number({ key: 'dimensions.height', label: 'Alto', get: (p) => p.dimensions.height, set: (p, height) => withSize(p, { height }) }),
      number({ key: 'dimensions.width', label: 'Largo', get: (p) => p.dimensions.width, set: (p, width) => withSize(p, { width }) }),
      number({ key: 'dimensions.depth', label: 'Fondo', get: (p) => p.dimensions.depth, set: (p, depth) => withSize(p, { depth }) }),
    ]),
    numbers(2, [number({ key: 'overhang', label: 'La cubierta sobresale', min: 0, get: (p) => p.overhang, set: (p, overhang) => ({ ...p, overhang: Math.max(0, overhang) }) })]),
    material({ key: 'material', label: 'Triplay', use: 'carcass', get: (p) => p.material, set: (p, material) => ({ ...p, material }) }),
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
      set: (p, side) => ({ ...p, pedestal: { side, drawers: side === 'none' ? 0 : Math.max(1, p.pedestal.drawers) } }),
    }),
    stepper({ key: 'pedestal.drawers', label: 'Cajones', ariaLabel: 'cajones de la cajonera', min: 1, max: MAX_PEDESTAL_DRAWERS, visibleWhen: (p) => isDesk(p) && p.pedestal.side !== 'none', get: (p) => p.pedestal.drawers, set: (p, drawers) => ({ ...p, pedestal: { ...p.pedestal, drawers } }) }),
    yesNo({ key: 'shelf', label: 'Repisa baja', visibleWhen: (p) => !isDesk(p), get: (p) => p.shelf, set: (p, shelf) => ({ ...p, shelf }) }),
  ]),
]

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
}
