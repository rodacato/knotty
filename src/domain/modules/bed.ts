import { z } from 'zod'
import { startAt, partway, endAt, makePiece, ref, extent } from '../diseno/builders'
import type { CaraRef, Diseno, Pieza } from '../diseno/esquema'
import { completeJoints } from '../diseno/joints'
import { materialPorId, type Catalogo } from '../materiales/catalogo'
import { aplicar } from '../operaciones/aplicar'
import type { Operacion } from '../operaciones/esquema'
import { MATTRESSES } from '../typology/typology'

// A bed from its ficha: mattress, base height, drawers and headboard. Knotty builds every piece, as with a cabinet.
// The bed lies along x with the headboard at x0; seen from the foot, its left side is z1 and its right side z0.

export const Mattress = z.enum(['individual', 'matrimonial', 'queen', 'king'])
export type Mattress = z.infer<typeof Mattress>

export const BedPlan = z.object({
  kind: z.literal('bed'),
  name: z.string().describe('Nombre del mueble para la persona: "Cama individual con cajones"'),
  mattress: Mattress.describe('Medida del colchón: individual 99 × 190, matrimonial 135 × 190, queen 152 × 200, king 193 × 200 cm'),
  material: z.string().describe('Id del triplay, normalmente "T18"'),
  height: z.number().positive().describe('Alto de la base en mm, del piso a donde se apoya el colchón; lo normal, 300–450'),
  drawers: z.object({
    side: z.enum(['none', 'left', 'right', 'both']).describe('De qué lado abren, viendo la cama desde el pie: none, left, right o both'),
    count: z.number().int().min(1).max(4).describe('Cuántos cajones por lado'),
    position: z.enum(['head', 'center', 'foot']).describe('Si no llenan todo el largo, hacia dónde se juntan: cabecera, centro o pie'),
  }),
  headboard: z.object({
    style: z.enum(['none', 'plain', 'bookcase', 'storage']).describe('none: sin cabecera; plain: un tablero liso; bookcase: librero con repisas; storage: compartimento cerrado a la altura de la almohada y repisas arriba'),
    height: z.number().positive().describe('Alto total de la cabecera desde el piso en mm; lo normal, 900–1200'),
    depth: z.number().positive().describe('Fondo del librero o compartimento en mm; lo normal, 200–300. En una cabecera lisa no cuenta'),
    shelves: z.number().int().nonnegative().describe('Repisas del librero o arriba del compartimento'),
  }),
})
export type BedPlan = z.infer<typeof BedPlan>

/** Room around the mattress so it goes in and comes out. */
const MATTRESS_PLAY = 20
const KICK_HEIGHT = 80
/** The platform carries people: it needs something under it at least this often, and drawers are no wider. */
const MAX_SPAN = 600
/** As wide as a drawer gets to fill its side: past it, the platform over the drawer bends more than it should. */
const WIDEST_DRAWER = 640
/** The pillow-level compartment of a storage headboard. */
const COMPARTMENT = 280
/** Past this, the platform does not fit one sheet across and goes in two halves over the spine. */
const ONE_SHEET = 1200
const BACK = 'TR6'

export interface BedSize {
  width: number
  length: number
  height: number
}

const headboardDepth = (plan: BedPlan, t: number) => (plan.headboard.style === 'none' ? 0 : plan.headboard.style === 'plain' ? t : plan.headboard.depth)

/** Outer measures from the mattress, the base and the headboard, as the mueble's width (x), height and depth (z). */
export function bedSize(plan: BedPlan, t: number): BedSize {
  const [mw, ml] = MATTRESSES[plan.mattress]
  return {
    width: headboardDepth(plan, t) + ml + MATTRESS_PLAY + t,
    length: mw + MATTRESS_PLAY,
    height: plan.headboard.style === 'none' ? plan.height : Math.max(plan.height, plan.headboard.height),
  }
}

export interface BuiltBed {
  design: Diseno
  notes: string[]
}

