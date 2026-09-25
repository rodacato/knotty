import { z } from 'zod'
import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { FaceRef, Position, Design, Piece, Joint } from '../diseno/schema'
import { analyze } from '../analysis'
import { completeJoints } from '../diseno/joints'
import { materialById, type Catalog } from '../materiales/catalog'
import { applyOperations } from '../operaciones/apply'
import type { Operation } from '../operaciones/schema'
import { Column } from '../reading/reading'

// A cabinet from a plan: measures, how it is built, and a grid of columns and cells. Knotty builds every piece, so pieces cannot overlap by construction.

/** How a carpenter would build it: each option is a different way of joining the same box. */
export const CabinetConstruction = z.object({
  doors: z.enum(['overlay', 'inset']).describe('overlay: la puerta tapa el frente del mueble; inset: la puerta va embutida dentro del hueco'),
  drawerFronts: z.enum(['inset', 'overlay']).describe('inset: el frente del cajón va embutido en el hueco; overlay: el frente tapa el frente del mueble'),
  top: z.enum(['between', 'over']).describe('between: el techo va entre los laterales; over: la cubierta va encima de los laterales'),
  back: z.enum(['nailed', 'none']).describe('nailed: trasera de 6 mm clavada; none: sin trasera'),
  shelves: z.enum(['movable', 'fixed']).describe('movable: repisas sobre soportes; fixed: atornilladas'),
})
export type CabinetConstruction = z.infer<typeof CabinetConstruction>

export const DEFAULT_CONSTRUCTION: CabinetConstruction = { doors: 'overlay', drawerFronts: 'inset', top: 'between', back: 'nailed', shelves: 'movable' }

export const CabinetPlan = z.object({
  name: z.string().describe('Nombre del mueble para la persona: "Librero", "Buró con cajón"'),
  dimensions: z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() }).describe('Medidas exteriores en mm'),
  material: z.string().describe('Id del triplay del casco, normalmente "T18"'),
  base: z.enum(['kick', 'floor']).describe('kick: zoclo al frente; floor: el piso del mueble asienta directo'),
  wallMounted: z.boolean().describe('Si va anclado o colgado del muro'),
  construction: CabinetConstruction,
  columns: z.array(Column).min(1).describe('De izquierda a derecha; cada una con sus huecos de abajo hacia arriba'),
})
export type CabinetPlan = z.infer<typeof CabinetPlan>

const BACK = 'TR6'
const KICK_HEIGHT = 70
const KICK_SETBACK = 30
const GAP = 2
const SHELF_SETBACK = 5
const INSET_HINGE = 'bisagra-cazoleta-35-supercodo'
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
const shift = (cota: Position, delta: number): Position => (cota.type === 'ref' ? { ...cota, offset: cota.offset + delta } : cota.type === 'mm' ? { ...cota, mm: cota.mm + delta } : { ...cota, offset: cota.offset + delta })

export interface BuiltCabinet {
  design: Design
  /** Cells that could not be built as asked, for the person. */
  notes: string[]
}

