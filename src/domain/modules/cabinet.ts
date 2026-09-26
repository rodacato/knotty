import { z } from 'zod'
import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../design/builders'
import { DIMENSION_OF_AXIS, type FaceRef, type Position, type Design, type Piece, type Joint } from '../design/schema'
import { analyze } from '../analysis'
import { completeJoints } from '../design/joints'
import { backBoard, type Catalog } from '../materials/catalog'
import { applyOperations } from '../operations/apply'
import type { Operation } from '../operations/schema'
import { Column, type Cell } from '../reading/reading'
import { addDrawers, KICK_HEIGHT, KICK_SETBACK, lower, measuresSummary, panelOf, thicknessOf, type AddDrawer } from './common'
import { choice, custom, material, number, numbers, optionsOf, section, yesNo, type FieldSpec } from './fields'
import type { FurnitureModule, Labels } from './module'

// A cabinet from a plan: measures, how it is built, and a grid of columns and cells. Knotty builds every piece, so pieces cannot overlap by construction.

/** How a carpenter would build it: each option is a different way of joining the same box. */
export const CabinetConstruction = z.object({
  doors: z.enum(['overlay', 'inset']).describe('overlay: the door covers the front of the furniture; inset: the door sits inside the opening'),
  drawerFronts: z.enum(['inset', 'overlay']).describe('inset: the drawer front sits inside the opening; overlay: the front covers the front of the furniture'),
  top: z.enum(['between', 'over']).describe('between: the top goes between the sides; over: the top sits on the sides'),
  back: z.enum(['nailed', 'none']).describe('nailed: 6 mm back nailed on; none: no back'),
  shelves: z.enum(['movable', 'fixed']).describe('movable: shelves on pins; fixed: screwed'),
})
export type CabinetConstruction = z.infer<typeof CabinetConstruction>

export const DEFAULT_CONSTRUCTION: CabinetConstruction = { doors: 'overlay', drawerFronts: 'inset', top: 'between', back: 'nailed', shelves: 'movable' }

export const CabinetPlan = z.object({
  kind: z.literal('cabinet'),
  name: z.string().describe('Name of the furniture for the person, in Spanish: "Librero", "Buró con cajón"'),
  dimensions: z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() }).describe('Outside measures in mm'),
  material: z.string().describe('Plywood id for the carcass, usually "T18"'),
  base: z.enum(['kick', 'floor']).describe('kick: kick plate at the front; floor: the bottom of the furniture sits directly on the floor'),
  wallMounted: z.boolean().describe('Whether it is anchored to or hung from the wall'),
  construction: CabinetConstruction,
  columns: z.array(Column).min(1).describe('Left to right; each one with its openings from bottom to top'),
})
export type CabinetPlan = z.infer<typeof CabinetPlan>

/** The words for each choice of a cabinet's plan, capitalized as on the form; inside a sentence they go in lowercase. */
export const CABINET_LABELS = {
  base: { kick: { option: 'Con zoclo', phrase: 'con zoclo' }, floor: { option: 'Directa', phrase: 'sin zoclo' } } satisfies Labels<CabinetPlan['base']>,
  cell: { open: 'Abierto', drawer: 'Cajón', door: 'Puerta', closed: 'Tapado' } satisfies Record<Cell['content'], string>,
  construction: {
    doors: { label: 'Puertas', options: { overlay: 'Sobrepuestas', inset: 'Embutidas' } },
    drawerFronts: { label: 'Frentes de cajón', options: { inset: 'Embutidos', overlay: 'Sobrepuestos' } },
    top: { label: 'Techo', options: { between: 'Entre laterales', over: 'Cubierta encima' } },
    back: { label: 'Trasera', options: { nailed: 'Clavada', none: 'Sin trasera' } },
    shelves: { label: 'Repisas', options: { movable: 'Móviles', fixed: 'Fijas' } },
  } satisfies { [K in keyof CabinetConstruction]: { label: string; options: Record<CabinetConstruction[K], string> } },
}

const GAP = 2
const SHELF_SETBACK = 5
const INSET_HINGE = 'cup-hinge-35-inset'
/** The rail a wall cabinet hangs from: the screws into the wall go through it, not through the thin back. */
const HANGING_RAIL = 80

/** Fractions as given may not add up to 1; they are scaled so they do. */
const shares = (values: number[]) => {
  const total = values.reduce((s, v) => s + v, 0) || 1
  let sum = 0
  return values.map((v) => (sum += v / total))
}

