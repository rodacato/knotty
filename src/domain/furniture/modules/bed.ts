import { z } from 'zod'
import { startAt, partway, endAt, ref, extent, makeJoint } from '../../design/builders'
import { Pulls, type Extent, type FaceRef, type Design, type Joint, type Piece, type Position } from '../../design/schema'
import { MATTRESSES, MattressSize } from '../../design/kind'
import { completeJoints, hardwareFor } from '../../design/joints'
import { resolveGeometry, type Geometry } from '../../design/resolve'
import { CONTACT_TOLERANCE, overlap } from '../../design/boxes'
import { backBoard, type Catalog } from '../../materials/catalog'
import { pocketScrewId } from '../../assumptions'
import { Assembly, assemblyFields, assemblyPart, describeAssembly, knockDown } from './assembly'
import { describeLegStyle, LEG_STYLE, LEG_STYLE_LABELS, LegStyle, legStyleField, legStyleNote, styled, styledLegs } from './legs'
import { addDrawers, ARM_FRONT, ARM_SLOPE, CAP_OVERHANG, cm, DEFAULT_THICKNESS, KICK_HEIGHT, LEG_HEIGHT, LEG_HEIGHT_RANGE, LEG_WIDTH, legLayers, LEDGER, MATTRESS_LIP, MAX_SPAN, SLAT, SLAT_PLAY, SLAT_RAIL, SLAT_RECESS, SLAT_SPAN, MIN_CARCASS_HEIGHT, panelOf, supportsAcross, thicknessOf, type AddDrawer } from './common'
import { choice, fromLabels, material, note, number, numbers, section, stepper, yesNo, type FieldSpec } from './fields'
import { DEFAULT_FINGERS, FINGERS_RANGE, fingerDrawers, fingerDrawersNote, withFingerBoxes, withFingerCuts } from './fingerJoints'
import { notchNote, withFrontCuts } from './fronts'
import type { FurnitureModule, Labels } from './module'
import { counted, woodPart, type Parts } from './parts'
import { FRONT_GAP } from '../../editing/operations/drawer'

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
  legStyle: LegStyle.optional().describe(LEG_STYLE),
  drawers: z.object({
    side: z.enum(['none', 'left', 'right', 'both']).describe('Which side they open on, seen from the foot of the bed: none, left, right or both'),
    count: z.number().int().min(0).max(MAX_DRAWERS_PER_SIDE).describe('How many drawers per side; 0 if there are none'),
    position: z.enum(['head', 'center', 'foot']).describe('If they do not fill the whole length, where they gather: head, center or foot'),
    mount: z.enum(['inset', 'overlay']).optional().describe('overlay: fronts cover the dividers'),
    style: z.enum(['flat', 'grooved']).optional(),
    pulls: Pulls.optional(),
    corners: z.enum(['screwed', 'fingers']).optional().describe('Of the drawer boxes'),
    fingers: z.number().int().min(FINGERS_RANGE.min).max(FINGERS_RANGE.max).optional().describe(`Per corner; default ${DEFAULT_FINGERS}`),
  }),
  headboard: z.object({
    style: z.enum(['none', 'plain', 'bookcase', 'storage', 'daybed']).describe('none: no headboard; plain: a flat board; bookcase: a bookcase with shelves; storage: a closed compartment at pillow height with shelves above; daybed: a sofa by day, a backrest along the side without drawers and an arm at each end, all as high as the headboard, with no legs'),
    height: z.number().positive().describe('Total headboard height from the floor in mm; usually 900–1200'),
    depth: z.number().nonnegative().describe('Depth of the bookcase or compartment in mm; usually 200–300. It does not count for a plain headboard or none: 0'),
    shelves: z.number().int().nonnegative().describe('Shelves in the bookcase or above the compartment'),
    cap: z.boolean().optional().describe('A cap board on top'),
    arms: z.enum(['square', 'sloped']).optional().describe('Daybed arms: square (default), or sloped, the top front corner sawn off'),
  }),
  platform: z.enum(['panel', 'slats']).optional().describe('Under the mattress: panel (default), a plywood board; slats, boards across the bed, screwed down'),
  lip: z.boolean().optional().describe('A lip that keeps the mattress in'),
  assembly: Assembly.optional().describe('glued (default); bolts or cams: no glue, comes apart to move'),
})
export type BedPlan = z.infer<typeof BedPlan>

const hasDrawers = (plan: BedPlan) => plan.drawers.side !== 'none' && plan.drawers.count > 0
/** The legs take height from the frame above them: what is left must still hold the platform and its rails. */
const frameFits = (plan: BedPlan) => plan.legs !== 'legs' || plan.height - plan.legHeight >= MIN_CARCASS_HEIGHT
/** Over the base, a bookcase or storage headboard holds its floor and top, the compartment, the cap, and each shelf with a gap no thinner than it. */
const headboardRoom = (plan: BedPlan) => (plan.headboard.style === 'storage' ? COMPARTMENT : 0) + (2 + (plan.headboard.cap ? 1 : 0) + 2 * plan.headboard.shelves) * DEFAULT_THICKNESS
const headboardFits = (plan: BedPlan) => (plan.headboard.style !== 'bookcase' && plan.headboard.style !== 'storage') || plan.headboard.height - plan.height >= headboardRoom(plan)
const HEADBOARD_TOO_LOW = 'No cupo: la cabecera queda muy baja para lo que lleva arriba de la base; súbela, quítale repisas o hazla lisa.'
const FRAME_TOO_LOW = `No cupo: con esas patas el marco de la cama queda de menos de ${MIN_CARCASS_HEIGHT} mm; baja las patas o sube el alto de la base.`
const LEGS_WITH_DRAWERS = 'No cupo: una cama con cajones no lleva patas, el zoclo sostiene el banco de cajones.'
const DAYBED_DRAWERS = 'No cupo: una cama de día lleva el respaldo del lado sin cajones; pon los cajones de un solo lado.'
const DAYBED_LEGS = 'No cupo: una cama de día no lleva patas, los brazos y el respaldo llegan al piso.'
const isDaybed = (plan: BedPlan) => plan.headboard.style === 'daybed'
/** The side the backrest of a daybed goes on: the one without drawers, the right when neither has them. */
const backSide = (plan: BedPlan): 'left' | 'right' => (plan.drawers.side === 'right' && plan.drawers.count > 0 ? 'left' : 'right')

type Edge = 'left' | 'right' | 'head' | 'foot'
/** The edges of the platform the mattress could slide off: those no headboard, arm or backrest closes. */
function lipEdges(plan: BedPlan): Edge[] {
  if (!plan.lip) return []
  if (isDaybed(plan)) return [backSide(plan) === 'left' ? 'right' : 'left']
  return plan.headboard.style === 'none' ? ['left', 'right', 'head', 'foot'] : ['left', 'right', 'foot']
}
/** How the drawers are built, with what an absent choice means. */
const drawerBuild = ({ drawers: d }: BedPlan) => ({ mount: d.mount ?? 'inset', style: d.style ?? 'flat', pulls: d.pulls ?? 'none', corners: d.corners ?? 'screwed', fingers: d.fingers ?? DEFAULT_FINGERS })

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
    daybed: { option: 'De día', phrase: 'respaldo y brazos de cama de día' },
  } satisfies Labels<BedPlan['headboard']['style']>,
  platform: {
    panel: { option: 'Tablero', phrase: 'base de tablero' },
    slats: { option: 'Tablillas', phrase: 'base de tablillas' },
  } satisfies Labels<NonNullable<BedPlan['platform']>>,
  arms: {
    square: { option: 'Rectos', phrase: 'brazos rectos' },
    sloped: { option: 'En diagonal', phrase: 'brazos con el frente en diagonal' },
  } satisfies Labels<NonNullable<BedPlan['headboard']['arms']>>,
  drawerMount: {
    inset: { option: 'Embutidos', phrase: 'frentes embutidos' },
    overlay: { option: 'Sobrepuestos', phrase: 'frentes sobrepuestos' },
  } satisfies Labels<NonNullable<BedPlan['drawers']['mount']>>,
  drawerStyle: {
    flat: { option: 'Lisos', phrase: 'frentes lisos' },
    grooved: { option: 'Ranurados', phrase: 'frentes ranurados' },
  } satisfies Labels<NonNullable<BedPlan['drawers']['style']>>,
  pulls: {
    none: { option: 'Ninguna', phrase: 'sin jaladeras' },
    notch: { option: 'Muesca', phrase: 'muesca para abrir' },
    handle: { option: 'Jaladera', phrase: 'con jaladeras' },
  } satisfies Labels<Pulls>,
  drawerCorners: {
    screwed: { option: 'Atornilladas', phrase: 'esquinas del cajón atornilladas' },
    fingers: { option: 'De dedos', phrase: 'esquinas del cajón de dedos' },
  } satisfies Labels<NonNullable<BedPlan['drawers']['corners']>>,
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
const headboardDepth = (plan: BedPlan, t: number) => (plan.headboard.style === 'none' ? 0 : plan.headboard.style === 'plain' || plan.headboard.style === 'daybed' ? t : plan.headboard.depth || HEADBOARD_DEPTH)