export function buildCabinet(plan: CabinetPlan, catalog: Catalog): BuiltCabinet {
  const build = plan.construction
  const t = materialById(catalog, plan.material)?.espesor ?? 18
  const half = t / 2
  const cells = plan.columns.flatMap((c) => c.cells)
  const overlays = cells.some((c) => ((c.content === 'door' || c.content === 'closed') && build.doors === 'overlay') || (c.content === 'drawer' && build.drawerFronts === 'overlay'))
  // Overlay fronts sit in front of the carcass, so the carcass stops one thickness short of the front.
  const front: Position = overlays ? ref('mueble.z1', -t) : ref('mueble.z1')
  const backFace: FaceRef = build.back === 'nailed' ? 'trasera.z1' : 'mueble.z0'
  const depth = () => extent(ref(backFace), front)
  const panel = (p: Omit<Parameters<typeof makePiece>[0], 'material'>) => makePiece({ material: plan.material, edges: ['front'], ...p })
  const sideHeight = build.top === 'over' ? extent(ref('mueble.y0'), ref('techo.y0')) : extent(ref('mueble.y0'), ref('mueble.y1'))

  const pieces: Piece[] = []
  const joints: Joint[] = []
  if (build.back === 'nailed')
    pieces.push(makePiece({ id: 'trasera', name: 'Trasera', role: 'back', material: BACK, normal: 'z', x: extent(ref('mueble.x0'), ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: startAt(ref('mueble.z0')) }))
  pieces.push(
    panel({ id: 'lat-izq', name: 'Lateral izquierdo', role: 'side', normal: 'x', x: startAt(ref('mueble.x0')), y: sideHeight, z: depth() }),
    panel({ id: 'lat-der', name: 'Lateral derecho', role: 'side', normal: 'x', x: endAt(ref('mueble.x1')), y: sideHeight, z: depth() }),
  )
  if (plan.base === 'kick')
    pieces.push(
      makePiece({
        id: 'zoclo',
        name: 'Zoclo',
        role: 'kick',
        material: plan.material,
        normal: 'z',
        x: extent(ref('lat-izq.x1'), ref('lat-der.x0')),
        y: extent(ref('mueble.y0'), null, KICK_HEIGHT),
        z: endAt(overlays ? ref('mueble.z1', -t - KICK_SETBACK) : ref('mueble.z1', -KICK_SETBACK)),
      }),
    )
  pieces.push(
    panel({ id: 'piso', name: 'Piso', role: 'bottom', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: startAt(plan.base === 'kick' ? ref('zoclo.y1') : ref('mueble.y0')), z: depth(), load: 'medium' }),
    build.top === 'over'
      ? panel({ id: 'techo', name: 'Cubierta', role: 'top', normal: 'y', x: extent(ref('mueble.x0'), ref('mueble.x1')), y: endAt(ref('mueble.y1')), z: depth() })
      : panel({ id: 'techo', name: 'Techo', role: 'top', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: endAt(ref('mueble.y1')), z: depth() }),
  )

  const columnEdges = shares(plan.columns.map((c) => c.width))
  columnEdges.slice(0, -1).forEach((share, i) =>
    pieces.push(panel({ id: `div-${i + 1}`, name: `Divisor ${i + 1}`, role: 'divider', normal: 'x', x: startAt(partway('lat-izq.x1', 'lat-der.x0', share, -half)), y: extent(ref('piso.y1'), ref('techo.y0')), z: depth() })),
  )

  const drawers: { operation: Extract<Operation, { op: 'addDrawer' }>; overlay: { x: ReturnType<typeof extent>; y: ReturnType<typeof extent> } }[] = []
  const notes: string[] = []
  plan.columns.forEach((column, i) => {
    const n = plan.columns.length
    const col = `c${i + 1}`
    const left: FaceRef = i === 0 ? 'lat-izq.x1' : `div-${i}.x1`
    const right: FaceRef = i === n - 1 ? 'lat-der.x0' : `div-${i + 1}.x0`
    // Overlay edges: over the outer sides almost to the edge, over a divider up to its middle.
    const overLeft = i === 0 ? ref('mueble.x0', GAP) : ref(`div-${i}.x0`, half + GAP / 2)
    const overRight = i === n - 1 ? ref('mueble.x1', -GAP) : ref(`div-${i + 1}.x0`, half - GAP / 2)
    const cellTops = shares(column.cells.map((c) => c.height))
    cellTops.slice(0, -1).forEach((share, j) =>
      pieces.push(
        panel({ id: `${col}-sep-${j + 1}`, name: `Entrepaño fijo ${n > 1 ? `${i + 1}.` : ''}${j + 1}`, role: 'shelf', normal: 'y', x: extent(ref(left), ref(right)), y: startAt(partway('piso.y1', 'techo.y0', share, -half)), z: depth() }),
      ),
    )
    column.cells.forEach((cell, j) => {
      const m = column.cells.length
      const id = `${col}-h${j + 1}`
      const label = `${n > 1 ? ` de la columna ${i + 1}` : ''}${m > 1 ? ` (hueco ${j + 1})` : ''}`
      const bottom: FaceRef = j === 0 ? 'piso.y1' : `${col}-sep-${j}.y1`
      const top: FaceRef = j === m - 1 ? 'techo.y0' : `${col}-sep-${j + 1}.y0`
      const overBottom = j === 0 ? ref('piso.y0', GAP) : ref(`${col}-sep-${j}.y0`, half + GAP / 2)
      const overTop = j === m - 1 ? (build.top === 'over' ? ref('techo.y0', -GAP) : ref('mueble.y1', -GAP)) : ref(`${col}-sep-${j + 1}.y0`, half - GAP / 2)
      const overlay = { x: extent(overLeft, overRight), y: extent(overBottom, overTop) }
      const inset = { x: extent(ref(left, GAP), ref(right, -GAP)), y: extent(ref(bottom, GAP), ref(top, -GAP)) }

      const behindDoor = cell.content === 'door'
      const shelves = cell.content === 'open' || behindDoor ? (cell.shelves ?? 0) : 0
      for (let k = 1; k <= shelves; k++)
        pieces.push(
          panel({
            id: `${id}-rep-${k}`,
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
      const leaf = { material: plan.material, normal: 'z' as const, z: endAt(build.doors === 'overlay' ? ref('mueble.z1') : front), edges: front6 }
      if (cell.content === 'closed') {
        // Inset, a fixed cover fills the opening edge to edge and is screwed like any panel.
        const box = build.doors === 'overlay' ? overlay : { x: extent(ref(left), ref(right)), y: extent(ref(bottom), ref(top)) }
        pieces.push(makePiece({ ...leaf, id: `${id}-tapa`, name: `Tapa${label}`, role: 'other', ...box }))
      }
      if (cell.content === 'door') {
        const box = build.doors === 'overlay' ? overlay : inset
        const leaves = Math.min(cell.doors ?? 1, 2)
        const [x0, x1] = [box.x.from!, box.x.to!]
        const doors =
          leaves === 1
            ? [{ id: `${id}-puerta`, name: `Puerta${label}`, x: extent(x0, x1), hinge: left }]
            : [
                { id: `${id}-puerta-izq`, name: `Puerta izquierda${label}`, x: extent(x0, partway(left, right, 0.5, -GAP / 2)), hinge: left },
                { id: `${id}-puerta-der`, name: `Puerta derecha${label}`, x: extent(partway(left, right, 0.5, GAP / 2), x1), hinge: right },
              ]
        for (const d of doors) {
          pieces.push(makePiece({ ...leaf, id: d.id, name: d.name, role: 'door', x: d.x, y: box.y }))
          // An inset door touches nothing: its hinge is declared, not found by contact.
          if (build.doors === 'inset') joints.push(makeJoint(`u-${d.id}`, d.id, pieceOf(d.hinge), 'cup-hinge', [{ hardwareId: INSET_HINGE, count: null }]))
        }
      }
      if (cell.content === 'drawer') {
        const k = drawers.length + 1
        drawers.push({
          operation: { op: 'addDrawer', group: `cajon-${k}`, name: `Cajón ${k}`, left: left, right: right, bottom: bottom, top: top, front: 'lat-izq.z1', back: backFace, material: plan.material, bottomMaterial: BACK },
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
      const frontId = `${drawer.operation.group}-frente`
      design = { ...design, pieces: design.pieces.map((p) => (p.id === frontId ? { ...p, x: drawer.overlay.x, y: drawer.overlay.y, z: endAt(ref('mueble.z1')) } : p)) }
    }
  }
  // What a carpenter adds without being asked, each kept only if the design still holds with it:
  // on a kick, the floor rests on a support under each divider; hung on the wall, a rail at the top and back takes the screws.
  const extras: Operation[] = []
  if (plan.base === 'kick')
    columnEdges.slice(0, -1).forEach((_, i) =>
      extras.push({ op: 'addPiece', piece: panel({ id: `apoyo-piso-${i + 1}`, name: `Apoyo del piso ${i + 1}`, role: 'divider', normal: 'x', x: startAt(ref(`div-${i + 1}.x0`)), y: extent(ref('mueble.y0'), ref('piso.y0')), z: extent(ref(backFace), ref('zoclo.z0')) }) }),
    )
  if (plan.wallMounted && plan.base === 'floor')
    extras.push({ op: 'addPiece', piece: panel({ id: 'liston-colgar', name: 'Listón de colgar', role: 'brace', normal: 'z', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: extent(null, ref('techo.y0'), HANGING_RAIL), z: startAt(ref(backFace)) }) })
  for (const extra of extras) {
    const result = applyOperations(design, [extra], catalog)
    if (result.ok && analyze(completeJoints(result.value.design, catalog), catalog).valid) design = result.value.design
  }
  return { design: completeJoints(design, catalog), notes }
}