const pieceOf = (face: FaceRef) => face.split('.')[0]
/** The same reference, moved along its axis. */
const shift = (position: Position, delta: number): Position => (position.type === 'ref' ? { ...position, offset: position.offset + delta } : position.type === 'mm' ? { ...position, mm: position.mm + delta } : { ...position, offset: position.offset + delta })

interface BuiltCabinet {
  design: Design
  /** Cells that could not be built as asked, for the person. */
  notes: string[]
}

export function buildCabinet(plan: CabinetPlan, catalog: Catalog): BuiltCabinet {
  const build = plan.construction
  const t = thicknessOf(catalog, plan.material)
  const half = t / 2
  const cells = plan.columns.flatMap((c) => c.cells)
  const overlays = cells.some((c) => ((c.content === 'door' || c.content === 'closed') && build.doors === 'overlay') || (c.content === 'drawer' && build.drawerFronts === 'overlay'))
  // Overlay fronts sit in front of the carcass, so the carcass stops one thickness short of the front.
  const front: Position = overlays ? ref('furniture.z1', -t) : ref('furniture.z1')
  const backFace: FaceRef = build.back === 'nailed' ? 'back.z1' : 'furniture.z0'
  const depth = () => extent(ref(backFace), front)
  const panel = panelOf(plan.material)
  const sideHeight = build.top === 'over' ? extent(ref('furniture.y0'), ref('top.y0')) : extent(ref('furniture.y0'), ref('furniture.y1'))

  const pieces: Piece[] = []
  const joints: Joint[] = []
  if (build.back === 'nailed')
    pieces.push(makePiece({ id: 'back', name: 'Trasera', role: 'back', material: backBoard(catalog).id, normal: 'z', x: extent(ref('furniture.x0'), ref('furniture.x1')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: startAt(ref('furniture.z0')) }))
  pieces.push(
    panel({ id: 'side-left', name: 'Lateral izquierdo', role: 'side', normal: 'x', x: startAt(ref('furniture.x0')), y: sideHeight, z: depth() }),
    panel({ id: 'side-right', name: 'Lateral derecho', role: 'side', normal: 'x', x: endAt(ref('furniture.x1')), y: sideHeight, z: depth() }),
  )
  if (plan.base === 'kick')
    pieces.push(
      makePiece({
        id: 'kick',
        name: 'Zoclo',
        role: 'kick',
        material: plan.material,
        normal: 'z',
        x: extent(ref('side-left.x1'), ref('side-right.x0')),
        y: extent(ref('furniture.y0'), null, KICK_HEIGHT.cabinet),
        z: endAt(overlays ? ref('furniture.z1', -t - KICK_SETBACK) : ref('furniture.z1', -KICK_SETBACK)),
      }),
    )
  pieces.push(
    panel({ id: 'bottom', name: 'Piso', role: 'bottom', normal: 'y', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: startAt(plan.base === 'kick' ? ref('kick.y1') : ref('furniture.y0')), z: depth(), load: 'medium' }),
    build.top === 'over'
      ? panel({ id: 'top', name: 'Cubierta', role: 'top', normal: 'y', x: extent(ref('furniture.x0'), ref('furniture.x1')), y: endAt(ref('furniture.y1')), z: depth() })
      : panel({ id: 'top', name: 'Techo', role: 'top', normal: 'y', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: endAt(ref('furniture.y1')), z: depth() }),
  )

  const columnEdges = shares(plan.columns.map((c) => c.width))
  columnEdges.slice(0, -1).forEach((share, i) =>
    pieces.push(panel({ id: `div-${i + 1}`, name: `Divisor ${i + 1}`, role: 'divider', normal: 'x', x: startAt(partway('side-left.x1', 'side-right.x0', share, -half)), y: extent(ref('bottom.y1'), ref('top.y0')), z: depth() })),
  )

  const drawers: { operation: AddDrawer; overlay: { x: ReturnType<typeof extent>; y: ReturnType<typeof extent> } }[] = []
  plan.columns.forEach((column, i) => {
    const n = plan.columns.length
    const col = `c${i + 1}`
    const left: FaceRef = i === 0 ? 'side-left.x1' : `div-${i}.x1`
    const right: FaceRef = i === n - 1 ? 'side-right.x0' : `div-${i + 1}.x0`
    // Overlay edges: over the outer sides almost to the edge, over a divider up to its middle.
    const overLeft = i === 0 ? ref('furniture.x0', GAP) : ref(`div-${i}.x0`, half + GAP / 2)
    const overRight = i === n - 1 ? ref('furniture.x1', -GAP) : ref(`div-${i + 1}.x0`, half - GAP / 2)
    const cellTops = shares(column.cells.map((c) => c.height))
    cellTops.slice(0, -1).forEach((share, j) =>
      pieces.push(
        panel({ id: `${col}-sep-${j + 1}`, name: `Entrepaño fijo ${n > 1 ? `${i + 1}.` : ''}${j + 1}`, role: 'shelf', normal: 'y', x: extent(ref(left), ref(right)), y: startAt(partway('bottom.y1', 'top.y0', share, -half)), z: depth() }),
      ),
    )
    column.cells.forEach((cell, j) => {
      const m = column.cells.length
      const id = `${col}-h${j + 1}`
      const label = `${n > 1 ? ` de la columna ${i + 1}` : ''}${m > 1 ? ` (hueco ${j + 1})` : ''}`
      const bottom: FaceRef = j === 0 ? 'bottom.y1' : `${col}-sep-${j}.y1`
      const top: FaceRef = j === m - 1 ? 'top.y0' : `${col}-sep-${j + 1}.y0`
      const overBottom = j === 0 ? ref('bottom.y0', GAP) : ref(`${col}-sep-${j}.y0`, half + GAP / 2)
      const overTop = j === m - 1 ? (build.top === 'over' ? ref('top.y0', -GAP) : ref('furniture.y1', -GAP)) : ref(`${col}-sep-${j + 1}.y0`, half - GAP / 2)
      const overlay = { x: extent(overLeft, overRight), y: extent(overBottom, overTop) }
      const inset = { x: extent(ref(left, GAP), ref(right, -GAP)), y: extent(ref(bottom, GAP), ref(top, -GAP)) }

      const behindDoor = cell.content === 'door'
      const shelves = cell.content === 'open' || behindDoor ? (cell.shelves ?? 0) : 0
      for (let k = 1; k <= shelves; k++)
        pieces.push(
          panel({
            id: `${id}-shelf-${k}`,
            name: `Repisa ${k}${label}`,
            role: 'shelf',
            normal: 'y',
            x: extent(ref(left), ref(right)),
            y: startAt(partway(bottom, top, k / (shelves + 1), -half)),
            // Behind a door the shelf stops short of it: an overlay door is in front of the carcass, an inset one inside it.
            z: extent(ref(backFace), behindDoor ? shift(front, (build.doors === 'inset' ? -t : 0) - SHELF_SETBACK) : front),
            load: 'medium',
            support: build.shelves === 'movable' ? 'movable' : 'fixed',
          }),
        )

      const front6 = ['front', 'back', 'left', 'right', 'top', 'bottom'] as Piece['edges']
      // Overlay leaves close the front of the piece; inset ones sit flush with the carcass, wherever overlay drawer fronts put it.
      const leaf = { material: plan.material, normal: 'z' as const, z: endAt(build.doors === 'overlay' ? ref('furniture.z1') : front), edges: front6 }
      if (cell.content === 'closed') {
        // Inset, a fixed cover fills the opening edge to edge and is screwed like any panel.
        const box = build.doors === 'overlay' ? overlay : { x: extent(ref(left), ref(right)), y: extent(ref(bottom), ref(top)) }
        pieces.push(makePiece({ ...leaf, id: `${id}-cover`, name: `Tapa${label}`, role: 'other', ...box }))
      }
      if (cell.content === 'door') {
        const box = build.doors === 'overlay' ? overlay : inset
        const leaves = Math.min(cell.doors ?? 1, 2)
        const [x0, x1] = [box.x.from!, box.x.to!]
        const doors =
          leaves === 1
            ? [{ id: `${id}-door`, name: `Puerta${label}`, x: extent(x0, x1), hinge: left }]
            : [
                { id: `${id}-door-left`, name: `Puerta izquierda${label}`, x: extent(x0, partway(left, right, 0.5, -GAP / 2)), hinge: left },
                { id: `${id}-door-right`, name: `Puerta derecha${label}`, x: extent(partway(left, right, 0.5, GAP / 2), x1), hinge: right },
              ]
        for (const d of doors) {
          pieces.push(makePiece({ ...leaf, id: d.id, name: d.name, role: 'door', x: d.x, y: box.y }))
          // An inset door touches nothing: its hinge is declared, not found by contact.
          if (build.doors === 'inset') joints.push(makeJoint(`j-${d.id}`, d.id, pieceOf(d.hinge), 'cup-hinge', [{ hardwareId: INSET_HINGE, count: null }]))
        }
      }
      if (cell.content === 'drawer') {
        const k = drawers.length + 1
        drawers.push({
          operation: { op: 'addDrawer', group: `drawer-${k}`, name: `Cajón ${k}`, left: left, right: right, bottom: bottom, top: top, front: 'side-left.z1', back: backFace, material: plan.material, bottomMaterial: backBoard(catalog).id },
          overlay,
        })
      }
    })
  })

  // A cabinet's plan does not say whether it is a bookcase or a wardrobe: its design has no `kind` and the checks by use read its name.
  let design: Design = {
    schema: 1,
    name: plan.name,
    dimensions: { width: plan.dimensions.width, height: plan.dimensions.height, depth: plan.dimensions.depth },
    wallAnchored: plan.wallMounted,
    notes: '',
    pieces: pieces,
    joints: joints,
  }
  const overlayOf = new Map(drawers.map((d) => [d.operation.group, d.overlay]))
  // An overlay front is the inset one grown over the edges and brought forward; the box follows it.
  const withFronts = (built: Design, drawer: AddDrawer): Design => {
    const overlay = overlayOf.get(drawer.group)
    if (build.drawerFronts !== 'overlay' || !overlay) return built
    const frontId = `${drawer.group}-front`
    return { ...built, pieces: built.pieces.map((p) => (p.id === frontId ? { ...p, x: overlay.x, y: overlay.y, z: endAt(ref('furniture.z1')) } : p)) }
  }
  const placed = addDrawers(design, drawers.map((d) => d.operation), catalog, withFronts)
  design = placed.design
  const notes = placed.notes
  // What a carpenter adds without being asked, each kept only if the design still holds with it:
  // on a kick, the floor rests on a support under each divider; hung on the wall, a rail at the top and back takes the screws.
  const extras: Operation[] = []
  if (plan.base === 'kick')
    columnEdges.slice(0, -1).forEach((_, i) =>
      extras.push({ op: 'addPiece', piece: panel({ id: `bottom-support-${i + 1}`, name: `Apoyo del piso ${i + 1}`, role: 'divider', normal: 'x', x: startAt(ref(`div-${i + 1}.x0`)), y: extent(ref('furniture.y0'), ref('bottom.y0')), z: extent(ref(backFace), ref('kick.z0')) }) }),
    )
  if (plan.wallMounted && plan.base === 'floor')
    extras.push({ op: 'addPiece', piece: panel({ id: 'hanging-rail', name: 'Listón de colgar', role: 'brace', normal: 'z', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: extent(null, ref('top.y0'), HANGING_RAIL), z: startAt(ref(backFace)) }) })
  for (const extra of extras) {
    const result = applyOperations(design, [extra], catalog)
    if (result.ok && analyze(completeJoints(result.value.design, catalog), catalog).valid) design = result.value.design
  }
  return { design: completeJoints(design, catalog), notes }
}

const count = (plan: CabinetPlan, content: Cell['content']) => plan.columns.flatMap((c) => c.cells).filter((c) => c.content === content).length
const layout = (plan: CabinetPlan) => JSON.stringify(plan.columns)

function describeCabinetChanges(before: CabinetPlan, after: CabinetPlan): string[] {
  const changes: string[] = []
  const a = before.dimensions
  const b = after.dimensions
  if (a.height !== b.height || a.width !== b.width || a.depth !== b.depth) changes.push(`medidas ${b.height} × ${b.width} × ${b.depth} mm`)
  if (before.material !== after.material) changes.push(`material ${after.material}`)
  if (before.base !== after.base) changes.push(CABINET_LABELS.base[after.base].phrase)
  if (before.wallMounted !== after.wallMounted) changes.push(after.wallMounted ? 'anclado al muro' : 'sin anclar')
  for (const key of Object.keys(CABINET_LABELS.construction) as (keyof CabinetConstruction)[]) {
    if (before.construction[key] === after.construction[key]) continue
    const { label, options } = CABINET_LABELS.construction[key] as { label: string; options: Record<string, string> }
    changes.push(`${lower(label)} ${lower(options[after.construction[key]])}`)
  }
  if (before.columns.length !== after.columns.length) changes.push(`${after.columns.length} ${after.columns.length === 1 ? 'columna' : 'columnas'}`)
  for (const content of Object.keys(CABINET_LABELS.cell) as Cell['content'][]) {
    const [was, is] = [count(before, content), count(after, content)]
    if (was !== is) changes.push(`${is} ${content === 'drawer' ? (is === 1 ? 'cajón' : 'cajones') : `${is === 1 ? 'hueco' : 'huecos'} ${lower(CABINET_LABELS.cell[content])}${is === 1 ? '' : 's'}`}`)
  }
  if (!changes.length && layout(before) !== layout(after)) changes.push('distribución de los huecos')
  return changes
}

function benchCabinets(): [string, CabinetPlan][] {
  const cell = (content: Cell['content'], height = 1, shelves: number | null = null, doors: number | null = null): Cell => ({ height, content, shelves, doors })
  const cabinet = (name: string, dimensions: CabinetPlan['dimensions'], columns: CabinetPlan['columns'], extra: Partial<CabinetPlan> = {}): CabinetPlan => ({ kind: 'cabinet', name, dimensions, material: 'T18', base: 'kick', wallMounted: true, construction: DEFAULT_CONSTRUCTION, columns, ...extra })
  return [
    ['librero', cabinet('Librero', { width: 600, height: 1800, depth: 300 }, [{ width: 1, cells: [cell('open', 1, 4)] }])],
    ['buró', cabinet('Buró', { width: 450, height: 550, depth: 400 }, [{ width: 1, cells: [cell('open', 0.6, 0), cell('drawer', 0.4)] }], { base: 'floor', wallMounted: false })],
    ['alacena', cabinet('Alacena', { width: 600, height: 720, depth: 320 }, [{ width: 1, cells: [cell('door', 1, 1, 2)] }], { base: 'floor' })],
    ['cajonera', cabinet('Cajonera', { width: 500, height: 900, depth: 450 }, [{ width: 1, cells: [cell('drawer'), cell('drawer'), cell('drawer')] }])],
    ['mueble de TV', cabinet('Mueble de TV', { width: 1600, height: 500, depth: 400 }, [{ width: 0.3, cells: [cell('door', 1, 0, 1)] }, { width: 0.4, cells: [cell('open', 1, 1)] }, { width: 0.3, cells: [cell('door', 1, 0, 1)] }], { wallMounted: false })],
  ]
}

const withSize = (plan: CabinetPlan, size: Partial<CabinetPlan['dimensions']>): CabinetPlan => ({ ...plan, dimensions: { ...plan.dimensions, ...size } })

/** One choice per way of building it, in the order of its labels. */
const constructionFields = (Object.keys(CABINET_LABELS.construction) as (keyof CabinetConstruction)[]).map((key) =>
  choice<CabinetPlan, string>({
    key: `construction.${key}`,
    label: CABINET_LABELS.construction[key].label,
    options: optionsOf(CABINET_LABELS.construction[key].options),
    get: (p) => p.construction[key],
    set: (p, value) => ({ ...p, construction: { ...p.construction, [key]: value } }),
  }),
)

/** A cabinet's plan: its measures, how it is built and its grid of columns and cells, which has a component of its own. */
const cabinetFields: FieldSpec<CabinetPlan>[] = [
  section('Medidas', [
    numbers(3, [
      number({ key: 'dimensions.height', label: 'Alto', get: (p) => p.dimensions.height, set: (p, height) => withSize(p, { height }) }),
      number({ key: 'dimensions.width', label: 'Ancho', get: (p) => p.dimensions.width, set: (p, width) => withSize(p, { width }) }),
      number({ key: 'dimensions.depth', label: 'Fondo', get: (p) => p.dimensions.depth, set: (p, depth) => withSize(p, { depth }) }),
    ]),
  ]),
  section('Cómo se arma', [
    material({ key: 'material', label: 'Triplay', use: 'carcass', get: (p) => p.material, set: (p, material) => ({ ...p, material }) }),
    choice({ key: 'base', label: 'Base', options: optionsOf(CABINET_LABELS.base), get: (p) => p.base, set: (p, base) => ({ ...p, base }) }),
    yesNo({ key: 'wallMounted', label: 'Anclado al muro', get: (p) => p.wallMounted, set: (p, wallMounted) => ({ ...p, wallMounted }) }),
    ...constructionFields,
  ]),
  custom({ key: 'columns', component: 'cabinetColumns', label: 'Columnas y huecos', get: (p) => p.columns, set: (p, columns) => ({ ...p, columns }) }),
]

export const cabinetModule: FurnitureModule<CabinetPlan> = {
  kind: 'cabinet',
  schema: CabinetPlan,
  label: 'un gabinete',
  expert: { what: 'a cabinet (a box with columns and openings)' },
  build: buildCabinet,
  describeChanges: describeCabinetChanges,
  resize: (plan, axis, value) => ({ ok: true, plan: { ...plan, dimensions: { ...plan.dimensions, [DIMENSION_OF_AXIS[axis]]: value } } }),
  withMeasures: (plan, { width, height, depth }) => ({ ...plan, dimensions: { width, height, depth } }),
  summary: (_, dimensions) => measuresSummary(dimensions),
  measuresNote: () => null,
  traceLabel: (plan) => `Gabinete de ${plan.columns.length} ${plan.columns.length === 1 ? 'columna' : 'columnas'}`,
  benchVariants: benchCabinets,
  fields: cabinetFields,
}
