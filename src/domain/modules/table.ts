import { z } from 'zod'
import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { FaceRef, Design, Piece, Joint } from '../diseno/schema'
import { completeJoints } from '../diseno/joints'
import { materialById, type Catalog } from '../materiales/catalog'
import { applyOperations } from '../operaciones/apply'
import type { Operation } from '../operaciones/schema'

// A table or a desk from its ficha: a top on two panel ends, tied by aprons, with cleats under the top and, on a desk, a drawer pedestal.

export const TablePlan = z.object({
  kind: z.literal('table'),
  use: z.enum(['dining', 'coffee', 'side', 'desk']).describe('dining: comedor; coffee: de centro; side: lateral o de noche; desk: escritorio'),
  name: z.string().describe('Nombre del mueble para la persona: "Escritorio con cajonera", "Mesa de centro"'),
  material: z.string().describe('Id del triplay, normalmente "T18"'),
  dimensions: z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() }).describe('Largo (ancho), alto y fondo exteriores en mm'),
  overhang: z.number().nonnegative().describe('Cuánto sobresale la cubierta de los costados, en mm; 0 si los costados llegan a la orilla'),
  shelf: z.boolean().describe('Repisa baja entre los costados (mesas de centro y laterales); un escritorio no la lleva, estorba las piernas'),
  pedestal: z.object({
    side: z.enum(['none', 'left', 'right']).describe('De qué lado va la cajonera, viendo el escritorio de frente'),
    drawers: z.number().int().min(0).max(4).describe('Cuántos cajones lleva la cajonera; 0 si no hay'),
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
  const t = materialById(catalog, plan.material)?.espesor ?? 18
  const { width, height, depth } = plan.dimensions
  const panel = (p: Omit<Parameters<typeof makePiece>[0], 'material'>) => makePiece({ material: plan.material, edges: ['front'], ...p })
  const pieces: Piece[] = []
  const joints: Joint[] = []
  const notes: string[] = []
  const desk = plan.use === 'desk'
  const inset = Math.min(plan.overhang, MAX_END_INSET)
  const endsZ = extent(ref('mueble.z0', desk ? 0 : inset), ref('mueble.z1', -inset))
  const pedestal = desk && plan.pedestal.side !== 'none' && plan.pedestal.drawers > 0 ? plan.pedestal.side : null
  let drawers: Operation[] = []

  pieces.push(
    panel({ id: 'cubierta', name: 'Cubierta', role: 'top', normal: 'y', x: extent(ref('mueble.x0'), ref('mueble.x1')), y: endAt(ref('mueble.y1')), z: extent(ref('mueble.z0'), ref('mueble.z1')), load: LOAD[plan.use], edges: ['front', 'back', 'left', 'right'] }),
    panel({ id: 'lat-izq', name: 'Costado izquierdo', role: 'side', normal: 'x', x: startAt(ref('mueble.x0', plan.overhang)), y: extent(ref('mueble.y0'), ref('cubierta.y0')), z: endsZ }),
    panel({ id: 'lat-der', name: 'Costado derecho', role: 'side', normal: 'x', x: endAt(ref('mueble.x1', -plan.overhang)), y: extent(ref('mueble.y0'), ref('cubierta.y0')), z: endsZ }),
  )

  // The open part between the ends, or between the pedestal and the far end.
  let openLeft: FaceRef = 'lat-izq.x1'
  let openRight: FaceRef = 'lat-der.x0'
  if (pedestal) {
    const outer = pedestal === 'left' ? 'lat-izq' : 'lat-der'
    const between = pedestal === 'left' ? extent(ref('lat-izq.x1'), ref('ped-div.x0')) : extent(ref('ped-div.x1'), ref('lat-der.x0'))
    const zBox = extent(ref('ped-fondo.z1'), ref(`${outer}.z1`))
    pieces.push(
      panel({ id: 'ped-div', name: 'Costado interior de la cajonera', role: 'divider', normal: 'x', x: pedestal === 'left' ? startAt(ref('lat-izq.x1', PEDESTAL - 2 * t)) : endAt(ref('lat-der.x0', -(PEDESTAL - 2 * t))), y: extent(ref('mueble.y0'), ref('cubierta.y0')), z: endsZ }),
      panel({ id: 'ped-fondo', name: 'Fondo de la cajonera', role: 'back', normal: 'z', x: between, y: extent(ref('mueble.y0'), ref('cubierta.y0')), z: startAt(ref(`${outer}.z0`)) }),
      panel({ id: 'ped-zoclo', name: 'Zoclo de la cajonera', role: 'kick', normal: 'z', x: between, y: extent(ref('mueble.y0'), null, KICK), z: endAt(ref(`${outer}.z1`, -KICK_SETBACK)) }),
      panel({ id: 'ped-piso', name: 'Piso de la cajonera', role: 'bottom', normal: 'y', x: between, y: startAt(ref('ped-zoclo.y1')), z: zBox, load: 'medium' }),
    )
    const n = plan.pedestal.drawers
    for (let k = 1; k < n; k++)
      pieces.push(panel({ id: `ped-sep-${k}`, name: `Separador ${k} de la cajonera`, role: 'shelf', normal: 'y', x: between, y: startAt(partway('ped-piso.y1', 'cubierta.y0', k / n, -t / 2)), z: zBox, load: 'light' }))
    const [left, right]: [FaceRef, FaceRef] = pedestal === 'left' ? ['lat-izq.x1', 'ped-div.x0'] : ['ped-div.x1', 'lat-der.x0']
    drawers = Array.from({ length: n }, (_, i) => ({
      op: 'addDrawer' as const,
      group: `cajon-${i + 1}`,
      name: `Cajón ${i + 1}`,
      left,
      right,
      bottom: i === 0 ? 'ped-piso.y1' : `ped-sep-${i}.y1`,
      top: i === n - 1 ? 'cubierta.y0' : `ped-sep-${i + 1}.y0`,
      front: `${outer}.z1`,
      back: 'ped-fondo.z1',
      material: plan.material,
      bottomMaterial: 'TR6',
    }))
    openLeft = pedestal === 'left' ? 'ped-div.x1' : 'lat-izq.x1'
    openRight = pedestal === 'left' ? 'lat-der.x0' : 'ped-div.x0'
  }

  // Aprons front and back tie the ends; screwed from inside with pocket screws, they keep the table square.
  const apronX = extent(ref(openLeft), ref(openRight))
  pieces.push(
    panel({ id: 'faldon-frente', name: 'Faldón del frente', role: 'apron', normal: 'z', x: apronX, y: extent(null, ref('cubierta.y0'), APRON), z: endAt(ref('lat-der.z1')) }),
    panel({ id: 'faldon-atras', name: desk ? 'Faldón trasero' : 'Faldón de atrás', role: 'apron', normal: 'z', x: apronX, y: extent(null, ref('cubierta.y0'), desk ? MODESTY : APRON), z: startAt(ref('lat-der.z0')) }),
  )
  for (const apron of ['faldon-frente', 'faldon-atras'])
    for (const end of [openLeft, openRight].map((f) => f.split('.')[0]))
      joints.push(makeJoint(`u-${apron}-${end}`, apron, end, 'pocket-screw', [{ hardwareId: 'tornillo-bolsillo-1-1/4', count: 2 }]))

  // Cleats between the aprons, so the top never spans more than it can.
  const openWidth = width - 2 * plan.overhang - 2 * t - (pedestal ? PEDESTAL - t : 0)
  const cleats = Math.ceil(openWidth / (MAX_SPAN + t)) - 1
  for (let k = 1; k <= cleats; k++)
    pieces.push(panel({ id: `travesano-${k}`, name: `Travesaño ${k}`, role: 'divider', normal: 'x', x: startAt(partway(openLeft, openRight, k / (cleats + 1), -t / 2)), y: extent(ref('faldon-frente.y0'), ref('cubierta.y0')), z: extent(ref('faldon-atras.z1'), ref('faldon-frente.z0')) }))

  if (plan.shelf && !desk) {
    pieces.push(panel({ id: 'repisa-baja', name: 'Repisa baja', role: 'shelf', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: startAt(ref('mueble.y0', SHELF_HEIGHT)), z: endsZ, load: 'light' }))
    // The shelf sits close to the floor: short feet under it are simpler than anything above.
    const feet = Math.ceil((width - 2 * plan.overhang - 2 * t) / (MAX_SPAN + t)) - 1
    for (let k = 1; k <= feet; k++)
      pieces.push(panel({ id: `pata-repisa-${k}`, name: `Apoyo ${k} de la repisa`, role: 'divider', normal: 'x', x: startAt(partway('lat-izq.x1', 'lat-der.x0', k / (feet + 1), -t / 2)), y: extent(ref('mueble.y0'), ref('repisa-baja.y0')), z: endsZ }))
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