/** Outer measures from the mattress, the base and the headboard, as the furniture's width (x), height and depth (z). */
// A lip stands on the platform and a daybed's backrest beside it: each takes its thickness out of the mattress's room, so the bed grows by it.
function bedSize(plan: BedPlan, t: number): BedSize {
  const [mw, ml] = MATTRESSES[plan.mattress]
  const lips = lipEdges(plan)
  const atEnds = lips.filter((e) => e === 'head' || e === 'foot').length
  const alongSides = lips.length - atEnds + (isDaybed(plan) ? 1 : 0)
  return {
    width: headboardDepth(plan, t) + ml + MATTRESS_PLAY + t + atEnds * t,
    length: mw + MATTRESS_PLAY + alongSides * t,
    height: Math.max(plan.height + (lips.length ? MATTRESS_LIP : 0), plan.headboard.style === 'none' ? 0 : plan.headboard.height),
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
  const slatted = plan.platform === 'slats'
  // A slat runs the whole width in one piece, along the sheet: only a panel has to be split.
  const split = !slatted && size.length > ONE_SHEET
  const flat = style === 'plain' || style === 'daybed'
  const headEnd: FaceRef = flat ? 'headboard.x1' : 'head-panel.x1'
  const daybed = style === 'daybed'
  const lips = lipEdges(plan)
  // The cap sits over the headboard's boards and reaches over the platform: it has to clear the lips there.
  const capFits = plan.headboard.height - t >= plan.height + (lips.length ? MATTRESS_LIP : 0)
  const capped = !!plan.headboard.cap && style !== 'none' && capFits
  // The slope of a daybed's arms comes down only as far as leaves its front whole over the lip.
  const armRoom = plan.headboard.height - (capped ? t : 0) - plan.height - (plan.lip ? MATTRESS_LIP : 0) - ARM_FRONT
  const slope = daybed && plan.headboard.arms === 'sloped' && armRoom > 0 ? { run: ARM_SLOPE.run, drop: Math.min(ARM_SLOPE.drop, armRoom) } : null
  return {
    plan,
    catalog,
    t,
    size,
    hd,
    panel: panelOf(plan.material),
    style,
    deep,
    flat,
    daybed,
    back: backSide(plan),
    /** The board at the foot: a daybed's arm, or the base's foot end. */
    foot: daybed ? 'foot-arm' : 'foot-panel',
    lips,
    capped,
    capMissed: !!plan.headboard.cap && style !== 'none' && !capFits,
    slope,
    /** Where the boards of the headboard, the arms and the backrest end: under the cap, or at the top. */
    top: ref('furniture.y1', capped ? -t : 0),
    drawers: drawerBuild(plan),
    lift,
    // The frame stands on its legs: its pieces start where they end, the platform stays where the mattress rests.
    frameY0: ref('furniture.y0', lift),
    /** Where the base starts, past the headboard. */
    headEnd,
    slatted,
    /** Where the boards around the base end at the top: under a panel, which lies over them; level with where the mattress rests around slats, which sit between them. */
    rim: (edge: Edge): Position => (slatted ? ref('furniture.y0', plan.height + (lips.includes(edge) ? MATTRESS_LIP : 0)) : ref(split ? `platform-${edge === 'right' ? 'right' : 'left'}.y0` : 'platform.y0')),
    /** How far in from the face of a side its slats' ends are: past the board that closes it, which overlay fronts push back by their own thickness. */
    inset: (side: Side) => t + (drawerBuild(plan).mount === 'overlay' && plan.drawers.count > 0 && (plan.drawers.side === 'both' || plan.drawers.side === side) ? t : 0),
    /** A slat that would run further than it can between the spine and a side gets a rail halfway. */
    runners: slatted && (size.length - 3 * t) / 2 > SLAT_SPAN,
    /** Past one sheet across, the platform goes in two halves over the spine. */
    split,
    middle: size.length / 2,
    /** The face of the platform a piece of that side stands under. */
    under: (side: Side): FaceRef => (slatted ? 'slat-1.y0' : split ? `platform-${side}.y0` : 'platform.y0'),
    /** The length inside the base, between its head and foot ends. */
    inner: size.width - hd - t - (flat ? 0 : deep ? 0 : t),
  }
}
type Layout = ReturnType<typeof layoutOf>

/** The cross members of a side a middle leg stands next to: spread along the bed, never two at the same one. */
function legRails(l: Layout): number[] {
  const rails = supportsAcross(l.inner, l.t)
  const n = Math.min(supportsAcross(l.size.width - 4 * l.t - Math.max(l.hd, l.t), 2 * l.t), rails)
  let taken = 0
  return Array.from({ length: n }, (_, i) => {
    const wanted = (i + 1) / (n + 1)
    const nearest = Array.from({ length: rails }, (_, j) => j + 1).reduce((best, j) => (Math.abs(wanted - j / (rails + 1)) < Math.abs(wanted - best / (rails + 1)) ? j : best), 1)
    return (taken = Math.max(nearest, taken + 1))
  })
}

/** Legs stand inside the frame, floor to platform, against the faces they are screwed to: one screwed only to a lower edge swings like a hinge (estructura.md §2.1). */
function legs(l: Layout): Piece[] {
  const { headEnd, plan } = l
  const pieces: Piece[] = []
  const sides = [
    ['left', 'izquierda', extent(null, ref('side-left-1.z0'), LEG_WIDTH), 'start'],
    ['right', 'derecha', extent(ref('side-right-1.z1'), null, LEG_WIDTH), 'end'],
  ] as const
  // Only what shows under the frame is tapered: above it the leg is face to face with the boards it is screwed to.
  const inFrame = plan.height - (l.slatted ? SLAT_RECESS : l.t) - plan.legHeight
  const middle = legRails(l)
  for (const [side, words, z, inner] of sides) {
    const y = extent(ref('furniture.y0'), ref(l.under(side)))
    const leg = (id: string, name: string, first: Extent, towards: 'right' | 'left') => pieces.push(...styled(legLayers(plan.material, id, name, first, towards, y, z), plan.legStyle, inner, inFrame))
    leg(`leg-head-${side}`, `Pata de la cabecera ${words}`, startAt(ref(headEnd)), 'right')
    leg(`leg-foot-${side}`, `Pata del pie ${words}`, endAt(ref(`${l.foot}.x0`)), 'left')
    middle.forEach((rail, i) => leg(`leg-middle-${side}-${i + 1}`, `Pata intermedia ${words} ${middle.length > 1 ? `${i + 1} ` : ''}`.trim(), startAt(ref(`rail-${side}-1-${rail}.x1`)), 'right'))
  }
  return pieces
}

/** A daybed's arm with its top front corner sawn off, the front being the side its backrest is not on. */
const armSlants = (l: Layout): Pick<Piece, 'slants'> => (l.slope ? { slants: [{ x: null, y: { from: 'end', length: l.slope.drop }, z: { from: l.back === 'right' ? 'end' : 'start', length: l.slope.run } }] } : {})
/** The cap of an arm stops where the slope starts. */
const armCapZ = (l: Layout): Extent => {
  const run = l.slope?.run ?? 0
  return l.back === 'right' ? extent(ref('furniture.z0'), ref('furniture.z1', -run)) : extent(ref('furniture.z0', run), ref('furniture.z1'))
}
const slopeNotes = (l: Layout): string[] =>
  l.slope
    ? [`Brazos con el frente en diagonal: a cada brazo se le corta la esquina de arriba al frente, ${l.slope.run} mm a lo largo y ${l.slope.drop} mm hacia abajo, con sierra circular y guía. La maderería entrega el rectángulo${l.capped ? ', y el copete del brazo llega hasta donde empieza el corte' : ''}.`]
    : l.daybed && l.plan.headboard.arms === 'sloped'
      ? ['Los brazos son muy bajos para cortarles el frente en diagonal: quedan rectos. Sube el respaldo.']
      : []

/** The headboard: a plain board, or a shallow box open toward the mattress, with shelves and, for storage, a closed compartment at pillow height. */
function headboard(l: Layout): { pieces: Piece[]; notes: string[] } {
  const { plan, t, hd, style } = l
  // The headboard is its own part: its floor is level with the platform but is not where the mattress goes.
  const panel = (p: Parameters<typeof l.panel>[0]) => l.panel({ group: 'headboard', ...p })
  const whole = { y: extent(ref('furniture.y0'), l.top) }
  const capNotes = l.capMissed ? ['La cabecera es muy baja para el copete: queda a la altura del colchón. Súbela o quítale el copete.'] : []
  const fullWidth = extent(ref('furniture.z0'), ref('furniture.z1'))
  const cap = (reach: number): Piece[] => (l.capped ? [panel({ id: 'head-cap', name: l.daybed ? 'Copete del brazo de la cabecera' : 'Copete de la cabecera', role: 'top', normal: 'y', x: extent(ref('furniture.x0'), ref('furniture.x0', reach + CAP_OVERHANG)), y: endAt(ref('furniture.y1')), z: l.daybed ? armCapZ(l) : fullWidth, grain: 'length', edges: ['front', 'back', 'right'] })] : [])
  if (l.flat) return { pieces: [panel({ id: 'headboard', name: l.daybed ? 'Brazo de la cabecera' : 'Cabecera', role: 'side', normal: 'x', x: startAt(ref('furniture.x0')), ...whole, z: fullWidth, grain: 'length', ...armSlants(l) }), ...cap(t)], notes: [...capNotes, ...slopeNotes(l)] }
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
      panel({ id: 'head-top', name: 'Techo de la cabecera', role: 'top', normal: 'y', x: inside, y: endAt(l.top), z: between }),
      panel({ id: 'head-bottom', name: 'Piso de la cabecera', role: 'bottom', normal: 'y', x: inner, y: endAt(ref('furniture.y0', plan.height)), z: between, load: 'medium' }),
      ...(storage ? compartment : []),
      ...Array.from({ length: n }, (_, i) => i + 1).map((k) =>
        panel({ id: `head-shelf-${k}`, name: `Repisa ${k} de la cabecera`, role: 'shelf', normal: 'y', x: inside, y: startAt(partway(shelfFloor, 'head-top.y0', k / (n + 1), -t / 2)), z: between, load: 'medium', support: 'fixed' }),
      ),
      ...cap(hd),
    ],
    notes: [...(storage && plan.headboard.height - plan.height < COMPARTMENT + (l.capped ? 3 : 2) * t ? ['La cabecera es baja para un compartimento arriba de la base: súbela o hazla librero.'] : []), ...capNotes],
  }
}