export function buildBed(plan: BedPlan, catalog: Catalogo): BuiltBed {
  const t = materialPorId(catalog, plan.material)?.espesor ?? 18
  const size = bedSize(plan, t)
  const hd = headboardDepth(plan, t)
  const panel = (p: Omit<Parameters<typeof makePiece>[0], 'material'>) => makePiece({ material: plan.material, cantos: ['frente'], ...p })
  // The headboard is its own part: its floor is level with the platform but is not where the mattress goes.
  const headboardPanel = (p: Omit<Parameters<typeof makePiece>[0], 'material'>) => panel({ grupo: 'cabecera', ...p })
  const pieces: Pieza[] = []
  const notes: string[] = []
  const style = plan.headboard.style
  const deep = style === 'bookcase' || style === 'storage'

  // Headboard: a plain board, or a shallow box open toward the mattress.
  if (style === 'plain') pieces.push(headboardPanel({ id: 'cabecera', nombre: 'Cabecera', rol: 'lateral', normal: 'x', x: startAt(ref('mueble.x0')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: extent(ref('mueble.z0'), ref('mueble.z1')), veta: 'largo' }))
  if (deep) {
    const between = extent(ref('cab-lat-der.z1'), ref('cab-lat-izq.z0'))
    const inside = extent(ref('cab-fondo.x1'), ref('mueble.x0', hd))
    pieces.push(
      headboardPanel({ id: 'cab-lat-izq', nombre: 'Costado izquierdo de la cabecera', rol: 'lateral', normal: 'z', x: extent(ref('mueble.x0'), ref('mueble.x0', hd)), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: endAt(ref('mueble.z1')) }),
      headboardPanel({ id: 'cab-lat-der', nombre: 'Costado derecho de la cabecera', rol: 'lateral', normal: 'z', x: extent(ref('mueble.x0'), ref('mueble.x0', hd)), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: startAt(ref('mueble.z0')) }),
      headboardPanel({ id: 'cab-fondo', nombre: 'Fondo de la cabecera', rol: 'trasera', normal: 'x', x: startAt(ref('mueble.x0')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: between, veta: 'largo' }),
      headboardPanel({ id: 'cab-techo', nombre: 'Techo de la cabecera', rol: 'techo', normal: 'y', x: inside, y: endAt(ref('mueble.y1')), z: between }),
    )
    const shelfFloor: CaraRef = style === 'storage' ? 'cab-sep.y1' : 'cab-piso.y1'
    // The compartment is closed by a board in front, so its floor and lid stop behind it.
    const inner = style === 'storage' ? extent(ref('cab-fondo.x1'), ref('cab-tapa.x0')) : inside
    pieces.push(headboardPanel({ id: 'cab-piso', nombre: 'Piso de la cabecera', rol: 'piso', normal: 'y', x: inner, y: endAt(ref('mueble.y0', plan.height)), z: between, carga: 'media' }))
    if (style === 'storage')
      pieces.push(
        headboardPanel({ id: 'cab-sep', nombre: 'Tapa del compartimento', rol: 'entrepano', normal: 'y', x: inner, y: startAt(ref('cab-piso.y1', COMPARTMENT)), z: between, carga: 'media' }),
        headboardPanel({ id: 'cab-tapa', nombre: 'Frente del compartimento', rol: 'otro', normal: 'x', x: endAt(ref('mueble.x0', hd)), y: extent(ref('cab-piso.y0'), ref('cab-sep.y1')), z: between, veta: 'largo' }),
      )
    const n = plan.headboard.shelves
    for (let k = 1; k <= n; k++)
      pieces.push(headboardPanel({ id: `cab-rep-${k}`, nombre: `Repisa ${k} de la cabecera`, rol: 'entrepano', normal: 'y', x: inside, y: startAt(partway(shelfFloor, 'cab-techo.y0', k / (n + 1), -t / 2)), z: between, carga: 'media', apoyo: 'fijo' }))
    if (plan.headboard.height - plan.height < COMPARTMENT + 2 * t && style === 'storage') notes.push('La cabecera es baja para un compartimento arriba de la base: súbela o hazla librero.')
  }

  // Base: head and foot ends, a spine down the middle and the platform on top.
  const headEnd: CaraRef = style === 'plain' ? 'cabecera.x1' : 'base-cabeza.x1'
  if (style !== 'plain')
    pieces.push(panel({ id: 'base-cabeza', nombre: 'Cabecero de la base', rol: 'lateral', normal: 'x', x: deep ? endAt(ref('mueble.x0', hd)) : startAt(ref('mueble.x0')), y: extent(ref('mueble.y0'), ref('mueble.y0', plan.height - t)), z: deep ? extent(ref('cab-lat-der.z1'), ref('cab-lat-izq.z0')) : extent(ref('mueble.z0'), ref('mueble.z1')) }))
  pieces.push(panel({ id: 'base-pie', nombre: 'Piecero', rol: 'lateral', normal: 'x', x: endAt(ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y0', plan.height - t)), z: extent(ref('mueble.z0'), ref('mueble.z1')) }))
  const platformX = extent(ref(style === 'none' ? 'base-cabeza.x0' : headEnd), ref('mueble.x1'))
  const platformY = endAt(ref('mueble.y0', plan.height))
  const split = size.length > ONE_SHEET
  const middle = size.length / 2
  if (split)
    pieces.push(
      panel({ id: 'plataforma-izq', nombre: 'Plataforma izquierda', rol: 'piso', normal: 'y', x: platformX, y: platformY, z: extent(ref('mueble.z0', middle), ref('mueble.z1')), carga: 'pesada', veta: 'largo' }),
      panel({ id: 'plataforma-der', nombre: 'Plataforma derecha', rol: 'piso', normal: 'y', x: platformX, y: platformY, z: extent(ref('mueble.z0'), ref('mueble.z0', middle)), carga: 'pesada', veta: 'largo' }),
    )
  else pieces.push(panel({ id: 'plataforma', nombre: 'Plataforma', rol: 'piso', normal: 'y', x: platformX, y: platformY, z: extent(ref('mueble.z0'), ref('mueble.z1')), carga: 'pesada', veta: 'largo' }))
  const under = (side: 'izq' | 'der'): CaraRef => (split ? `plataforma-${side}.y0` : 'plataforma.y0')
  pieces.push(panel({ id: 'espina', nombre: 'Espina central', rol: 'divisor', normal: 'z', x: extent(ref(headEnd), ref('base-pie.x0')), y: extent(ref('mueble.y0'), ref(under('izq'))), z: startAt(ref('mueble.z0', middle - t / 2)), veta: 'largo' }))

  // Each side: drawers between dividers, or a closed rail.
  const drawers: Operacion[] = []
  const inner = size.width - hd - t - (style === 'plain' ? 0 : deep ? 0 : t)
  for (const side of ['izq', 'der'] as const) {
    const faceZ = side === 'izq' ? endAt(ref('mueble.z1')) : startAt(ref('mueble.z0'))
    const hasDrawers = plan.drawers.side === 'both' || plan.drawers.side === (side === 'izq' ? 'left' : 'right')
    const label = side === 'izq' ? 'izquierdo' : 'derecho'
    /** Cross members over a closed stretch of the side, so the platform never spans more than it can. */
    const crossMembers = (from: number, to: number, span: number) => {
      const count = Math.ceil((to - from) / (MAX_SPAN + t)) - 1
      for (let k = 1; k <= count; k++)
        pieces.push(panel({ id: `travesano-${side}-${span}-${k}`, nombre: `Travesaño ${label} ${span}.${k}`, rol: 'divisor', normal: 'x', x: startAt(ref(headEnd, from + ((to - from) * k) / (count + 1) - t / 2)), y: extent(ref('mueble.y0'), ref(under(side))), z: side === 'izq' ? extent(ref('espina.z1'), ref(`costado-${side}-${span}.z0`)) : extent(ref(`costado-${side}-${span}.z1`), ref('espina.z0')) }))
    }
    if (!hasDrawers) {
      pieces.push(panel({ id: `costado-${side}-1`, nombre: `Costado ${label}`, rol: 'lateral', normal: 'z', z: faceZ, x: extent(ref(headEnd), ref('base-pie.x0')), y: extent(ref('mueble.y0'), ref(under(side))), veta: 'largo' }))
      crossMembers(0, inner, 1)
      continue
    }
    const n = plan.drawers.count
    const full = (inner - (n - 1) * t) / n
    // Drawers a little wider than the span fill the side instead of leaving a sliver; the platform still holds over them.
    const width = full <= WIDEST_DRAWER ? full : MAX_SPAN
    const group = n * width + (n - 1) * t
    const rest = inner - group
    // Where the drawers gather: the free length goes to the other end, closed by a rail.
    const before = plan.drawers.position === 'head' ? 0 : plan.drawers.position === 'foot' ? rest : rest / 2
    const edges: CaraRef[] = []
    const addDivider = (id: string, at: number) => {
      pieces.push(panel({ id, nombre: `Divisor ${label} ${edges.length + 1}`, rol: 'divisor', normal: 'x', x: startAt(ref(headEnd, at)), y: extent(ref('mueble.y0'), ref(under(side))), z: side === 'izq' ? extent(ref('espina.z1'), ref('mueble.z1')) : extent(ref('mueble.z0'), ref('espina.z0')) }))
    }
    const closedSpans: [CaraRef, CaraRef, number, number][] = []
    let left: CaraRef = headEnd
    if (before > 1) {
      addDivider(`div-${side}-0`, before - t)
      closedSpans.push([headEnd, `div-${side}-0.x0`, 0, before - t])
      left = `div-${side}-0.x1`
    }
    for (let k = 1; k <= n; k++) {
      const last = k === n
      const reachesFoot = last && rest - before <= 1
      let right: CaraRef = 'base-pie.x0'
      if (!reachesFoot) {
        const id = `div-${side}-${k}`
        addDivider(id, before + k * width + (k - 1) * t)
        right = `${id}.x0`
        if (last) closedSpans.push([`${id}.x1`, 'base-pie.x0', before + group + t, inner])
      }
      edges.push(right)
      const bay = `${side}-${k}`
      pieces.push(panel({ id: `zoclo-${bay}`, nombre: `Zoclo ${label} ${k}`, rol: 'zoclo', normal: 'z', z: faceZ, x: extent(ref(left), ref(right)), y: extent(ref('mueble.y0'), null, KICK_HEIGHT), veta: 'largo' }))
      drawers.push({
        op: 'agregarCajon',
        grupo: `cajon-${side}-${k}`,
        nombre: `Cajón ${label} ${k}`,
        izquierda: left,
        derecha: right,
        abajo: `zoclo-${bay}.y1`,
        arriba: under(side),
        frente: side === 'izq' ? 'mueble.z1' : 'mueble.z0',
        fondo: side === 'izq' ? 'espina.z1' : 'espina.z0',
        material: plan.material,
        materialFondo: BACK,
      })
      left = right === 'base-pie.x0' ? left : `div-${side}-${k}.x1`
    }
    closedSpans.forEach(([from, to, start, end], i) => {
      pieces.push(panel({ id: `costado-${side}-${i + 1}`, nombre: `Costado ${label} ${i + 1}`, rol: 'lateral', normal: 'z', z: faceZ, x: extent(ref(from), ref(to)), y: extent(ref('mueble.y0'), ref(under(side))), veta: 'largo' }))
      crossMembers(start, end, i + 1)
    })
  }

  let design: Diseno = {
    esquema: 1,
    nombre: plan.name,
    dimensiones: { ancho: size.width, alto: size.height, fondo: size.length },
    anclajeMuro: false,
    observaciones: '',
    piezas: pieces,
    uniones: [],
  }
  for (const drawer of drawers) {
    const result = aplicar(design, [drawer], catalog)
    if (!result.ok) {
      notes.push(`${drawer.op === 'agregarCajon' ? drawer.nombre : 'Un cajón'}: ${result.errores[0]?.message ?? 'no cupo'} Lo dejé como hueco abierto.`)
      continue
    }
    design = result.valor.diseno
  }
  return { design: completeJoints(design, catalog), notes }
}
