import { z } from 'zod'
import { startAt, partway, endAt, ref, extent } from '../../design/builders'
import type { Extent, FaceRef, Design, Piece } from '../../design/schema'
import { MATTRESSES, MattressSize } from '../../design/kind'
import { completeJoints } from '../../design/joints'
import { backBoard, type Catalog } from '../../materials/catalog'
import { addDrawers, cm, KICK_HEIGHT, LEG_HEIGHT, LEG_HEIGHT_RANGE, LEG_WIDTH, legLayers, MAX_SPAN, MIN_CARCASS_HEIGHT, panelOf, supportsAcross, thicknessOf, type AddDrawer } from './common'
import { choice, fromLabels, material, note, number, numbers, section, stepper, type FieldSpec } from './fields'
import type { FurnitureModule, Labels } from './module'
import { counted, woodPart, type Parts } from './parts'

// A bed from its ficha: mattress, base height, drawers and headboard. Knotty builds every piece, as with a cabinet.
// The bed lies along x with the headboard at x0; seen from the foot, its left side is z1 and its right side z0.

/** The most drawers a side of the base takes. */
export const MAX_DRAWERS_PER_SIDE = 4
const MATTRESS_SIZES = Object.entries(MATTRESSES)
  .map(([name, [width, length]]) => `${name} ${width / 10} × ${length / 10}`)
  .join(', ')

const LEG_HEIGHT_MESSAGE = `Las patas miden entre ${LEG_HEIGHT_RANGE.min} y ${LEG_HEIGHT_RANGE.max} mm.`