/** Where each slat starts along the bed, from its head: one against each end board, and as many between as keep every gap within the widest. */
function slatsAt(l: Layout): number[] {
  const { size, deep, hd, t } = l
  const from = deep ? hd : t
  const run = size.width - t - from - SLAT.width
  const steps = Math.ceil(run / (SLAT.width + SLAT.gap))
  return Array.from({ length: steps + 1 }, (_, k) => from + (run * k) / steps)
}

/** What a base of slats says to whoever builds it: how many, how far apart, what they rest on and where they are screwed. */
function slatNotes(l: Layout): string[] {
  if (!l.slatted) return []
  const at = slatsAt(l)
  const gap = Math.round(at[1] - at[0] - SLAT.width)
  return [
    `Base de ${at.length} tablillas de ${SLAT.width} mm de ancho, con ${gap} mm de hueco entre una y otra. Van embutidas entre los costados, ${SLAT_RECESS} mm abajo de su canto, sobre un listón de ${LEDGER.layers} capas pegado y atornillado por dentro; cada una es ${2 * SLAT_PLAY} mm más corta que el hueco, que se mide con la base ya armada, y se atornilla a la espina, nunca va suelta. Se cortan con la veta a lo largo de la tablilla.${l.runners ? ' Como la cama es ancha, llevan un larguero a media distancia de cada lado.' : ''}${hasDrawers(l.plan) ? ' Sobre los cajones el listón va en un larguero corrido, y entre las tablillas cae polvo a los cajones.' : ''}${l.lips.length ? ` El tope del colchón son las mismas tablas de la base, que suben ${MATTRESS_LIP} mm más.` : ''}`,
  ]
}

/** The base: head and foot ends, the platform on top and a spine down the middle. */
function base(l: Layout): Piece[] {
  const { plan, panel, t, hd, style, deep, frameY0, headEnd, middle, foot } = l
  // Around slats the ends rise to where the mattress rests, and past it where they are its lip; a headboard with shelves keeps its own floor over the head end.
  const endY = (edge: Edge, rises = l.slatted) => extent(frameY0, rises ? l.rim(edge) : ref('furniture.y0', plan.height - t))
  const across = extent(ref('furniture.z0'), ref('furniture.z1'))
  // A daybed's platform sits inside its backrest and arms; any other platform lies over the base's ends and sides.
  const zFrom: Position = l.daybed && l.back === 'right' ? ref('side-right-1.z1') : ref('furniture.z0')
  const zTo: Position = l.daybed && l.back === 'left' ? ref('side-left-1.z0') : ref('furniture.z1')
  const headPanel = panel({ id: 'head-panel', name: 'Cabecero de la base', role: 'side', normal: 'x', x: deep ? endAt(ref('furniture.x0', hd)) : startAt(ref('furniture.x0')), y: endY('head', l.slatted && !deep), z: deep ? extent(ref('head-side-right.z1'), ref('head-side-left.z0')) : across })
  const platform = { role: 'bottom', normal: 'y', x: extent(ref(style === 'none' ? 'head-panel.x0' : headEnd), ref(l.daybed ? 'foot-arm.x0' : 'furniture.x1')), y: endAt(ref('furniture.y0', plan.height)), load: 'heavy', grain: 'length' } as const
  return [
    ...(l.flat ? [] : [headPanel]),
    l.daybed
      ? panel({ id: 'foot-arm', name: 'Brazo del pie', role: 'side', normal: 'x', x: endAt(ref('furniture.x1')), y: extent(ref('furniture.y0'), l.top), z: across, grain: 'length', ...armSlants(l) })
      : panel({ id: 'foot-panel', name: 'Piecero', role: 'side', normal: 'x', x: endAt(ref('furniture.x1')), y: endY('foot'), z: across }),
    ...(l.slatted
      ? slatsAt(l).map((at, k) =>
          panel({ id: `slat-${k + 1}`, name: `Tablilla ${k + 1}`, ...platform, x: extent(ref('furniture.x0', at), null, SLAT.width), y: endAt(ref('furniture.y0', plan.height - SLAT_RECESS + t)), z: extent(ref('furniture.z0', l.inset('right') + SLAT_PLAY), ref('furniture.z1', -l.inset('left') - SLAT_PLAY)), edges: [] }),
        )
      : l.split
        ? [
            panel({ id: 'platform-left', name: 'Plataforma izquierda', ...platform, z: extent(ref('furniture.z0', middle), zTo) }),
            panel({ id: 'platform-right', name: 'Plataforma derecha', ...platform, z: extent(zFrom, ref('furniture.z0', middle)) }),
          ]
        : [panel({ id: 'platform', name: 'Plataforma', ...platform, z: extent(zFrom, zTo) })]),
    panel({ id: 'spine', name: 'Espina central', role: 'divider', normal: 'z', x: extent(ref(headEnd), ref(`${foot}.x0`)), y: extent(frameY0, ref(l.under('left'))), z: startAt(ref('furniture.z0', middle - t / 2)), grain: 'length' }),
  ]
}

const SIDE_WORD = { left: 'izquierdo', right: 'derecho' } as const

