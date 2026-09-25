import { z } from 'zod'
import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../design/builders'
import type { FaceRef, Design, Piece, Joint } from '../design/schema'
import { completeJoints } from '../design/joints'
import { materialById, type Catalog } from '../materials/catalog'
import { pocketScrewId } from '../structure/assumptions'
import { applyOperations } from '../operations/apply'
import type { Operation } from '../operations/schema'

// A table or a desk from its ficha: a top on two panel ends, tied by aprons, with cleats under the top and, on a desk, a drawer pedestal.

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
    drawers: z.number().int().min(0).max(4).describe('How many drawers the pedestal has; 0 if there is none'),
  }),
})
export type TablePlan = z.infer<typeof TablePlan>

/** What each use is called: the name is also how the checks by kind of furniture recognize it. */
export const TABLE_NAMES: Record<TablePlan['use'], string> = { dining: 'Mesa de comedor', coffee: 'Mesa de centro', side: 'Mesa lateral', desk: 'Escritorio' }

const APRON = 80
/** On a desk the back apron runs lower: it braces the ends and hides the legs from the front. */
const MODESTY = 300
/** The top is carried at least this often: cleats between the aprons where the ends are far apart. */
const MAX_SPAN = 600
const SHELF_HEIGHT = 120
const PEDESTAL = 420
const KICK = 70
const KICK_SETBACK = 30
/** Past this inset the ends would stand under the middle of the top, not at its sides. */
const MAX_END_INSET = 50

const LOAD: Record<TablePlan['use'], Piece['load']> = { dining: 'medium', coffee: 'light', side: 'light', desk: 'medium' }

export function buildTable(plan: TablePlan, catalog: Catalog): { design: Design; notes: string[] } {
  const t = materialById(catalog, plan.material)?.thickness ?? 18
  const { width, height, depth } = plan.dimensions
  const panel = (p: Omit<Parameters<typeof makePiece>[0], 'material'>) => makePiece({ material: plan.material, edges: ['front'], ...p })
  const pieces: Piece[] = []
  const joints: Joint[] = []
  const notes: string[] = []
  const desk = plan.use === 'desk'
  const inset = Math.min(plan.overhang, MAX_END_INSET)
  const endsZ = extent(ref('furniture.z0', desk ? 0 : inset), ref('furniture.z1', -inset))
  const pedestal = desk && plan.pedestal.side !== 'none' && plan.pedestal.drawers > 0 ? plan.pedestal.side : null
  let drawers: Operation[] = []

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
      panel({ id: 'ped-kick', name: 'Zoclo de la cajonera', role: 'kick', normal: 'z', x: between, y: extent(ref('furniture.y0'), null, KICK), z: endAt(ref(`${outer}.z1`, -KICK_SETBACK)) }),
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
      bottomMaterial: 'TR6',
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
  const cleats = Math.ceil(openWidth / (MAX_SPAN + t)) - 1
  for (let k = 1; k <= cleats; k++)
    pieces.push(panel({ id: `rail-${k}`, name: `Travesaño ${k}`, role: 'divider', normal: 'x', x: startAt(partway(openLeft, openRight, k / (cleats + 1), -t / 2)), y: extent(ref('apron-front.y0'), ref('top.y0')), z: extent(ref('apron-back.z1'), ref('apron-front.z0')) }))

  if (plan.shelf && !desk) {
    pieces.push(panel({ id: 'low-shelf', name: 'Repisa baja', role: 'shelf', normal: 'y', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: startAt(ref('furniture.y0', SHELF_HEIGHT)), z: endsZ, load: 'light' }))
    // The shelf sits close to the floor: short feet under it are simpler than anything above.
    const feet = Math.ceil((width - 2 * plan.overhang - 2 * t) / (MAX_SPAN + t)) - 1
    for (let k = 1; k <= feet; k++)
      pieces.push(panel({ id: `shelf-leg-${k}`, name: `Apoyo ${k} de la repisa`, role: 'divider', normal: 'x', x: startAt(partway('side-left.x1', 'side-right.x0', k / (feet + 1), -t / 2)), y: extent(ref('furniture.y0'), ref('low-shelf.y0')), z: endsZ }))
  }
  if (plan.shelf && desk) notes.push('Un escritorio no lleva repisa baja: estorba las piernas.')

  let design: Design = { schema: 1, name: plan.name, dimensions: { width: width, height: height, depth: depth }, wallAnchored: false, notes: '', pieces: pieces, joints: joints }
  for (const drawer of drawers) {
    const result = applyOperations(design, [drawer], catalog)
    if (!result.ok) {
      notes.push(`${drawer.op === 'addDrawer' ? drawer.name : 'Un cajón'}: ${result.errors[0]?.message ?? 'no cupo'} Lo dejé como hueco abierto.`)
      continue
    }
    design = result.value.design
  }
  return { design: completeJoints(design, catalog), notes }
}
