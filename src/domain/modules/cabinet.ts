import { z } from 'zod'
import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../design/builders'
import type { FaceRef, Position, Design, Piece, Joint } from '../design/schema'
import { analyze } from '../analysis'
import { completeJoints } from '../design/joints'
import { materialById, type Catalog } from '../materials/catalog'
import { applyOperations } from '../operations/apply'
import type { Operation } from '../operations/schema'
import { Column } from '../reading/reading'

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
  name: z.string().describe('Name of the furniture for the person, in Spanish: "Librero", "Buró con cajón"'),
  dimensions: z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() }).describe('Outside measures in mm'),
  material: z.string().describe('Plywood id for the carcass, usually "T18"'),
  base: z.enum(['kick', 'floor']).describe('kick: kick plate at the front; floor: the bottom of the furniture sits directly on the floor'),
  wallMounted: z.boolean().describe('Whether it is anchored to or hung from the wall'),
  construction: CabinetConstruction,
  columns: z.array(Column).min(1).describe('Left to right; each one with its openings from bottom to top'),
})
export type CabinetPlan = z.infer<typeof CabinetPlan>

const BACK = 'TR6'
const KICK_HEIGHT = 70
const KICK_SETBACK = 30
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

export interface BuiltCabinet {
  design: Design
  /** Cells that could not be built as asked, for the person. */
  notes: string[]
}

export function buildCabinet(plan: CabinetPlan, catalog: Catalog): BuiltCabinet {
  const build = plan.construction
  const t = materialById(catalog, plan.material)?.thickness ?? 18
  const half = t / 2
  const cells = plan.columns.flatMap((c) => c.cells)
  const overlays = cells.some((c) => ((c.content === 'door' || c.content === 'closed') && build.doors === 'overlay') || (c.content === 'drawer' && build.drawerFronts === 'overlay'))
  // Overlay fronts sit in front of the carcass, so the carcass stops one thickness short of the front.
  const front: Position = overlays ? ref('furniture.z1', -t) : ref('furniture.z1')
  const backFace: FaceRef = build.back === 'nailed' ? 'back.z1' : 'furniture.z0'
  const depth = () => extent(ref(backFace), front)
  const panel = (p: Omit<Parameters<typeof makePiece>[0], 'material'>) => makePiece({ material: plan.material, edges: ['front'], ...p })
  const sideHeight = build.top === 'over' ? extent(ref('furniture.y0'), ref('top.y0')) : extent(ref('furniture.y0'), ref('furniture.y1'))

  const pieces: Piece[] = []
  const joints: Joint[] = []
  if (build.back === 'nailed')
    pieces.push(makePiece({ id: 'back', name: 'Trasera', role: 'back', material: BACK, normal: 'z', x: extent(ref('furniture.x0'), ref('furniture.x1')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: startAt(ref('furniture.z0')) }))
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
        y: extent(ref('furniture.y0'), null, KICK_HEIGHT),
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

  const drawers: { operation: Extract<Operation, { op: 'addDrawer' }>; overlay: { x: ReturnType<typeof extent>; y: ReturnType<typeof extent> } }[] = []
  const notes: string[] = []
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
          operation: { op: 'addDrawer', group: `drawer-${k}`, name: `Cajón ${k}`, left: left, right: right, bottom: bottom, top: top, front: 'side-left.z1', back: backFace, material: plan.material, bottomMaterial: BACK },
          overlay,
        })
      }
    })
  })

  let design: Design = {
    schema: 1,
    name: plan.name,
    dimensions: { width: plan.dimensions.width, height: plan.dimensions.height, depth: plan.dimensions.depth },
    wallAnchored: plan.wallMounted,
    notes: '',
    pieces: pieces,
    joints: joints,
  }
  // Drawers go one by one: one that does not fit leaves its cell open instead of failing the whole cabinet.
  for (const drawer of drawers) {
    const result = applyOperations(design, [drawer.operation], catalog)
    if (!result.ok) {
      notes.push(`${drawer.operation.name}: ${result.errors[0]?.message ?? 'no cupo'} Lo dejé como hueco abierto.`)
      continue
    }
    design = result.value.design
    // An overlay front is the inset one grown over the edges and brought forward; the box follows it.
    if (build.drawerFronts === 'overlay') {
      const frontId = `${drawer.operation.group}-front`
      design = { ...design, pieces: design.pieces.map((p) => (p.id === frontId ? { ...p, x: drawer.overlay.x, y: drawer.overlay.y, z: endAt(ref('furniture.z1')) } : p)) }
    }
  }
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