/** Above the platform: a lip on each open edge, the side ones running the whole length; a daybed's caps on its foot arm and backrest. */
function trim(l: Layout): Piece[] {
  const { plan } = l
  const has = (e: Edge) => l.lips.includes(e)
  const y = extent(ref('furniture.y0', plan.height), null, MATTRESS_LIP)
  const along = extent(ref(plan.headboard.style === 'none' ? 'furniture.x0' : l.headEnd), ref(l.daybed ? 'foot-arm.x0' : 'furniture.x1'))
  const between = extent(ref(has('right') ? 'lip-right.z1' : 'furniture.z0'), ref(has('left') ? 'lip-left.z0' : 'furniture.z1'))
  const lip = (id: string, name: string, at: Pick<Piece, 'normal' | 'x' | 'z'>) => l.panel({ id, name: `Tope del colchón ${name}`, role: 'brace', ...at, y, grain: 'length', edges: ['top'] })
  // Around slats the boards of the base rise to be the lip themselves: there is no platform for a strip to stand on.
  const lips = l.slatted ? [] : [
    ...(has('left') ? [lip('lip-left', 'izquierdo', { normal: 'z', x: along, z: faceOf('left') })] : []),
    ...(has('right') ? [lip('lip-right', 'derecho', { normal: 'z', x: along, z: faceOf('right') })] : []),
    ...(has('head') ? [lip('lip-head', 'de la cabecera', { normal: 'x', x: startAt(ref('furniture.x0')), z: between })] : []),
    ...(has('foot') ? [lip('lip-foot', 'del pie', { normal: 'x', x: endAt(ref('furniture.x1')), z: between })] : []),
  ]
  if (!l.daybed || !l.capped) return lips
  const backrest = `side-${l.back}-1`
  const panel = (p: Pick<Piece, 'id' | 'name' | 'x' | 'z' | 'edges'>) => l.panel({ group: 'headboard', role: 'top', normal: 'y', y: endAt(ref('furniture.y1')), grain: 'length', ...p })
  return [
    ...lips,
    panel({ id: 'foot-cap', name: 'Copete del brazo del pie', x: extent(ref('foot-arm.x0', -CAP_OVERHANG), ref('furniture.x1')), z: armCapZ(l), edges: ['front', 'back', 'left'] }),
    panel({
      id: 'back-cap',
      name: 'Copete del respaldo',
      x: extent(ref('head-cap.x1'), ref('foot-cap.x0')),
      z: l.back === 'left' ? extent(ref(`${backrest}.z0`, -CAP_OVERHANG), ref('furniture.z1')) : extent(ref('furniture.z0'), ref(`${backrest}.z1`, CAP_OVERHANG)),
      edges: [l.back === 'left' ? 'back' : 'front'],
    }),
  ]
}

/** A rail under the slats, between the boards that close it at each end: `drop` under their lower face, or from the rim of the base down. */
const slatRail = (l: Layout, side: Side, id: string, name: string, from: FaceRef, to: FaceRef, z: Extent, y: Extent = extent(null, ref(l.under(side)), SLAT_RAIL)): Piece =>
  l.panel({ id, name, role: 'brace', normal: 'z', x: extent(ref(from), ref(to)), y, z, grain: 'length', edges: [] })

/** The rail halfway between the spine and the outer board of a side, in a stretch of a wide bed. */
const slatRunner = (l: Layout, side: Side, stretch: string, from: FaceRef, to: FaceRef, outer: FaceRef): Piece[] =>
  l.runners ? [slatRail(l, side, `slat-runner-${stretch}`, `Larguero intermedio ${SIDE_WORD[side]} ${stretch.replace(/^(left|right)-?/, '')}`.trim(), from, to, startAt(partway(side === 'left' ? 'spine.z1' : 'spine.z0', outer, 0.5, -l.t / 2)))] : []

/** The ledger the slats' ends rest on, along the inner face of the board that closes a stretch of a side: boards face to face, and one more where that board stands further out than the slats reach. */
function ledger(l: Layout, side: Side, stretch: string, from: FaceRef, to: FaceRef, outer: FaceRef, setOut = 0): Piece[] {
  if (!l.slatted) return []
  const layers = LEDGER.layers + Math.round(setOut / l.t)
  return Array.from({ length: layers }, (_, k) =>
    slatRail(l, side, `ledger-${stretch}-${k + 1}`, `Listón ${SIDE_WORD[side]} ${stretch.replace(/^(left|right)-?/, '')} (capa ${k + 1})`.replace('  ', ' '), from, to, side === 'left' ? endAt(ref(outer, -k * l.t)) : startAt(ref(outer, k * l.t)), extent(null, ref(l.under(side)), LEDGER.height)),
  )
}

/** Cross members over a closed stretch of a side, so the platform never spans more than it can; under slats, the ledger between them too, and on a wide bed the runners. */
function crossMembers(l: Layout, side: Side, [from, to]: [number, number], span: number, ends: [FaceRef, FaceRef]): Piece[] {
  const { t } = l
  const count = supportsAcross(to - from, t)
  const outer: FaceRef = side === 'left' ? `side-${side}-${span}.z0` : `side-${side}-${span}.z1`
  const z = side === 'left' ? extent(ref('spine.z1'), ref(outer)) : extent(ref(outer), ref('spine.z0'))
  const id = (k: number) => `rail-${side}-${span}-${k}`
  const faces: FaceRef[] = [ends[0], ...Array.from({ length: count }, (_, i) => [`${id(i + 1)}.x0`, `${id(i + 1)}.x1`] as FaceRef[]).flat(), ends[1]]
  return [
    ...Array.from({ length: count }, (_, i) => i + 1).map((k) =>
      l.panel({ id: id(k), name: `Travesaño ${SIDE_WORD[side]} ${span}.${k}`, role: 'divider', normal: 'x', x: startAt(ref(l.headEnd, from + ((to - from) * k) / (count + 1) - t / 2)), y: extent(l.frameY0, ref(l.under(side))), z }),
    ),
    ...Array.from({ length: count + 1 }, (_, i) => {
      const stretch = `${side}-${span}-${i + 1}`
      // A leg takes the face of the side where it stands: the ledger starts past it.
      const leg = l.lift > 0 ? legRails(l).indexOf(i) : -1
      const from: FaceRef = l.lift === 0 ? faces[2 * i] : i === 0 ? `leg-head-${side}-2.x1` : leg >= 0 ? `leg-middle-${side}-${leg + 1}-2.x1` : faces[2 * i]
      const to: FaceRef = l.lift > 0 && i === count ? `leg-foot-${side}-2.x0` : faces[2 * i + 1]
      return [...ledger(l, side, stretch, from, to, outer, l.inset(side) - l.t), ...slatRunner(l, side, stretch, faces[2 * i], faces[2 * i + 1], outer)]
    }).flat(),
  ]
}

const faceOf = (side: Side) => (side === 'left' ? endAt(ref('furniture.z1')) : startAt(ref('furniture.z0')))

/** A side with no drawers: one closed rail, head to foot. */
function closedSide(l: Layout, side: Side): Piece[] {
  // A daybed's backrest is this side, up to the arms: a board joined to the arms and the platform, which squares the base like a back.
  const backrest = l.daybed && side === l.back
  const rail = backrest
    ? l.panel({ id: `side-${side}-1`, name: 'Respaldo', role: 'back', normal: 'z', z: faceOf(side), x: extent(ref(l.headEnd), ref(`${l.foot}.x0`)), y: extent(ref('furniture.y0'), l.top), grain: 'length' })
    : l.panel({ id: `side-${side}-1`, name: `Costado ${SIDE_WORD[side]}`, role: 'side', normal: 'z', z: faceOf(side), x: extent(ref(l.headEnd), ref(`${l.foot}.x0`)), y: extent(l.frameY0, l.rim(side)), grain: 'length' })
  return [rail, ...crossMembers(l, side, [0, l.inner], 1, [l.headEnd, `${l.foot}.x0`])]
}