export const BedPlan = z.object({
  kind: z.literal('bed'),
  name: z.string().describe('Name of the furniture for the person, in Spanish: "Cama individual con cajones"'),
  mattress: MattressSize.describe(`Mattress size: ${MATTRESS_SIZES} cm`),
  material: z.string().describe('Plywood id, usually "T18"'),
  height: z.number().positive().describe('Base height in mm, from the floor to where the mattress rests; usually 300–450'),
  legs: z
    .enum(['none', 'legs'])
    .default('none')
    .describe('none: the frame stands on the floor; legs: the frame is raised on four legs at the corners, and more along the length if it is long. Not with drawers: their bench needs the plinth'),
  legHeight: z
    .number()
    .min(LEG_HEIGHT_RANGE.min, LEG_HEIGHT_MESSAGE)
    .max(LEG_HEIGHT_RANGE.max, LEG_HEIGHT_MESSAGE)
    .default(LEG_HEIGHT)
    .describe(`Leg height in mm with legs, ${LEG_HEIGHT_RANGE.min}–${LEG_HEIGHT_RANGE.max}; inside the base height, the frame keeps ${MIN_CARCASS_HEIGHT}+`),
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

const hasDrawers = (plan: BedPlan) => plan.drawers.side !== 'none' && plan.drawers.count > 0
/** The legs take height from the frame above them: what is left must still hold the platform and its rails. */
const frameFits = (plan: BedPlan) => plan.legs !== 'legs' || plan.height - plan.legHeight >= MIN_CARCASS_HEIGHT
const FRAME_TOO_LOW = `No cupo: con esas patas el marco de la cama queda de menos de ${MIN_CARCASS_HEIGHT} mm; baja las patas o sube el alto de la base.`
const LEGS_WITH_DRAWERS = 'No cupo: una cama con cajones no lleva patas, el zoclo sostiene el banco de cajones.'

export const BED_LABELS = {
  mattress: {
    individual: { option: 'Individual', phrase: 'colchón individual' },
    matrimonial: { option: 'Matrimonial', phrase: 'colchón matrimonial' },
    queen: { option: 'Queen', phrase: 'colchón queen' },
    king: { option: 'King', phrase: 'colchón king' },
  } satisfies Labels<MattressSize>,
  drawerSide: {
    none: { option: 'Sin cajones', phrase: 'sin cajones' },
    left: { option: 'Izquierda', phrase: 'cajones del lado izquierdo' },
    right: { option: 'Derecha', phrase: 'cajones del lado derecho' },
    both: { option: 'Los dos', phrase: 'cajones de los dos lados' },
  } satisfies Labels<BedPlan['drawers']['side']>,
  drawerPosition: {
    head: { option: 'Cabecera', phrase: 'hacia la cabecera' },
    center: { option: 'Centro', phrase: 'al centro' },
    foot: { option: 'Pie', phrase: 'hacia el pie' },
  } satisfies Labels<BedPlan['drawers']['position']>,
  legs: {
    none: { option: 'Sin patas', phrase: 'sin patas' },
    legs: { option: 'Cuatro patas', phrase: 'con patas' },
  } satisfies Labels<BedPlan['legs']>,
  headboard: {
    none: { option: 'Sin cabecera', phrase: 'sin cabecera' },
    plain: { option: 'Lisa', phrase: 'cabecera lisa' },
    bookcase: { option: 'Librero', phrase: 'cabecera librero' },
    storage: { option: 'Compartimento', phrase: 'cabecera con compartimento' },
  } satisfies Labels<BedPlan['headboard']['style']>,
}

/** Room around the mattress so it goes in and comes out. */
const MATTRESS_PLAY = 20
/** A closed stretch of side shorter than this leaves too little joint for two screws. */
const MIN_CLOSED_STRETCH = 120
/** As wide as a drawer gets to fill its side: past it, the platform over the drawer bends more than it should. */
const WIDEST_DRAWER = 640
/** The pillow-level compartment of a storage headboard. */
const COMPARTMENT = 280
/** Past this, the platform does not fit one sheet across and goes in two halves over the spine. */
const ONE_SHEET = 1200

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

type Side = 'left' | 'right'

/** What the plan settles once and every part of the bed reads. */
function layoutOf(plan: BedPlan, catalog: Catalog) {
  const t = thicknessOf(catalog, plan.material)
  const size = bedSize(plan, t)
  const hd = headboardDepth(plan, t)
  const style = plan.headboard.style
  const deep = style === 'bookcase' || style === 'storage'
  const lift = plan.legs === 'legs' && !hasDrawers(plan) ? plan.legHeight : 0
  const split = size.length > ONE_SHEET
  const headEnd: FaceRef = style === 'plain' ? 'headboard.x1' : 'head-panel.x1'
  return {
    plan,
    catalog,
    t,
    size,
    hd,
    panel: panelOf(plan.material),
    style,
    deep,
    lift,
    // The frame stands on its legs: its pieces start where they end, the platform stays where the mattress rests.
    frameY0: ref('furniture.y0', lift),
    /** Where the base starts, past the headboard. */
    headEnd,
    /** Past one sheet across, the platform goes in two halves over the spine. */
    split,
    middle: size.length / 2,
    /** The face of the platform a piece of that side stands under. */
    under: (side: Side): FaceRef => (split ? `platform-${side}.y0` : 'platform.y0'),
    /** The length inside the base, between its head and foot ends. */
    inner: size.width - hd - t - (style === 'plain' ? 0 : deep ? 0 : t),
  }
}
type Layout = ReturnType<typeof layoutOf>

/** Legs stand inside the frame, floor to platform, against the faces they are screwed to: one screwed only to a lower edge swings like a hinge (estructura.md §2.1). */
function legs(l: Layout): Piece[] {
  const { t, headEnd, plan } = l
  const rails = supportsAcross(l.inner, t)
  const pieces: Piece[] = []
  const sides = [
    ['left', 'izquierda', extent(null, ref('side-left-1.z0'), LEG_WIDTH)],
    ['right', 'derecha', extent(ref('side-right-1.z1'), null, LEG_WIDTH)],
  ] as const
  const n = Math.min(supportsAcross(l.size.width - 4 * t - Math.max(l.hd, t), 2 * t), rails)
  for (const [side, words, z] of sides) {
    const y = extent(ref('furniture.y0'), ref(l.under(side)))
    const leg = (id: string, name: string, first: Extent, towards: 'right' | 'left') => pieces.push(...legLayers(plan.material, id, name, first, towards, y, z))
    leg(`leg-head-${side}`, `Pata de la cabecera ${words}`, startAt(ref(headEnd)), 'right')
    leg(`leg-foot-${side}`, `Pata del pie ${words}`, endAt(ref('foot-panel.x0')), 'left')
    let taken = 0
    for (let k = 1; k <= n; k++) {
      const wanted = k / (n + 1)
      const nearest = Array.from({ length: rails }, (_, j) => j + 1).reduce((best, j) => (Math.abs(wanted - j / (rails + 1)) < Math.abs(wanted - best / (rails + 1)) ? j : best), 1)
      taken = Math.max(nearest, taken + 1)
      leg(`leg-middle-${side}-${k}`, `Pata intermedia ${words} ${n > 1 ? `${k} ` : ''}`.trim(), startAt(ref(`rail-${side}-1-${taken}.x1`)), 'right')
    }
  }
  return pieces
}

/** The headboard: a plain board, or a shallow box open toward the mattress, with shelves and, for storage, a closed compartment at pillow height. */
function headboard(l: Layout): { pieces: Piece[]; notes: string[] } {
  const { plan, t, hd, style } = l
  // The headboard is its own part: its floor is level with the platform but is not where the mattress goes.
  const panel = (p: Parameters<typeof l.panel>[0]) => l.panel({ group: 'headboard', ...p })
  const whole = { y: extent(ref('furniture.y0'), ref('furniture.y1')) }
  if (style === 'plain') return { pieces: [panel({ id: 'headboard', name: 'Cabecera', role: 'side', normal: 'x', x: startAt(ref('furniture.x0')), ...whole, z: extent(ref('furniture.z0'), ref('furniture.z1')), grain: 'length' })], notes: [] }
  if (!l.deep) return { pieces: [], notes: [] }

  const storage = style === 'storage'
  const between = extent(ref('head-side-right.z1'), ref('head-side-left.z0'))
  const inside = extent(ref('head-back.x1'), ref('furniture.x0', hd))
  const across = extent(ref('furniture.x0'), ref('furniture.x0', hd))
  const shelfFloor: FaceRef = storage ? 'head-sep.y1' : 'head-bottom.y1'
  // The compartment is closed by a board in front, so its floor and lid stop behind it.
  const inner = storage ? extent(ref('head-back.x1'), ref('head-cover.x0')) : inside
  const n = plan.headboard.shelves
  const compartment = [
    panel({ id: 'head-sep', name: 'Tapa del compartimento', role: 'shelf', normal: 'y', x: inner, y: startAt(ref('head-bottom.y1', COMPARTMENT)), z: between, load: 'medium' }),
    panel({ id: 'head-cover', name: 'Frente del compartimento', role: 'other', normal: 'x', x: endAt(ref('furniture.x0', hd)), y: extent(ref('head-bottom.y0'), ref('head-sep.y1')), z: between, grain: 'length' }),
  ]
  return {
    pieces: [
      panel({ id: 'head-side-left', name: 'Costado izquierdo de la cabecera', role: 'side', normal: 'z', x: across, ...whole, z: endAt(ref('furniture.z1')) }),
      panel({ id: 'head-side-right', name: 'Costado derecho de la cabecera', role: 'side', normal: 'z', x: across, ...whole, z: startAt(ref('furniture.z0')) }),
      panel({ id: 'head-back', name: 'Fondo de la cabecera', role: 'back', normal: 'x', x: startAt(ref('furniture.x0')), ...whole, z: between, grain: 'length' }),
      panel({ id: 'head-top', name: 'Techo de la cabecera', role: 'top', normal: 'y', x: inside, y: endAt(ref('furniture.y1')), z: between }),
      panel({ id: 'head-bottom', name: 'Piso de la cabecera', role: 'bottom', normal: 'y', x: inner, y: endAt(ref('furniture.y0', plan.height)), z: between, load: 'medium' }),
      ...(storage ? compartment : []),
      ...Array.from({ length: n }, (_, i) => i + 1).map((k) =>
        panel({ id: `head-shelf-${k}`, name: `Repisa ${k} de la cabecera`, role: 'shelf', normal: 'y', x: inside, y: startAt(partway(shelfFloor, 'head-top.y0', k / (n + 1), -t / 2)), z: between, load: 'medium', support: 'fixed' }),
      ),
    ],
    notes: storage && plan.headboard.height - plan.height < COMPARTMENT + 2 * t ? ['La cabecera es baja para un compartimento arriba de la base: súbela o hazla librero.'] : [],
  }
}

/** The base: head and foot ends, the platform on top and a spine down the middle. */
function base(l: Layout): Piece[] {
  const { plan, panel, t, hd, style, deep, frameY0, headEnd, middle } = l
  const endY = extent(frameY0, ref('furniture.y0', plan.height - t))
  const across = extent(ref('furniture.z0'), ref('furniture.z1'))
  const headPanel = panel({ id: 'head-panel', name: 'Cabecero de la base', role: 'side', normal: 'x', x: deep ? endAt(ref('furniture.x0', hd)) : startAt(ref('furniture.x0')), y: endY, z: deep ? extent(ref('head-side-right.z1'), ref('head-side-left.z0')) : across })
  const platform = { role: 'bottom', normal: 'y', x: extent(ref(style === 'none' ? 'head-panel.x0' : headEnd), ref('furniture.x1')), y: endAt(ref('furniture.y0', plan.height)), load: 'heavy', grain: 'length' } as const
  return [
    ...(style === 'plain' ? [] : [headPanel]),
    panel({ id: 'foot-panel', name: 'Piecero', role: 'side', normal: 'x', x: endAt(ref('furniture.x1')), y: endY, z: across }),
    ...(l.split
      ? [
          panel({ id: 'platform-left', name: 'Plataforma izquierda', ...platform, z: extent(ref('furniture.z0', middle), ref('furniture.z1')) }),
          panel({ id: 'platform-right', name: 'Plataforma derecha', ...platform, z: extent(ref('furniture.z0'), ref('furniture.z0', middle)) }),
        ]
      : [panel({ id: 'platform', name: 'Plataforma', ...platform, z: across })]),
    panel({ id: 'spine', name: 'Espina central', role: 'divider', normal: 'z', x: extent(ref(headEnd), ref('foot-panel.x0')), y: extent(frameY0, ref(l.under('left'))), z: startAt(ref('furniture.z0', middle - t / 2)), grain: 'length' }),
  ]
}

const SIDE_WORD = { left: 'izquierdo', right: 'derecho' } as const

/** Cross members over a closed stretch of a side, so the platform never spans more than it can. */
function crossMembers(l: Layout, side: Side, [from, to]: [number, number], span: number): Piece[] {
  const { t } = l
  const count = supportsAcross(to - from, t)
  const z = side === 'left' ? extent(ref('spine.z1'), ref(`side-${side}-${span}.z0`)) : extent(ref(`side-${side}-${span}.z1`), ref('spine.z0'))
  return Array.from({ length: count }, (_, i) => i + 1).map((k) =>
    l.panel({ id: `rail-${side}-${span}-${k}`, name: `Travesaño ${SIDE_WORD[side]} ${span}.${k}`, role: 'divider', normal: 'x', x: startAt(ref(l.headEnd, from + ((to - from) * k) / (count + 1) - t / 2)), y: extent(l.frameY0, ref(l.under(side))), z }),
  )
}

const faceOf = (side: Side) => (side === 'left' ? endAt(ref('furniture.z1')) : startAt(ref('furniture.z0')))

/** A side with no drawers: one closed rail, head to foot. */
function closedSide(l: Layout, side: Side): Piece[] {
  const rail = l.panel({ id: `side-${side}-1`, name: `Costado ${SIDE_WORD[side]}`, role: 'side', normal: 'z', z: faceOf(side), x: extent(ref(l.headEnd), ref('foot-panel.x0')), y: extent(l.frameY0, ref(l.under(side))), grain: 'length' })
  return [rail, ...crossMembers(l, side, [0, l.inner], 1)]
}

/** A side with drawers: each one between dividers over its own kick, and a closed rail over whatever length they leave free. */
function drawerSide(l: Layout, side: Side): { pieces: Piece[]; drawers: AddDrawer[] } {
  const { plan, panel, t, headEnd, inner } = l
  const label = SIDE_WORD[side]
  const faceZ = faceOf(side)
  const pieces: Piece[] = []
  const drawers: AddDrawer[] = []
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
  let dividers = 0
  const addDivider = (id: string, at: number) => {
    pieces.push(panel({ id, name: `Divisor ${label} ${dividers + 1}`, role: 'divider', normal: 'x', x: startAt(ref(headEnd, at)), y: extent(ref('furniture.y0'), ref(l.under(side))), z: side === 'left' ? extent(ref('spine.z1'), ref('furniture.z1')) : extent(ref('furniture.z0'), ref('spine.z0')) }))
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
    dividers++
    const bay = `${side}-${k}`
    pieces.push(panel({ id: `kick-${bay}`, name: `Zoclo ${label} ${k}`, role: 'kick', normal: 'z', z: faceZ, x: extent(ref(left), ref(right)), y: extent(ref('furniture.y0'), null, KICK_HEIGHT.bed), grain: 'length' }))
    drawers.push({
      op: 'addDrawer',
      group: `drawer-${side}-${k}`,
      name: `Cajón ${label} ${k}`,
      left,
      right,
      bottom: `kick-${bay}.y1`,
      top: l.under(side),
      front: side === 'left' ? 'furniture.z1' : 'furniture.z0',
      back: side === 'left' ? 'spine.z1' : 'spine.z0',
      material: plan.material,
      bottomMaterial: backBoard(l.catalog).id,
    })
    left = right === 'foot-panel.x0' ? left : `div-${side}-${k}.x1`
  }
  closedSpans.forEach(([from, to, start, end], i) => {
    pieces.push(panel({ id: `side-${side}-${i + 1}`, name: `Costado ${label} ${i + 1}`, role: 'side', normal: 'z', z: faceZ, x: extent(ref(from), ref(to)), y: extent(ref('furniture.y0'), ref(l.under(side))), grain: 'length' }))
    pieces.push(...crossMembers(l, side, [start, end], i + 1))
  })
  return { pieces, drawers }
}

export function buildBed(plan: BedPlan, catalog: Catalog): BuiltBed {
  const l = layoutOf(plan, catalog)
  const head = headboard(l)
  const opens = (side: Side) => plan.drawers.count > 0 && (plan.drawers.side === 'both' || plan.drawers.side === side)
  const sides = (['left', 'right'] as const).map((side) => (opens(side) ? drawerSide(l, side) : { pieces: closedSide(l, side), drawers: [] }))

  const design: Design = {
    schema: 1,
    name: plan.name,
    dimensions: { width: l.size.width, height: l.size.height, depth: l.size.length },
    wallAnchored: false,
    notes: '',
    pieces: [...head.pieces, ...base(l), ...sides.flatMap((s) => s.pieces), ...(l.lift > 0 ? legs(l) : [])],
    joints: [],
    kind: 'bed',
    mattress: plan.mattress,
  }
  const placed = addDrawers(design, sides.flatMap((s) => s.drawers), catalog)
  return { design: completeJoints(placed.design, catalog), notes: [...head.notes, ...placed.notes] }
}

function describeBedChanges(before: BedPlan, after: BedPlan): string[] {
  const changes: string[] = []
  if (before.mattress !== after.mattress) changes.push(BED_LABELS.mattress[after.mattress].phrase)
  if (before.height !== after.height) changes.push(`base de ${after.height} mm`)
  if (before.legs !== after.legs) changes.push(BED_LABELS.legs[after.legs].phrase)
  if (after.legs === 'legs' && before.legHeight !== after.legHeight) changes.push(`patas de ${after.legHeight} mm`)
  if (before.material !== after.material) changes.push(`material ${after.material}`)
  const [a, b] = [before.drawers, after.drawers]
  if (a.side !== b.side) changes.push(BED_LABELS.drawerSide[b.side].phrase)
  if (b.side !== 'none' && a.count !== b.count) changes.push(`${b.count} ${b.count === 1 ? 'cajón' : 'cajones'} por lado`)
  if (b.side !== 'none' && a.position !== b.position) changes.push(`cajones ${BED_LABELS.drawerPosition[b.position].phrase}`)
  const [h, k] = [before.headboard, after.headboard]
  if (h.style !== k.style) changes.push(BED_LABELS.headboard[k.style].phrase)
  if (k.style !== 'none' && h.height !== k.height) changes.push(`cabecera de ${k.height} mm`)
  if ((k.style === 'bookcase' || k.style === 'storage') && h.depth !== k.depth) changes.push(`cabecera de ${k.depth} mm de fondo`)
  if ((k.style === 'bookcase' || k.style === 'storage') && h.shelves !== k.shelves) changes.push(`${k.shelves} ${k.shelves === 1 ? 'repisa' : 'repisas'} en la cabecera`)
  return changes
}

function benchBeds(): [string, BedPlan][] {
  const variants: [string, BedPlan][] = []
  for (const mattress of MattressSize.options)
    for (const style of BedPlan.shape.headboard.shape.style.options)
      for (const side of BedPlan.shape.drawers.shape.side.options)
        for (const position of BedPlan.shape.drawers.shape.position.options) {
          if (side === 'none' && position !== 'head') continue
          const drawers = side === 'none' ? BED_LABELS.drawerSide.none.phrase : `${BED_LABELS.drawerSide[side].phrase} ${BED_LABELS.drawerPosition[position].phrase}`
          variants.push([
            `${mattress}, ${BED_LABELS.headboard[style].phrase}, ${drawers}`,
            { kind: 'bed', name: 'Cama', mattress, material: 'T18', height: 400, legs: 'none', legHeight: LEG_HEIGHT, drawers: { side, count: side === 'none' ? 0 : 3, position }, headboard: { style, height: 1100, depth: 250, shelves: 2 } },
          ])
        }
  const base: BedPlan = { kind: 'bed', name: 'Cama', mattress: 'matrimonial', material: 'T18', height: 400, legs: 'legs', legHeight: LEG_HEIGHT, drawers: { side: 'none', count: 0, position: 'head' }, headboard: { style: 'plain', height: 1100, depth: 250, shelves: 2 } }
  for (const mattress of MattressSize.options)
    for (const legHeight of [LEG_HEIGHT_RANGE.min, LEG_HEIGHT, LEG_HEIGHT_RANGE.max])
      variants.push([`${mattress}, cabecera lisa, patas de ${legHeight} mm`, { ...base, mattress, legHeight, height: legHeight + 250 }])
  for (const style of BedPlan.shape.headboard.shape.style.options.filter((s) => s !== 'plain'))
    variants.push([`matrimonial, ${BED_LABELS.headboard[style].phrase}, patas de ${LEG_HEIGHT} mm`, { ...base, headboard: { ...base.headboard, style } }])
  return variants
}

const deepHeadboard = (plan: BedPlan) => plan.headboard.style === 'bookcase' || plan.headboard.style === 'storage'
const withDrawers = (plan: BedPlan, drawers: Partial<BedPlan['drawers']>): BedPlan => ({ ...plan, drawers: { ...plan.drawers, ...drawers } })
const withHeadboard = (plan: BedPlan, headboard: Partial<BedPlan['headboard']>): BedPlan => ({ ...plan, headboard: { ...plan.headboard, ...headboard } })

/** A bed's plan: the mattress sets its size; the base, its drawers and the headboard are choices. */
const bedFields: FieldSpec<BedPlan>[] = [
  section('Colchón y base', [
    choice({ key: 'mattress', label: 'Colchón', lockedByDefault: true, ...fromLabels(BED_LABELS.mattress), get: (p) => p.mattress, set: (p, mattress) => ({ ...p, mattress }) }),
    note('El largo y el ancho de la cama salen del colchón, con 2 cm de holgura para meterlo y sacarlo.'),
    numbers(2, [number({ key: 'height', label: 'Alto de la base', get: (p) => p.height, set: (p, height) => ({ ...p, height }) })]),
    material({ key: 'material', label: 'Triplay', use: 'carcass', get: (p) => p.material, set: (p, material) => ({ ...p, material }) }),
    note('Con cajones la cama no lleva patas: el zoclo sostiene el banco de cajones.', hasDrawers),
    choice({ key: 'legs', label: 'Patas', part: 'Patas', ...fromLabels(BED_LABELS.legs), visibleWhen: (p) => !hasDrawers(p), get: (p) => p.legs, set: (p, legs) => ({ ...p, legs }) }),
    numbers(2, [number({ key: 'legHeight', label: 'Alto de las patas', part: 'Patas', min: LEG_HEIGHT_RANGE.min, max: LEG_HEIGHT_RANGE.max, get: (p) => p.legHeight, set: (p, legHeight) => ({ ...p, legHeight }) })], (p) => p.legs === 'legs' && !hasDrawers(p)),
  ]),
  section('Cajones', [
    note('Los lados se ven desde el pie de la cama.'),
    choice({
      key: 'drawers.side',
      label: 'Lado',
      ariaLabel: 'Lado de los cajones',
      ...fromLabels(BED_LABELS.drawerSide),
      get: (p) => p.drawers.side,
      // Choosing a side puts at least one drawer on it.
      set: (p, side) => ({ ...withDrawers(p, { side, count: side === 'none' ? p.drawers.count : Math.max(1, p.drawers.count) }), legs: side === 'none' ? p.legs : 'none' }),
    }),
    stepper({ key: 'drawers.count', label: 'Por lado', ariaLabel: 'cajones por lado', min: 1, max: MAX_DRAWERS_PER_SIDE, visibleWhen: (p) => p.drawers.side !== 'none', get: (p) => p.drawers.count, set: (p, count) => withDrawers(p, { count }) }),
    choice({ key: 'drawers.position', label: 'Se juntan hacia', ariaLabel: 'Hacia dónde se juntan', ...fromLabels(BED_LABELS.drawerPosition), visibleWhen: (p) => p.drawers.side !== 'none', get: (p) => p.drawers.position, set: (p, position) => withDrawers(p, { position }) }),
  ]),
  section('Cabecera', [
    choice({ key: 'headboard.style', label: 'Tipo', ariaLabel: 'Tipo de cabecera', ...fromLabels(BED_LABELS.headboard), get: (p) => p.headboard.style, set: (p, style) => withHeadboard(p, { style }) }),
    note('Un espacio cerrado a la altura de la almohada y repisas arriba.', (p) => p.headboard.style === 'storage'),
    numbers(
      2,
      [
        number({ key: 'headboard.height', label: 'Alto desde el piso', get: (p) => p.headboard.height, set: (p, height) => withHeadboard(p, { height }) }),
        number({ key: 'headboard.depth', label: 'Fondo', visibleWhen: deepHeadboard, get: (p) => p.headboard.depth, set: (p, depth) => withHeadboard(p, { depth }) }),
      ],
      (p) => p.headboard.style !== 'none',
    ),
    stepper({ key: 'headboard.shelves', label: 'Repisas', ariaLabel: 'repisas de la cabecera', min: 0, max: 4, visibleWhen: deepHeadboard, get: (p) => p.headboard.shelves, set: (p, shelves) => withHeadboard(p, { shelves }) }),
  ]),
]

/** A bed has no outside measures of its own: they come from the mattress, which is its first part. */
const BED_PARTS: Parts<BedPlan> = {
  list: [
    { id: 'mattress', name: 'Colchón', side: 'outside', fields: ['mattress', 'height'], joints: [], summary: (p) => `${BED_LABELS.mattress[p.mattress].option}, base de ${p.height} mm de alto` },
    woodPart(),
    {
      id: 'base',
      name: 'Base',
      side: 'outside',
      fields: ['legs', 'legHeight'],
      joints: ['body', 'base'],
      summary: (p) => (hasDrawers(p) ? 'Sobre el zoclo de los cajones' : p.legs === 'legs' ? `Sobre patas de ${p.legHeight} mm` : 'Directo en el piso'),
    },
    {
      id: 'drawers',
      name: 'Cajones',
      side: 'outside',
      fields: ['drawers.side', 'drawers.count', 'drawers.position'],
      joints: ['drawers'],
      summary: (p) => (hasDrawers(p) ? `${counted(p.drawers.count, 'cajón', 'cajones')} por lado, ${BED_LABELS.drawerSide[p.drawers.side].phrase.replace('cajones ', '')}` : 'Sin cajones'),
    },
    {
      id: 'headboard',
      name: 'Cabecera',
      side: 'outside',
      fields: ['headboard.style', 'headboard.height', 'headboard.depth', 'headboard.shelves'],
      joints: ['back'],
      summary: (p) => (p.headboard.style === 'none' ? 'Sin cabecera' : `${BED_LABELS.headboard[p.headboard.style].option}, de ${p.headboard.height} mm desde el piso`),
    },
  ],
  ofPiece(piece) {
    if (piece.id.startsWith('head')) return 'headboard'
    if (piece.role.startsWith('drawer-') || /^(div|kick)-(left|right)/.test(piece.id)) return 'drawers'
    if (piece.id.startsWith('platform')) return 'mattress'
    return 'base'
  },
}

export const bedModule: FurnitureModule<BedPlan> = {
  kind: 'bed',
  schema: BedPlan,
  rules: [
    { holds: frameFits, message: FRAME_TOO_LOW, path: ['legHeight'] },
    { holds: (plan) => plan.legs !== 'legs' || !hasDrawers(plan), message: LEGS_WITH_DRAWERS, path: ['legs'] },
  ],
  label: 'una cama',
  expert: { what: 'a bed (a base with or without drawers, and a headboard)' },
  build: buildBed,
  describeChanges: describeBedChanges,
  // Its length and width come from the mattress; its height is the headboard's, or the base's without one.
  resize: (plan, axis, value) =>
    axis !== 'y'
      ? { ok: false, message: 'El largo y el ancho de la cama salen del colchón: cambia el colchón en la ficha.' }
      : { ok: true, plan: plan.headboard.style === 'none' ? { ...plan, height: value } : { ...plan, headboard: { ...plan.headboard, height: value } } },
  // Its measures come from the mattress, not from the ones the person gave.
  withMeasures: (plan) => plan,
  // Along x runs its length: it reads as its width by its length.
  summary: (plan, { width, depth }) => `${cm(depth)} × ${cm(width)} · ${BED_LABELS.mattress[plan.mattress].phrase}`,
  measuresNote: (plan, { width, height, depth }) => `Las medidas salen del ${BED_LABELS.mattress[plan.mattress].phrase}: la cama mide ${depth / 10} × ${width / 10} cm${plan.headboard.style === 'none' ? '' : `, y ${height / 10} cm de alto con la cabecera`}.`,
  traceLabel: (plan) => `Cama ${plan.mattress}`,
  benchVariants: benchBeds,
  fields: bedFields,
  parts: BED_PARTS,
}
