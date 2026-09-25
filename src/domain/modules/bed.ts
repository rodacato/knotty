import { z } from 'zod'
import { startAt, partway, endAt, makePiece, ref, extent } from '../design/builders'
import type { FaceRef, Design, Piece } from '../design/schema'
import { completeJoints } from '../design/joints'
import { materialById, type Catalog } from '../materials/catalog'
import { applyOperations } from '../operations/apply'
import type { Operation } from '../operations/schema'
import { MATTRESSES } from '../typology/typology'

// A bed from its ficha: mattress, base height, drawers and headboard. Knotty builds every piece, as with a cabinet.
// The bed lies along x with the headboard at x0; seen from the foot, its left side is z1 and its right side z0.

const Mattress = z.enum(['individual', 'matrimonial', 'queen', 'king'])
type Mattress = z.infer<typeof Mattress>

/** The most drawers a side of the base takes. */
export const MAX_DRAWERS_PER_SIDE = 4
const MATTRESS_SIZES = Object.entries(MATTRESSES)
  .map(([name, [width, length]]) => `${name} ${width / 10} × ${length / 10}`)
  .join(', ')

export const BedPlan = z.object({
  kind: z.literal('bed'),
  name: z.string().describe('Name of the furniture for the person, in Spanish: "Cama individual con cajones"'),
  mattress: Mattress.describe(`Mattress size: ${MATTRESS_SIZES} cm`),
  material: z.string().describe('Plywood id, usually "T18"'),
  height: z.number().positive().describe('Base height in mm, from the floor to where the mattress rests; usually 300–450'),
  drawers: z.object({
    side: z.enum(['none', 'left', 'right', 'both']).describe('Which side they open on, seen from the foot of the bed: none, left, right or both'),
    count: z.number().int().min(0).max(MAX_DRAWERS_PER_SIDE).describe('How many drawers per side; 0 if there are none'),
    position: z.enum(['head', 'center', 'foot']).describe('If they do not fill the whole length, where they gather: head, center or foot'),
  }),
  headboard: z.object({
    style: z.enum(['none', 'plain', 'bookcase', 'storage']).describe('none: no headboard; plain: a flat board; bookcase: a bookcase with shelves; storage: a closed compartment at pillow height with shelves above'),
    height: z.number().positive().describe('Total headboard height from the floor in mm; usually 900–1200'),
    depth: z.number().nonnegative().describe('Depth of the bookcase or compartment in mm; usually 200–300. It does not count for a plain headboard or none: 0'),
    shelves: z.number().int().nonnegative().describe('Shelves in the bookcase or above the compartment'),
  }),
})
export type BedPlan = z.infer<typeof BedPlan>

/** Room around the mattress so it goes in and comes out. */
const MATTRESS_PLAY = 20
const KICK_HEIGHT = 80
/** The platform carries people: it needs something under it at least this often, and drawers are no wider. */
const MAX_SPAN = 600
/** A closed stretch of side shorter than this leaves too little joint for two screws. */
const MIN_CLOSED_STRETCH = 120
/** As wide as a drawer gets to fill its side: past it, the platform over the drawer bends more than it should. */
const WIDEST_DRAWER = 640
/** The pillow-level compartment of a storage headboard. */
const COMPARTMENT = 280
/** Past this, the platform does not fit one sheet across and goes in two halves over the spine. */
const ONE_SHEET = 1200
const BACK = 'TR6'

interface BedSize {
  width: number
  length: number
  height: number
}

/** A bookcase or storage headboard the expert left without depth gets the usual one. */
const HEADBOARD_DEPTH = 250
const headboardDepth = (plan: BedPlan, t: number) => (plan.headboard.style === 'none' ? 0 : plan.headboard.style === 'plain' ? t : plan.headboard.depth || HEADBOARD_DEPTH)