/** A side with drawers: each one between dividers over its own kick, and a closed rail over whatever length they leave free. */
function drawerSide(l: Layout, side: Side): { pieces: Piece[]; drawers: AddDrawer[]; fronts: [string, Extent][]; joints: Joint[] } {
  const { plan, panel, t, headEnd, inner } = l
  const label = SIDE_WORD[side]
  const faceZ = faceOf(side)
  // Overlay fronts cover the dividers: dividers and kicks stand back a board, and a closed rail runs over the divider next to it.
  const back = l.drawers.mount === 'overlay' ? t : 0
  const setBack = side === 'left' ? endAt(ref('furniture.z1', -back)) : startAt(ref('furniture.z0', back))
  const pieces: Piece[] = []
  const drawers: AddDrawer[] = []
  // An overlay front reaches the middle of a divider it shares with the next drawer; at a rail or an end it stays inside the opening.
  const fronts: [string, Extent][] = []
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
  // Over the drawers the slats rest on one rail from end to end, with its ledger: the dividers between two drawers stop under it and are screwed up into it.
  const rail = `slat-rail-${side}`
  const under: string[] = []
  const addDivider = (id: string, at: number, low = false) => {
    if (low) under.push(id)
    pieces.push(panel({ id, name: `Divisor ${label} ${dividers + 1}`, role: 'divider', normal: 'x', x: startAt(ref(headEnd, at)), y: extent(ref('furniture.y0'), low ? ref(`${rail}.y0`) : ref(l.under(side))), z: side === 'left' ? extent(ref('spine.z1'), ref('furniture.z1', -back)) : extent(ref('furniture.z0', back), ref('spine.z0')) }))
  }
  const closedSpans: [FaceRef, FaceRef, number, number][] = []
  let left: FaceRef = headEnd
  if (before > 1) {
    addDivider(`div-${side}-0`, before - t)
    closedSpans.push([headEnd, `div-${side}-0.${back ? 'x1' : 'x0'}`, 0, before - t])
    left = `div-${side}-0.x1`
  }
  // The stretch the drawers take, between the boards at its two ends.
  const run: [FaceRef, FaceRef] = [left, left]
  for (let k = 1; k <= n; k++) {
    const last = k === n
    const reachesFoot = last && rest - before <= 1
    let right: FaceRef = `${l.foot}.x0`
    if (!reachesFoot) {
      const id = `div-${side}-${k}`
      addDivider(id, before + k * width + (k - 1) * t, l.slatted && !last)
      right = `${id}.x0`
      if (last) closedSpans.push([`${id}.${back ? 'x0' : 'x1'}`, `${l.foot}.x0`, before + group + t, inner])
    }
    dividers++
    run[1] = right
    const bay = `${side}-${k}`
    pieces.push(panel({ id: `kick-${bay}`, name: `Zoclo ${label} ${k}`, role: 'kick', normal: 'z', z: setBack, x: extent(ref(left), ref(right)), y: extent(ref('furniture.y0'), null, KICK_HEIGHT.bed), grain: 'length' }))
    drawers.push({
      op: 'addDrawer',
      group: `drawer-${side}-${k}`,
      name: `Cajón ${label} ${k}`,
      left,
      right,
      bottom: `kick-${bay}.y1`,
      // Slats need a board under their ends where a panel would span from divider to divider: the drawer opens under that rail.
      top: l.slatted ? `${rail}.y0` : l.under(side),
      front: side === 'left' ? 'furniture.z1' : 'furniture.z0',
      back: side === 'left' ? 'spine.z1' : 'spine.z0',
      material: plan.material,
      bottomMaterial: backBoard(l.catalog).id,
    })
    if (back) {
      const seam = (divider: number, sign: 1 | -1) => ref(`div-${side}-${divider}.x0`, t / 2 + (sign * FRONT_GAP) / 2)
      fronts.push([`drawer-${side}-${k}-front`, extent(k > 1 ? seam(k - 1, 1) : ref(left, FRONT_GAP), k < n ? seam(k, -1) : ref(right, -FRONT_GAP))])
    }
    left = right === `${l.foot}.x0` ? left : `div-${side}-${k}.x1`
  }
  closedSpans.forEach(([from, to, start, end], i) => {
    pieces.push(panel({ id: `side-${side}-${i + 1}`, name: `Costado ${label} ${i + 1}`, role: 'side', normal: 'z', z: faceZ, x: extent(ref(from), ref(to)), y: extent(ref('furniture.y0'), l.rim(side)), grain: 'length' }))
    // An overlay rail runs over the divider next to it; what goes under the platform stops at the divider's near face.
    const inside = (face: FaceRef, near: 'x0' | 'x1'): FaceRef => (face.startsWith('div-') ? `${face.split('.')[0]}.${near}` : face)
    pieces.push(...crossMembers(l, side, [start, end], i + 1, [inside(from, 'x1'), inside(to, 'x0')]))
  })
  if (!l.slatted) return { pieces, drawers, fronts, joints: [] }
  const railFace: FaceRef = side === 'left' ? `${rail}.z0` : `${rail}.z1`
  const [from, to] = run
  const runner = slatRunner(l, side, side, from, to, railFace)
  pieces.push(slatRail(l, side, rail, `Larguero ${label}`, from, to, setBack, extent(ref(l.under(side), -SLAT_RAIL), l.rim(side))), ...ledger(l, side, side, from, to, railFace), ...runner)
  const joints = under.flatMap((divider) => [rail, ...runner.map((p) => p.id)].map((over) => makeJoint(`j-${divider}-${over}`, divider, over, 'pocket-screw', [{ hardwareId: pocketScrewId(t), count: 2 }])))
  return { pieces, drawers, fronts, joints }
}

export function buildBed(plan: BedPlan, catalog: Catalog): BuiltBed {
  const l = layoutOf(plan, catalog)
  const head = headboard(l)
  const opens = (side: Side) => plan.drawers.count > 0 && (plan.drawers.side === 'both' || plan.drawers.side === side)
  const sides = (['left', 'right'] as const).map((side) => (opens(side) ? drawerSide(l, side) : { pieces: closedSide(l, side), drawers: [], fronts: [], joints: [] }))

  const design: Design = {
    schema: 1,
    name: plan.name,
    dimensions: { width: l.size.width, height: l.size.height, depth: l.size.length },
    wallAnchored: false,
    notes: '',
    pieces: [...head.pieces, ...base(l), ...sides.flatMap((s) => s.pieces), ...trim(l), ...(l.lift > 0 ? legs(l) : [])],
    joints: sides.flatMap((s) => s.joints),
    kind: 'bed',
    mattress: plan.mattress,
  }
  const overlay = new Map(sides.flatMap((s) => s.fronts))
  const withFront = (built: Design): Design => ({ ...built, pieces: built.pieces.map((p) => (overlay.has(p.id) ? { ...p, x: overlay.get(p.id)! } : p)) })
  const placed = addDrawers(design, sides.flatMap((s) => s.drawers), catalog, withFront)
  const done = finished(l, l.drawers.corners === 'fingers' ? withFingerBoxes(placed.design, catalog) : placed.design)
  return { design: knockDown(done.design, plan.assembly, catalog, blockOf(l)), notes: [...head.notes, ...slatNotes(l), ...placed.notes, ...done.notes, ...legStyleNote(styledLegs(done.design.pieces), 'el marco')] }
}

/** What is cut into the drawers once they are in place: finger corners, notches and grooves; and the pulls the fronts take. */
/** The blocks a bed comes apart into: the base glued whole, and each tall board that would make it too bulky to carry (headboard, foot arm, a daybed's backrest) with its cap, and the platform with its lips (fabricacion-y-armado.md §8.4). */
function blockOf(l: Layout): (piece: Piece) => string {
  const backrest = l.daybed ? `side-${l.back}-1` : null
  return ({ id, group }) => {
    if (id === 'foot-arm' || id === 'foot-cap') return 'foot'
    // A ledger is glued to the board it runs along, and goes with it.
    if (id === backrest || id === 'back-cap' || (l.daybed && id.startsWith(`ledger-${l.back}-`))) return 'backrest'
    if (group === 'headboard') return 'headboard'
    if (id.startsWith('platform') || /^slat-\d+$/.test(id) || id.startsWith('lip-')) return 'platform'
    return 'base'
  }
}

/** What holds the slats, said outright: each ledger glued and screwed to the board it runs along (a backrest would have it nailed, as a back is), and each slat with one screw into the ledger board it covers whole, resting on the one next to the side. */
function slatSeats(l: Layout, design: Design, { boxes, thicknesses }: Geometry): Joint[] {
  const ledgers = design.pieces.filter((p) => p.id.startsWith('ledger-'))
  const screwed = (a: Piece, b: Piece, extra: Partial<Joint> = {}, count: number | null = null) =>
    makeJoint(`j-${a.id}-${b.id}`, a.id, b.id, 'butt-screw', hardwareFor(l.catalog, 'butt-screw', a, b, boxes, thicknesses).map((h) => ({ ...h, count })), extra)
  const carried = ledgers.filter((p) => p.id.endsWith('-1')).flatMap((first) => {
    const box = boxes.get(first.id)!
    const board = design.pieces.find((p) => {
      const o = boxes.get(p.id)
      return !!o && p.normal === 'z' && !p.id.startsWith('ledger-') && (Math.abs(o.z1 - box.z0) <= CONTACT_TOLERANCE || Math.abs(o.z0 - box.z1) <= CONTACT_TOLERANCE) && overlap(o, box, 'x') > CONTACT_TOLERANCE && overlap(o, box, 'y') > CONTACT_TOLERANCE
    })
    return board ? [screwed(first, board)] : []
  })
  const seats = design.pieces
    .filter((p) => /^slat-\d+$/.test(p.id))
    .flatMap((slat) => {
      const box = boxes.get(slat.id)!
      return ledgers.flatMap((board) => {
        const seat = boxes.get(board.id)!
        const across = overlap(seat, box, 'z')
        if (Math.abs(seat.y1 - box.y0) > CONTACT_TOLERANCE || overlap(seat, box, 'x') <= CONTACT_TOLERANCE || across <= CONTACT_TOLERANCE) return []
        return [screwed(slat, board, { glue: false }, across >= l.t - CONTACT_TOLERANCE ? 1 : 0)]
      })
    })
  return [...carried, ...seats]
}

function finished(l: Layout, built: Design): { design: Design; notes: string[] } {
  const { pulls, style, fingers } = l.drawers
  const geometry = resolveGeometry(built, l.catalog)
  if (!geometry.ok) return { design: completeJoints(built, l.catalog), notes: [] }
  const boxes = geometry.value.boxes
  const fingered = built.joints.some((u) => u.type === 'finger') ? withFingerCuts(built, boxes, fingers) : built
  const cut = withFrontCuts(fingered, boxes, () => ({ notch: pulls === 'notch', grooved: style === 'grooved' }))
  const fronts = built.pieces.filter((p) => p.role === 'drawer-front').length
  const withFingers = fingerDrawers(built)
  const notes = [...(pulls === 'notch' && fronts ? [notchNote(fronts)] : []), ...(withFingers ? [fingerDrawersNote(withFingers, fingers)] : [])]
  return { design: completeJoints({ ...cut, joints: [...cut.joints, ...slatSeats(l, cut, geometry.value)], ...(pulls === 'none' || !fronts ? {} : { pulls }) }, l.catalog), notes }
}

function describeBedChanges(before: BedPlan, after: BedPlan): string[] {
  const changes: string[] = []
  if (before.mattress !== after.mattress) changes.push(BED_LABELS.mattress[after.mattress].phrase)
  if (before.height !== after.height) changes.push(`base de ${after.height} mm`)
  if (before.legs !== after.legs) changes.push(BED_LABELS.legs[after.legs].phrase)
  if (after.legs === 'legs' && before.legHeight !== after.legHeight) changes.push(`patas de ${after.legHeight} mm`)
  if (after.legs === 'legs') changes.push(...describeLegStyle(before, after))
  if (before.material !== after.material) changes.push(`material ${after.material}`)
  const [a, b] = [before.drawers, after.drawers]
  if (a.side !== b.side) changes.push(BED_LABELS.drawerSide[b.side].phrase)
  if (b.side !== 'none' && a.count !== b.count) changes.push(`${b.count} ${b.count === 1 ? 'cajón' : 'cajones'} por lado`)
  if (b.side !== 'none' && a.position !== b.position) changes.push(`cajones ${BED_LABELS.drawerPosition[b.position].phrase}`)
  const [was, now] = [drawerBuild(before), drawerBuild(after)]
  if (b.side !== 'none') {
    if (was.mount !== now.mount) changes.push(BED_LABELS.drawerMount[now.mount].phrase)
    if (was.style !== now.style) changes.push(BED_LABELS.drawerStyle[now.style].phrase)
    if (was.pulls !== now.pulls) changes.push(BED_LABELS.pulls[now.pulls].phrase)
    if (was.corners !== now.corners) changes.push(BED_LABELS.drawerCorners[now.corners].phrase)
    if (now.corners === 'fingers' && was.fingers !== now.fingers) changes.push(`${now.fingers} dedos por esquina`)
  }
  if ((before.platform ?? 'panel') !== (after.platform ?? 'panel')) changes.push(BED_LABELS.platform[after.platform ?? 'panel'].phrase)
  if (!!before.lip !== !!after.lip) changes.push(after.lip ? 'con tope del colchón' : 'sin tope del colchón')
  const [h, k] = [before.headboard, after.headboard]
  if (h.style !== k.style) changes.push(BED_LABELS.headboard[k.style].phrase)
  if (k.style !== 'none' && h.height !== k.height) changes.push(`cabecera de ${k.height} mm`)
  if ((k.style === 'bookcase' || k.style === 'storage') && h.depth !== k.depth) changes.push(`cabecera de ${k.depth} mm de fondo`)
  if ((k.style === 'bookcase' || k.style === 'storage') && h.shelves !== k.shelves) changes.push(`${k.shelves} ${k.shelves === 1 ? 'repisa' : 'repisas'} en la cabecera`)
  if (k.style !== 'none' && !!h.cap !== !!k.cap) changes.push(k.cap ? 'con copete' : 'sin copete')
  if (k.style === 'daybed' && (h.arms ?? 'square') !== (k.arms ?? 'square')) changes.push(BED_LABELS.arms[k.arms ?? 'square'].phrase)
  return [...changes, ...describeAssembly(before, after)]
}

/** What an absent choice of the drawers means, said out loud: the bench's plans carry every key of the schema. */
const PLAIN_DRAWERS = { mount: 'inset', style: 'flat', pulls: 'none', corners: 'screwed', fingers: DEFAULT_FINGERS } as const

function benchBeds(): [string, BedPlan][] {
  const variants: [string, BedPlan][] = []
  for (const mattress of MattressSize.options)
    for (const style of BedPlan.shape.headboard.shape.style.options)
      for (const side of BedPlan.shape.drawers.shape.side.options)
        for (const position of BedPlan.shape.drawers.shape.position.options) {
          if (side === 'none' && position !== 'head') continue
          if (style === 'daybed' && side === 'both') continue
          const drawers = side === 'none' ? BED_LABELS.drawerSide.none.phrase : `${BED_LABELS.drawerSide[side].phrase} ${BED_LABELS.drawerPosition[position].phrase}`
          variants.push([
            `${mattress}, ${BED_LABELS.headboard[style].phrase}, ${drawers}`,
            { kind: 'bed', name: 'Cama', mattress, material: 'T18', height: 400, legs: 'none', legHeight: LEG_HEIGHT, legStyle: 'straight', drawers: { side, count: side === 'none' ? 0 : 3, position, ...PLAIN_DRAWERS }, headboard: { style, height: 1100, depth: 250, shelves: 2, cap: false, arms: 'square' }, platform: 'panel', lip: false, assembly: 'glued' },
          ])
        }
  const base: BedPlan = { kind: 'bed', name: 'Cama', mattress: 'matrimonial', material: 'T18', height: 400, legs: 'legs', legHeight: LEG_HEIGHT, drawers: { side: 'none', count: 0, position: 'head' }, headboard: { style: 'plain', height: 1100, depth: 250, shelves: 2 } }
  for (const mattress of MattressSize.options)
    for (const legHeight of [LEG_HEIGHT_RANGE.min, LEG_HEIGHT, LEG_HEIGHT_RANGE.max])
      variants.push([`${mattress}, cabecera lisa, patas de ${legHeight} mm`, { ...base, mattress, legHeight, height: legHeight + 250 }])
  for (const style of BedPlan.shape.headboard.shape.style.options.filter((s) => s !== 'plain' && s !== 'daybed'))
    variants.push([`matrimonial, ${BED_LABELS.headboard[style].phrase}, patas de ${LEG_HEIGHT} mm`, { ...base, headboard: { ...base.headboard, style } }])
  // The trim: a lip on every open edge and a cap on every headboard, with drawers on one side, and the lip on a bed with no headboard, raised on legs.
  const drawn: BedPlan = { ...base, legs: 'none', drawers: { side: 'left', count: 3, position: 'center' } }
  for (const style of BedPlan.shape.headboard.shape.style.options)
    variants.push([`matrimonial, ${BED_LABELS.headboard[style].phrase}, con tope del colchón${style === 'none' ? '' : ' y copete'}`, { ...drawn, lip: true, headboard: { ...drawn.headboard, style, cap: true } }])
  variants.push(['matrimonial, sin cabecera, patas, con tope del colchón', { ...base, lip: true, headboard: { ...base.headboard, style: 'none' } }])
  // Overlay fronts wherever the drawers gather, with a closed stretch on either end or none; and the other choices of the fronts and the boxes.
  for (const position of BedPlan.shape.drawers.shape.position.options)
    for (const count of [2, 4]) variants.push([`queen, cabecera lisa, ${count} cajones sobrepuestos por lado ${BED_LABELS.drawerPosition[position].phrase}`, { ...drawn, mattress: 'queen', drawers: { side: 'both', count, position, mount: 'overlay' } }])
  variants.push(['matrimonial, cabecera lisa, cajones ranurados con muesca', { ...drawn, drawers: { ...drawn.drawers, style: 'grooved', pulls: 'notch' } }])
  for (const fingers of [3, 5, 9]) variants.push([`matrimonial, cabecera lisa, cajones con ${fingers} dedos por esquina`, { ...drawn, drawers: { ...drawn.drawers, corners: 'fingers', fingers } }])
  variants.push([`matrimonial, cabecera lisa, patas cónicas de ${LEG_HEIGHT} mm`, { ...base, legStyle: 'tapered' }])
  variants.push(['individual, sin cabecera, patas cónicas de 250 mm', { ...base, mattress: 'individual', legHeight: 250, height: 450, legStyle: 'tapered', headboard: { style: 'none', height: 1100, depth: 0, shelves: 0 } }])
  variants.push(['individual, cama de día con los brazos en diagonal', { ...drawn, mattress: 'individual', lip: true, drawers: { side: 'left', count: 3, position: 'center' }, headboard: { style: 'daybed', height: 800, depth: 0, shelves: 0, cap: true, arms: 'sloped' } }])
  variants.push(['individual, cama de día sin copete, con los brazos en diagonal y cajones a la derecha', { ...drawn, mattress: 'individual', drawers: { side: 'right', count: 2, position: 'center' }, headboard: { style: 'daybed', height: 750, depth: 0, shelves: 0, arms: 'sloped' } }])
  variants.push([
    'individual, cama de día con copete, tope y cajones sobrepuestos con jaladeras',
    { ...drawn, mattress: 'individual', lip: true, drawers: { side: 'left', count: 3, position: 'center', mount: 'overlay', pulls: 'handle' }, headboard: { style: 'daybed', height: 830, depth: 0, shelves: 0, cap: true } },
  ])
  // Knocked down: bolts in the daybed and in a bed on legs, minifix in a queen with drawers on both sides.
  const named = (name: string) => variants.find(([n]) => n === name)![1]
  variants.push(['individual, cama de día con copete y tope, desarmable con pernos', { ...named('individual, cama de día con copete, tope y cajones sobrepuestos con jaladeras'), assembly: 'bolts' }])
  variants.push([`matrimonial, cabecera lisa, patas de ${LEG_HEIGHT} mm, desarmable con pernos`, { ...named(`matrimonial, cabecera lisa, patas de ${LEG_HEIGHT} mm`), assembly: 'bolts' }])
  variants.push(['queen, cabecera librero, cajones de los dos lados, desarmable con minifix', { ...named('queen, cabecera librero, cajones de los dos lados hacia la cabecera'), assembly: 'cams' }])
  // Slats under the mattress: over closed sides, on legs, over drawers (inset and overlay) and inside a daybed; from the queen up they take a rail halfway across.
  for (const mattress of MattressSize.options) {
    variants.push([`${mattress}, cabecera lisa, sin cajones, de tablillas`, { ...drawn, mattress, drawers: base.drawers, platform: 'slats' }])
    variants.push([`${mattress}, sin cabecera, patas, de tablillas`, { ...base, mattress, platform: 'slats', headboard: { ...base.headboard, style: 'none' } }])
    variants.push([`${mattress}, cabecera librero, cajones de los dos lados, de tablillas`, { ...drawn, mattress, platform: 'slats', drawers: { side: 'both', count: 3, position: 'center' }, headboard: { ...drawn.headboard, style: 'bookcase' } }])
  }
  variants.push(['queen, cabecera lisa, 2 cajones sobrepuestos a la izquierda hacia la cabecera, de tablillas', { ...drawn, mattress: 'queen', platform: 'slats', drawers: { side: 'left', count: 2, position: 'head', mount: 'overlay' } }])
  variants.push(['individual, cama de día de tablillas, con tope y copete', { ...drawn, mattress: 'individual', platform: 'slats', lip: true, headboard: { style: 'daybed', height: 800, depth: 0, shelves: 0, cap: true } }])
  return variants
}