/** Outer measures from the mattress, the base and the headboard, as the furniture's width (x), height and depth (z). */
function bedSize(plan: BedPlan, t: number): BedSize {
  const [mw, ml] = MATTRESSES[plan.mattress]
  return {
    width: headboardDepth(plan, t) + ml + MATTRESS_PLAY + t,
    length: mw + MATTRESS_PLAY,
    height: plan.headboard.style === 'none' ? plan.height : Math.max(plan.height, plan.headboard.height),
  }
}

interface BuiltBed {
  design: Design
  notes: string[]
}

export function buildBed(plan: BedPlan, catalog: Catalog): BuiltBed {
  const t = materialById(catalog, plan.material)?.thickness ?? 18
  const size = bedSize(plan, t)
  const hd = headboardDepth(plan, t)
  const panel = (p: Omit<Parameters<typeof makePiece>[0], 'material'>) => makePiece({ material: plan.material, edges: ['front'], ...p })
  // The headboard is its own part: its floor is level with the platform but is not where the mattress goes.
  const headboardPanel = (p: Omit<Parameters<typeof makePiece>[0], 'material'>) => panel({ group: 'headboard', ...p })
  const pieces: Piece[] = []
  const notes: string[] = []
  const style = plan.headboard.style
  const deep = style === 'bookcase' || style === 'storage'

  // Headboard: a plain board, or a shallow box open toward the mattress.
  if (style === 'plain') pieces.push(headboardPanel({ id: 'headboard', name: 'Cabecera', role: 'side', normal: 'x', x: startAt(ref('furniture.x0')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: extent(ref('furniture.z0'), ref('furniture.z1')), grain: 'length' }))
  if (deep) {
    const between = extent(ref('head-side-right.z1'), ref('head-side-left.z0'))
    const inside = extent(ref('head-back.x1'), ref('furniture.x0', hd))
    pieces.push(
      headboardPanel({ id: 'head-side-left', name: 'Costado izquierdo de la cabecera', role: 'side', normal: 'z', x: extent(ref('furniture.x0'), ref('furniture.x0', hd)), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: endAt(ref('furniture.z1')) }),
      headboardPanel({ id: 'head-side-right', name: 'Costado derecho de la cabecera', role: 'side', normal: 'z', x: extent(ref('furniture.x0'), ref('furniture.x0', hd)), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: startAt(ref('furniture.z0')) }),
      headboardPanel({ id: 'head-back', name: 'Fondo de la cabecera', role: 'back', normal: 'x', x: startAt(ref('furniture.x0')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: between, grain: 'length' }),
      headboardPanel({ id: 'head-top', name: 'Techo de la cabecera', role: 'top', normal: 'y', x: inside, y: endAt(ref('furniture.y1')), z: between }),
    )
    const shelfFloor: FaceRef = style === 'storage' ? 'head-sep.y1' : 'head-bottom.y1'
    // The compartment is closed by a board in front, so its floor and lid stop behind it.
    const inner = style === 'storage' ? extent(ref('head-back.x1'), ref('head-cover.x0')) : inside
    pieces.push(headboardPanel({ id: 'head-bottom', name: 'Piso de la cabecera', role: 'bottom', normal: 'y', x: inner, y: endAt(ref('furniture.y0', plan.height)), z: between, load: 'medium' }))
    if (style === 'storage')
      pieces.push(
        headboardPanel({ id: 'head-sep', name: 'Tapa del compartimento', role: 'shelf', normal: 'y', x: inner, y: startAt(ref('head-bottom.y1', COMPARTMENT)), z: between, load: 'medium' }),
        headboardPanel({ id: 'head-cover', name: 'Frente del compartimento', role: 'other', normal: 'x', x: endAt(ref('furniture.x0', hd)), y: extent(ref('head-bottom.y0'), ref('head-sep.y1')), z: between, grain: 'length' }),
      )
    const n = plan.headboard.shelves
    for (let k = 1; k <= n; k++)
      pieces.push(headboardPanel({ id: `head-shelf-${k}`, name: `Repisa ${k} de la cabecera`, role: 'shelf', normal: 'y', x: inside, y: startAt(partway(shelfFloor, 'head-top.y0', k / (n + 1), -t / 2)), z: between, load: 'medium', support: 'fixed' }))
    if (plan.headboard.height - plan.height < COMPARTMENT + 2 * t && style === 'storage') notes.push('La cabecera es baja para un compartimento arriba de la base: súbela o hazla librero.')
  }

  // Base: head and foot ends, a spine down the middle and the platform on top.
  const headEnd: FaceRef = style === 'plain' ? 'headboard.x1' : 'head-panel.x1'
  if (style !== 'plain')
    pieces.push(panel({ id: 'head-panel', name: 'Cabecero de la base', role: 'side', normal: 'x', x: deep ? endAt(ref('furniture.x0', hd)) : startAt(ref('furniture.x0')), y: extent(ref('furniture.y0'), ref('furniture.y0', plan.height - t)), z: deep ? extent(ref('head-side-right.z1'), ref('head-side-left.z0')) : extent(ref('furniture.z0'), ref('furniture.z1')) }))
  pieces.push(panel({ id: 'foot-panel', name: 'Piecero', role: 'side', normal: 'x', x: endAt(ref('furniture.x1')), y: extent(ref('furniture.y0'), ref('furniture.y0', plan.height - t)), z: extent(ref('furniture.z0'), ref('furniture.z1')) }))
  const platformX = extent(ref(style === 'none' ? 'head-panel.x0' : headEnd), ref('furniture.x1'))
  const platformY = endAt(ref('furniture.y0', plan.height))
  const split = size.length > ONE_SHEET
  const middle = size.length / 2
  if (split)
    pieces.push(
      panel({ id: 'platform-left', name: 'Plataforma izquierda', role: 'bottom', normal: 'y', x: platformX, y: platformY, z: extent(ref('furniture.z0', middle), ref('furniture.z1')), load: 'heavy', grain: 'length' }),
      panel({ id: 'platform-right', name: 'Plataforma derecha', role: 'bottom', normal: 'y', x: platformX, y: platformY, z: extent(ref('furniture.z0'), ref('furniture.z0', middle)), load: 'heavy', grain: 'length' }),
    )
  else pieces.push(panel({ id: 'platform', name: 'Plataforma', role: 'bottom', normal: 'y', x: platformX, y: platformY, z: extent(ref('furniture.z0'), ref('furniture.z1')), load: 'heavy', grain: 'length' }))
  const under = (side: 'left' | 'right'): FaceRef => (split ? `platform-${side}.y0` : 'platform.y0')
  pieces.push(panel({ id: 'spine', name: 'Espina central', role: 'divider', normal: 'z', x: extent(ref(headEnd), ref('foot-panel.x0')), y: extent(ref('furniture.y0'), ref(under('left'))), z: startAt(ref('furniture.z0', middle - t / 2)), grain: 'length' }))

  // Each side: drawers between dividers, or a closed rail.
  const drawers: Operation[] = []
  const inner = size.width - hd - t - (style === 'plain' ? 0 : deep ? 0 : t)
  for (const side of ['left', 'right'] as const) {
    const faceZ = side === 'left' ? endAt(ref('furniture.z1')) : startAt(ref('furniture.z0'))
    const hasDrawers = plan.drawers.count > 0 && (plan.drawers.side === 'both' || plan.drawers.side === (side === 'left' ? 'left' : 'right'))
    const label = side === 'left' ? 'izquierdo' : 'derecho'
    /** Cross members over a closed stretch of the side, so the platform never spans more than it can. */
    const crossMembers = (from: number, to: number, span: number) => {
      const count = Math.ceil((to - from) / (MAX_SPAN + t)) - 1
      for (let k = 1; k <= count; k++)
        pieces.push(panel({ id: `rail-${side}-${span}-${k}`, name: `Travesaño ${label} ${span}.${k}`, role: 'divider', normal: 'x', x: startAt(ref(headEnd, from + ((to - from) * k) / (count + 1) - t / 2)), y: extent(ref('furniture.y0'), ref(under(side))), z: side === 'left' ? extent(ref('spine.z1'), ref(`side-${side}-${span}.z0`)) : extent(ref(`side-${side}-${span}.z1`), ref('spine.z0')) }))
    }
    if (!hasDrawers) {
      pieces.push(panel({ id: `side-${side}-1`, name: `Costado ${label}`, role: 'side', normal: 'z', z: faceZ, x: extent(ref(headEnd), ref('foot-panel.x0')), y: extent(ref('furniture.y0'), ref(under(side))), grain: 'length' }))
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
    // Centered, the free length splits in two; if each half would be a sliver, the drawers gather at the head instead.
    const centered = plan.drawers.position === 'center' && rest / 2 - t >= MIN_CLOSED_STRETCH
    const before = plan.drawers.position === 'foot' ? rest : centered ? rest / 2 : 0
    const edges: FaceRef[] = []
    const addDivider = (id: string, at: number) => {
      pieces.push(panel({ id, name: `Divisor ${label} ${edges.length + 1}`, role: 'divider', normal: 'x', x: startAt(ref(headEnd, at)), y: extent(ref('furniture.y0'), ref(under(side))), z: side === 'left' ? extent(ref('spine.z1'), ref('furniture.z1')) : extent(ref('furniture.z0'), ref('spine.z0')) }))
    }
    const closedSpans: [FaceRef, FaceRef, number, number][] = []
    let left: FaceRef = headEnd
    if (before > 1) {
      addDivider(`div-${side}-0`, before - t)
      closedSpans.push([headEnd, `div-${side}-0.x0`, 0, before - t])
      left = `div-${side}-0.x1`
    }
    for (let k = 1; k <= n; k++) {
      const last = k === n
      const reachesFoot = last && rest - before <= 1
      let right: FaceRef = 'foot-panel.x0'
      if (!reachesFoot) {
        const id = `div-${side}-${k}`
        addDivider(id, before + k * width + (k - 1) * t)
        right = `${id}.x0`
        if (last) closedSpans.push([`${id}.x1`, 'foot-panel.x0', before + group + t, inner])
      }
      edges.push(right)
      const bay = `${side}-${k}`
      pieces.push(panel({ id: `kick-${bay}`, name: `Zoclo ${label} ${k}`, role: 'kick', normal: 'z', z: faceZ, x: extent(ref(left), ref(right)), y: extent(ref('furniture.y0'), null, KICK_HEIGHT), grain: 'length' }))
      drawers.push({
        op: 'addDrawer',
        group: `drawer-${side}-${k}`,
        name: `Cajón ${label} ${k}`,
        left: left,
        right: right,
        bottom: `kick-${bay}.y1`,
        top: under(side),
        front: side === 'left' ? 'furniture.z1' : 'furniture.z0',
        back: side === 'left' ? 'spine.z1' : 'spine.z0',
        material: plan.material,
        bottomMaterial: BACK,
      })
      left = right === 'foot-panel.x0' ? left : `div-${side}-${k}.x1`
    }
    closedSpans.forEach(([from, to, start, end], i) => {
      pieces.push(panel({ id: `side-${side}-${i + 1}`, name: `Costado ${label} ${i + 1}`, role: 'side', normal: 'z', z: faceZ, x: extent(ref(from), ref(to)), y: extent(ref('furniture.y0'), ref(under(side))), grain: 'length' }))
      crossMembers(start, end, i + 1)
    })
  }

  let design: Design = {
    schema: 1,
    name: plan.name,
    dimensions: { width: size.width, height: size.height, depth: size.length },
    wallAnchored: false,
    notes: '',
    pieces: pieces,
    joints: [],
  }
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