const deepHeadboard = (plan: BedPlan) => plan.headboard.style === 'bookcase' || plan.headboard.style === 'storage'
const withDrawers = (plan: BedPlan, drawers: Partial<BedPlan['drawers']>): BedPlan => ({ ...plan, drawers: { ...plan.drawers, ...drawers } })
/** A daybed stands on its arms and backrest, with drawers on one side only: choosing it settles both. */
const asDaybed = (plan: BedPlan): BedPlan => ({ ...plan, legs: 'none', drawers: plan.drawers.side === 'both' ? { ...plan.drawers, side: 'left' } : plan.drawers })
const withHeadboard = (plan: BedPlan, headboard: Partial<BedPlan['headboard']>): BedPlan => ({ ...plan, headboard: { ...plan.headboard, ...headboard } })

/** A bed's plan: the mattress sets its size; the base, its drawers and the headboard are choices. */
const bedFields: FieldSpec<BedPlan>[] = [
  section('Colchón y base', [
    choice({ key: 'mattress', label: 'Colchón', lockedByDefault: true, ...fromLabels(BED_LABELS.mattress), get: (p) => p.mattress, set: (p, mattress) => ({ ...p, mattress }) }),
    note('El largo y el ancho de la cama salen del colchón, con 2 cm de holgura para meterlo y sacarlo.'),
    numbers(2, [number({ key: 'height', label: 'Alto de la base', get: (p) => p.height, set: (p, height) => ({ ...p, height }) })]),
    material({ key: 'material', label: 'Triplay', use: 'carcass', get: (p) => p.material, set: (p, material) => ({ ...p, material }) }),
    note('Con cajones la cama no lleva patas: el zoclo sostiene el banco de cajones.', hasDrawers),
    choice({ key: 'legs', label: 'Patas', part: 'Patas', ...fromLabels(BED_LABELS.legs), visibleWhen: (p) => !hasDrawers(p) && !isDaybed(p), get: (p) => p.legs, set: (p, legs) => ({ ...p, legs }) }),
    numbers(2, [number({ key: 'legHeight', label: 'Alto de las patas', part: 'Patas', min: LEG_HEIGHT_RANGE.min, max: LEG_HEIGHT_RANGE.max, get: (p) => p.legHeight, set: (p, legHeight) => ({ ...p, legHeight }) })], (p) => p.legs === 'legs' && !hasDrawers(p)),
    legStyleField((p) => p.legs === 'legs'),
    choice({ key: 'platform', label: 'Bajo el colchón', ...fromLabels(BED_LABELS.platform), get: (p) => p.platform ?? 'panel', set: (p, platform) => ({ ...p, platform }) }),
    note(`Tablillas de ${SLAT.width / 10} cm a lo ancho, con ${SLAT.gap / 10} cm o menos entre una y otra, embutidas entre los costados sobre un listón y atornilladas: el colchón respira y la base pesa menos. Con cajones, entre ellas cae polvo.`, (p) => p.platform === 'slats'),
    yesNo({ key: 'lip', label: 'Tope del colchón', get: (p) => !!p.lip, set: (p, lip) => ({ ...p, lip }) }),
    note(`Un listón de ${MATTRESS_LIP / 10} cm sobre la plataforma en cada orilla que la cabecera, los brazos o el respaldo dejan abierta, para que el colchón no se salga. La cama crece lo que mide el triplay por cada uno, y la holgura queda igual.`, (p) => !!p.lip && p.platform !== 'slats'),
    note(`Con tablillas, las tablas de la base suben ${MATTRESS_LIP / 10} cm más en cada orilla abierta y detienen el colchón. La cama crece lo que mide el triplay por cada una.`, (p) => !!p.lip && p.platform === 'slats'),
  ]),
  section('Cajones', [
    note('Los lados se ven desde el pie de la cama.'),
    choice({
      key: 'drawers.side',
      label: 'Lado',
      ariaLabel: 'Lado de los cajones',
      ...fromLabels(BED_LABELS.drawerSide),
      get: (p) => p.drawers.side,
      // Choosing a side puts at least one drawer on it; both sides leave no side for a daybed's backrest, so the headboard goes plain.
      set: (p, side) => {
        const placed: BedPlan = { ...withDrawers(p, { side, count: side === 'none' ? p.drawers.count : Math.max(1, p.drawers.count) }), legs: side === 'none' ? p.legs : 'none' }
        return side === 'both' && isDaybed(p) ? withHeadboard(placed, { style: 'plain' }) : placed
      },
    }),
    stepper({ key: 'drawers.count', label: 'Por lado', ariaLabel: 'cajones por lado', min: 1, max: MAX_DRAWERS_PER_SIDE, visibleWhen: (p) => p.drawers.side !== 'none', get: (p) => p.drawers.count, set: (p, count) => withDrawers(p, { count }) }),
    choice({ key: 'drawers.position', label: 'Se juntan hacia', ariaLabel: 'Hacia dónde se juntan', ...fromLabels(BED_LABELS.drawerPosition), visibleWhen: (p) => p.drawers.side !== 'none', get: (p) => p.drawers.position, set: (p, position) => withDrawers(p, { position }) }),
    choice({ key: 'drawers.mount', label: 'Frentes', ariaLabel: 'Cómo van los frentes', ...fromLabels(BED_LABELS.drawerMount), visibleWhen: hasDrawers, get: (p) => drawerBuild(p).mount, set: (p, mount) => withDrawers(p, { mount }) }),
    note('Sobrepuestos tapan los divisores de canto a canto, y el zoclo queda metido el grueso del triplay.', (p) => hasDrawers(p) && drawerBuild(p).mount === 'overlay'),
    choice({ key: 'drawers.style', label: 'Acabado de los frentes', ...fromLabels(BED_LABELS.drawerStyle), visibleWhen: hasDrawers, get: (p) => drawerBuild(p).style, set: (p, style) => withDrawers(p, { style }) }),
    choice({ key: 'drawers.pulls', label: 'Jaladeras', ...fromLabels(BED_LABELS.pulls), visibleWhen: hasDrawers, get: (p) => drawerBuild(p).pulls, set: (p, pulls) => withDrawers(p, { pulls }) }),
    choice({ key: 'drawers.corners', label: 'Esquinas del cajón', ...fromLabels(BED_LABELS.drawerCorners), visibleWhen: hasDrawers, get: (p) => drawerBuild(p).corners, set: (p, corners) => withDrawers(p, { corners }) }),
    stepper({ key: 'drawers.fingers', label: 'Dedos por esquina', ariaLabel: 'dedos por esquina del cajón', min: FINGERS_RANGE.min, max: FINGERS_RANGE.max, visibleWhen: (p) => hasDrawers(p) && drawerBuild(p).corners === 'fingers', get: (p) => drawerBuild(p).fingers, set: (p, fingers) => withDrawers(p, { fingers }) }),
  ]),
  section('Cabecera', [
    choice({ key: 'headboard.style', label: 'Tipo', ariaLabel: 'Tipo de cabecera', ...fromLabels(BED_LABELS.headboard), get: (p) => p.headboard.style, set: (p, style) => (style === 'daybed' ? asDaybed(withHeadboard(p, { style })) : withHeadboard(p, { style })) }),
    note('Un espacio cerrado a la altura de la almohada y repisas arriba.', (p) => p.headboard.style === 'storage'),
    note('Un respaldo del lado sin cajones y un brazo en cada extremo, a esta altura. Va sin patas.', isDaybed),
    numbers(
      2,
      [
        number({ key: 'headboard.height', label: 'Alto desde el piso', get: (p) => p.headboard.height, set: (p, height) => withHeadboard(p, { height }) }),
        number({ key: 'headboard.depth', label: 'Fondo', visibleWhen: deepHeadboard, get: (p) => p.headboard.depth, set: (p, depth) => withHeadboard(p, { depth }) }),
      ],
      (p) => p.headboard.style !== 'none',
    ),
    stepper({ key: 'headboard.shelves', label: 'Repisas', ariaLabel: 'repisas de la cabecera', min: 0, max: 4, visibleWhen: deepHeadboard, get: (p) => p.headboard.shelves, set: (p, shelves) => withHeadboard(p, { shelves }) }),
    yesNo({ key: 'headboard.cap', label: 'Copete', visibleWhen: (p) => p.headboard.style !== 'none', get: (p) => !!p.headboard.cap, set: (p, cap) => withHeadboard(p, { cap }) }),
    note(`Una tapa de triplay que remata la orilla de arriba y vuela ${CAP_OVERHANG / 10} cm hacia el colchón; por fuera queda al ras.`, (p) => p.headboard.style !== 'none' && !!p.headboard.cap),
    choice({ key: 'headboard.arms', label: 'Brazos', ...fromLabels(BED_LABELS.arms), visibleWhen: isDaybed, get: (p) => p.headboard.arms ?? 'square', set: (p, arms) => withHeadboard(p, { arms }) }),
    note('A cada brazo se le corta la esquina de arriba al frente. Es de vista: se compra y se arma igual.', (p) => isDaybed(p) && p.headboard.arms === 'sloped'),
  ]),
  section('Armado', [...assemblyFields<BedPlan>(), note('La base de la cama se pega entera y se carga de canto, como el colchón. La cabecera, los brazos y el respaldo van aparte, y la plataforma se atornilla encima al final.', (p) => !!p.assembly && p.assembly !== 'glued', 'assembly')]),
]

/** A bed has no outside measures of its own: they come from the mattress, which is its first part. Its drawers are edited from inside, where their boxes show (UI-77). */
const BED_PARTS: Parts<BedPlan> = {
  list: [
    { id: 'mattress', name: 'Colchón', side: 'outside', fields: ['mattress', 'height', 'platform', 'lip'], joints: [], summary: (p) => `${BED_LABELS.mattress[p.mattress].option}, base de ${p.height} mm de alto${p.platform === 'slats' ? ', de tablillas' : ''}${p.lip ? ', con tope' : ''}` },
    woodPart(),
    assemblyPart(),
    {
      id: 'base',
      name: 'Base',
      side: 'outside',
      fields: ['legs', 'legHeight', 'legStyle'],
      joints: ['body', 'base'],
      jointsTitle: 'Uniones del armazón',
      summary: (p) => (hasDrawers(p) ? 'Sobre el zoclo de los cajones' : p.legs === 'legs' ? `Sobre ${LEG_STYLE_LABELS[p.legStyle ?? 'straight'].phrase} de ${p.legHeight} mm` : 'Directo en el piso'),
    },
    {
      id: 'drawers',
      name: 'Cajones',
      side: 'inside',
      fields: ['drawers.side', 'drawers.count', 'drawers.position', 'drawers.mount', 'drawers.style', 'drawers.pulls', 'drawers.corners', 'drawers.fingers'],
      joints: ['drawers'],
      jointsTitle: 'Uniones de las cajas de los cajones',
      summary: (p) => (hasDrawers(p) ? `${counted(p.drawers.count, 'cajón', 'cajones')} por lado, ${BED_LABELS.drawerSide[p.drawers.side].phrase.replace('cajones ', '')}, ${BED_LABELS.drawerMount[drawerBuild(p).mount].phrase}` : 'Sin cajones'),
    },
    {
      id: 'headboard',
      name: 'Cabecera',
      side: 'outside',
      fields: ['headboard.style', 'headboard.height', 'headboard.depth', 'headboard.shelves', 'headboard.cap', 'headboard.arms'],
      joints: ['back'],
      jointsTitle: 'Uniones de la cabecera',
      summary: (p) => (p.headboard.style === 'none' ? 'Sin cabecera' : `${BED_LABELS.headboard[p.headboard.style].option}, de ${p.headboard.height} mm desde el piso${p.headboard.cap ? ', con copete' : ''}${isDaybed(p) && p.headboard.arms === 'sloped' ? ', brazos en diagonal' : ''}`),
    },
  ],
  ofPiece(piece) {
    if (piece.id.startsWith('head') || piece.id === 'foot-arm' || piece.id.endsWith('-cap') || piece.role === 'back') return 'headboard'
    if (piece.id.startsWith('lip-')) return 'mattress'
    if (piece.role.startsWith('drawer-') || /^(div|kick)-(left|right)/.test(piece.id)) return 'drawers'
    if (piece.id.startsWith('platform') || /^slat-\d+$/.test(piece.id)) return 'mattress'
    return 'base'
  },
}

export const bedModule: FurnitureModule<BedPlan> = {
  kind: 'bed',
  schema: BedPlan,
  rules: [
    { holds: frameFits, message: FRAME_TOO_LOW, path: ['legHeight'] },
    { holds: headboardFits, message: HEADBOARD_TOO_LOW, path: ['headboard', 'height'] },
    { holds: (plan) => plan.legs !== 'legs' || !hasDrawers(plan), message: LEGS_WITH_DRAWERS, path: ['legs'] },
    { holds: (plan) => !isDaybed(plan) || !(plan.drawers.side === 'both' && plan.drawers.count > 0), message: DAYBED_DRAWERS, path: ['drawers', 'side'] },
    { holds: (plan) => !isDaybed(plan) || plan.legs !== 'legs', message: DAYBED_LEGS, path: ['legs'] },
  ],
  label: 'una cama',
  expert: { what: 'a bed (a base with or without drawers, and a headboard)' },
  build: buildBed,
  describeChanges: describeBedChanges,
  // Its length and width come from the mattress; its height is the headboard's, or the base's without one.
  resize: (plan, axis, value) =>
    axis !== 'y'
      ? { ok: false, message: 'El largo y el ancho de la cama salen del colchón: cambia el colchón en la ficha.' }
      : { ok: true, plan: plan.headboard.style === 'none' ? { ...plan, height: value - (plan.lip ? MATTRESS_LIP : 0) } : { ...plan, headboard: { ...plan.headboard, height: value } } },
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
