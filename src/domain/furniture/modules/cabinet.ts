import { z } from 'zod'
import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../../design/builders'
import { DIMENSION_OF_AXIS, type Extent, type FaceRef, type Position, type Design, type Piece, type Joint, Pulls } from '../../design/schema'
import { analyze } from '../../checks/analysis'
import { ASSUMPTIONS, pocketScrewId } from '../../assumptions'
import { completeJoints, hingeOn } from '../../design/joints'
import { resolveGeometry } from '../../design/resolve'
import { withFrontCuts } from './fronts'
import { backBoard, hingeFor, pickHardware, type Catalog } from '../../materials/catalog'
import { applyOperations } from '../../editing/operations/apply'
import type { Operation } from '../../editing/operations/schema'
import { Cell, Column } from '../reading/reading'
import { addDrawers, KICK_HEIGHT, KICK_SETBACK, LEG_APRON, LEG_HEIGHT, LEG_HEIGHT_RANGE, LEG_INSET, LEG_WIDTH, legLayers, lower, measuresSummary, MIN_CARCASS_HEIGHT, panelOf, supportsAcross, thicknessOf, type AddDrawer } from './common'
import { choice, fromLabels, custom, material, number, numbers, optionsOf, section, stepper, yesNo, type FieldSpec } from './fields'
import { DEFAULT_FINGERS, FINGERS_RANGE, fingerDrawers, withFingerBoxes, withFingerCuts } from './fingerJoints'
import type { FurnitureModule, Labels, QuickSpec } from './module'

// A cabinet from a plan: measures, how it is built, and a grid of columns and cells. Knotty builds every piece, so pieces cannot overlap by construction.

/** How a carpenter would build it: each option is a different way of joining the same box. */
export const CabinetConstruction = z.object({
  doors: z.enum(['overlay', 'inset']).describe('overlay: the door covers the front of the furniture; inset: the door sits inside the opening'),
  drawerFronts: z.enum(['inset', 'overlay']).describe('inset: the drawer front sits inside the opening; overlay: the front covers the front of the furniture'),
  top: z.enum(['between', 'over', 'fingers']).describe('between: the top goes between the sides; over: the top sits on the sides; fingers: the top goes over the sides and the corners are cut as interlocking fingers'),
  back: z.enum(['nailed', 'none']).describe('nailed: 6 mm back nailed on; none: no back'),
  shelves: z.enum(['movable', 'fixed']).describe('movable: shelves on pins; fixed: screwed'),
  fronts: z.enum(['flat', 'grooved']).default('flat').describe('flat: smooth doors and drawer fronts; grooved: ribbed with vertical router grooves'),
  hinges: z.enum(['outside', 'inside']).default('outside').describe('One-leaf doors: outside hang on the edge nearest a side, inside toward the middle'),
  pulls: Pulls.default('none').describe('none: no pull; notch: finger notch routed in each front; handle: one handle per door leaf and drawer front'),
  drawerCorners: z.enum(['screwed', 'fingers']).default('screwed').describe('screwed, or fingers: the four corners of each drawer box cut as interlocking fingers'),
})
export type CabinetConstruction = z.infer<typeof CabinetConstruction>

export const DEFAULT_CONSTRUCTION: CabinetConstruction = { doors: 'overlay', drawerFronts: 'inset', top: 'between', back: 'nailed', shelves: 'movable', fronts: 'flat', hinges: 'outside', pulls: 'none', drawerCorners: 'screwed' }

/**
 * A cell of a plan: what the expert can say, plus two things only a ficha or the editor writes: `void`, a stretch of a column where nothing is built,
 * and `columns`, a cell split into columns of its own, each with its cells, as deep as it takes.
 */
export const PlanCell = Cell.extend({
  content: z.enum([...Cell.shape.content.options, 'void']).describe('open: open; drawer: drawer; door: door; closed: covered, not opening; void: nothing is built there'),
  get columns() {
    return z.array(PlanColumn).optional().describe('The cell split into columns, left to right; its own content is not built')
  },
})
export type PlanCell = z.infer<typeof PlanCell>
export const PlanColumn = Column.extend({ cells: z.array(PlanCell).describe('Openings from bottom to top') })
export type PlanColumn = z.infer<typeof PlanColumn>

/** Every cell that holds something, those inside a split cell included, left to right and bottom to top. */
export const leafCells = (columns: PlanColumn[]): PlanCell[] => columns.flatMap((c) => c.cells.flatMap((cell) => (cell.columns ? leafCells(cell.columns) : [cell])))

const COLUMNS = 'Left to right; each one with its openings from bottom to top'
/** The columns as the expert says them, without `void`: what it sees stays as it was. */
export const ExpertColumns = z.array(Column).min(1).describe(COLUMNS)

const LEG_HEIGHT_MESSAGE = `Las patas miden entre ${LEG_HEIGHT_RANGE.min} y ${LEG_HEIGHT_RANGE.max} mm.`

export const CabinetPlan = z.object({
  kind: z.literal('cabinet'),
  name: z.string().describe('Name of the furniture for the person, in Spanish: "Librero", "Buró con cajón"'),
  dimensions: z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() }).describe('Outside measures in mm'),
  material: z.string().describe('Plywood id for the carcass, usually "T18"'),
  base: z
    .enum(['kick', 'floor', 'legs'])
    .describe('kick: kick plate at the front; floor: the bottom of the furniture sits directly on the floor; legs: the box stands on legs under a frame screwed to its bottom, as sideboards and credenzas do'),
  legHeight: z
    .number()
    .min(LEG_HEIGHT_RANGE.min, LEG_HEIGHT_MESSAGE)
    .max(LEG_HEIGHT_RANGE.max, LEG_HEIGHT_MESSAGE)
    .default(LEG_HEIGHT)
    .describe(`Leg height in mm with base legs, ${LEG_HEIGHT_RANGE.min}–${LEG_HEIGHT_RANGE.max}; inside the total height, the box keeps ${MIN_CARCASS_HEIGHT}+`),
  wallMounted: z.boolean().describe('Whether it is anchored to or hung from the wall'),
  construction: CabinetConstruction,
  drawerFingers: z.number().int().min(FINGERS_RANGE.min).max(FINGERS_RANGE.max).optional().describe(`Fingers per corner with drawerCorners fingers; absent is ${DEFAULT_FINGERS}`),
  columns: z.array(PlanColumn).min(1).describe(COLUMNS),
})
export type CabinetPlan = z.infer<typeof CabinetPlan>

/** The legs take height from the box above them: what is left must still hold a bottom, a top and an opening. */
const carcassFits = (plan: CabinetPlan) => plan.base !== 'legs' || plan.dimensions.height - plan.legHeight >= MIN_CARCASS_HEIGHT
/** The cells of a column that are built: from the first to the last that is not void. */
const builtRange = (column: PlanColumn) => {
  const built = column.cells.flatMap((c, j) => (c.content === 'void' ? [] : [j]))
  return { lo: built[0] ?? 0, hi: built[built.length - 1] ?? -1, count: built.length, last: column.cells.length - 1 }
}
/** A void goes at the bottom or the top of its column, one at each end at most; some column reaches the floor and some the top, or nothing holds the rest. */
const voidsFit = (plan: CabinetPlan) => {
  const ranges = plan.columns.map(builtRange)
  return ranges.every((r) => r.count > 0 && r.count === r.hi - r.lo + 1 && r.lo <= 1 && r.last - r.hi <= 1) && ranges.some((r) => r.lo === 0) && ranges.some((r) => r.hi === r.last)
}
/** A split cell has at least two columns and is not a void; inside it there are no voids. */
const nestedFit = (columns: PlanColumn[], outer: boolean): boolean =>
  columns.every((c) => c.cells.length > 0 && c.cells.every((cell) => (cell.columns ? cell.content !== 'void' && cell.columns.length >= 2 && nestedFit(cell.columns, false) : outer || cell.content !== 'void')))
const nestingFits = (plan: CabinetPlan) => nestedFit(plan.columns, true)
const NESTING_MISPLACED = 'Un hueco dividido en columnas lleva al menos dos y ninguna vacía; dentro de él no hay huecos vacíos.'
const VOIDS_MISPLACED = 'Un hueco vacío va abajo o arriba de su columna, uno por extremo, y al menos una columna llega al piso y otra al techo.'
const CARCASS_TOO_LOW = `No cupo: con esas patas la caja queda de menos de ${MIN_CARCASS_HEIGHT} mm; baja las patas o sube el alto del mueble.`

/** The words for each choice of a cabinet's plan, capitalized as on the form; inside a sentence they go in lowercase. */
export const CABINET_LABELS = {
  base: { kick: { option: 'Con zoclo', phrase: 'con zoclo' }, floor: { option: 'Directa', phrase: 'sin zoclo' }, legs: { option: 'Con patas', phrase: 'con patas' } } satisfies Labels<CabinetPlan['base']>,
  cell: { open: 'Abierto', drawer: 'Cajón', door: 'Puerta', closed: 'Tapado', void: 'Vacío' } satisfies Record<PlanCell['content'], string>,
  construction: {
    doors: { label: 'Puertas', options: { overlay: 'Sobrepuestas', inset: 'Embutidas' } },
    drawerFronts: { label: 'Frentes de cajón', options: { inset: 'Embutidos', overlay: 'Sobrepuestos' } },
    top: { label: 'Techo', options: { between: 'Entre laterales', over: 'Cubierta encima', fingers: 'Cubierta con dedos' } },
    back: { label: 'Trasera', options: { nailed: 'Clavada', none: 'Sin trasera' } },
    shelves: { label: 'Repisas', options: { movable: 'Móviles', fixed: 'Fijas' } },
    fronts: { label: 'Frentes', options: { flat: 'Lisos', grooved: 'Ranurados' } },
    hinges: { label: 'Bisagras', options: { outside: 'Afuera', inside: 'Adentro' } },
    pulls: { label: 'Jaladeras', options: { none: 'Ninguna', notch: 'Muesca', handle: 'Jaladera' } },
    drawerCorners: { label: 'Esquinas del cajón', options: { screwed: 'Atornilladas', fingers: 'De dedos' } },
  } satisfies { [K in keyof CabinetConstruction]: { label: string; options: Record<CabinetConstruction[K], string> } },
}

const GAP = 2
const SHELF_SETBACK = 5
/** The rail a wall cabinet hangs from: the screws into the wall go through it, not through the thin back. */
const HANGING_RAIL = 80

/** The runs of consecutive columns that are flagged, as [first, last]. */
const runs = (flags: boolean[]) => flags.reduce<[number, number][]>((list, on, i) => (!on ? list : i > 0 && flags[i - 1] ? [...list.slice(0, -1), [list[list.length - 1][0], i]] : [...list, [i, i]]), [])
/** The id of the k-th board of a kind: the first keeps the plain name, so what refers to it still does. */
const nth = (id: string, k: number) => (k === 0 ? id : `${id}-${k + 1}`)

/** Fractions as given may not add up to 1; they are scaled so they do. */
const shares = (values: number[]) => {
  const total = values.reduce((s, v) => s + v, 0) || 1
  let sum = 0
  return values.map((v) => (sum += v / total))
}

const pieceOf = (face: FaceRef) => face.split('.')[0]
/** The same reference, moved along its axis. */
const shift = (position: Position, delta: number): Position => (position.type === 'ref' ? { ...position, offset: position.offset + delta } : position.type === 'mm' ? { ...position, mm: position.mm + delta } : { ...position, offset: position.offset + delta })

/**
 * The stand of a box on legs, as the reference sideboard KC-APA-01 is built: a leg of two layers glued face to face at each corner,
 * set back from the edges; aprons between them, with pocket screws into the legs and the bottom screwed down onto them;
 * legs in between where two would stand too far apart (under a divider when one is close) and rails across, so the bottom never spans more than it can.
 * `frontSetback` is how far the box stops short of the front; `dividers`, the middle of each divider from the left, in mm.
 * `ends`: where the legs of each end stop, the floor of the column above them; a column raised over a void takes its legs up to it, with its side apron.
 */
function legBase(plan: CabinetPlan, t: number, frontSetback: number, dividers: number[], ends: { left: FaceRef; right: FaceRef } = { left: 'bottom.y0', right: 'bottom.y0' }): { pieces: Piece[]; joints: Joint[] } {
  const { width, depth } = plan.dimensions
  const pieces: Piece[] = []
  const joints: Joint[] = []
  const board = (p: Omit<Parameters<typeof makePiece>[0], 'material'>) => pieces.push(makePiece({ material: plan.material, ...p }))
  const pocket = (a: string, b: string) => joints.push(makeJoint(`j-${a}-${b}`, a, b, 'pocket-screw', [{ hardwareId: pocketScrewId(t), count: 2 }]))
  const upTo = (face: FaceRef) => extent(ref('furniture.y0'), ref(face))
  const apronUnder = (face: FaceRef) => extent(null, ref(face), LEG_APRON)
  const apronY = apronUnder('bottom.y0')
  const leg = (id: string, name: string, first: Extent, towards: 'right' | 'left', z: Extent, top: FaceRef = 'bottom.y0') => pieces.push(...legLayers(plan.material, id, name, first, towards, upTo(top), z))
  const frontZ = extent(null, ref('furniture.z1', -frontSetback - LEG_INSET), LEG_WIDTH)
  const backZ = extent(ref('furniture.z0', LEG_INSET), null, LEG_WIDTH)
  leg('leg-front-left', 'Pata delantera izquierda', startAt(ref('furniture.x0', LEG_INSET)), 'right', frontZ, ends.left)
  leg('leg-front-right', 'Pata delantera derecha', endAt(ref('furniture.x1', -LEG_INSET)), 'left', frontZ, ends.right)
  leg('leg-back-left', 'Pata trasera izquierda', startAt(ref('furniture.x0', LEG_INSET)), 'right', backZ, ends.left)
  leg('leg-back-right', 'Pata trasera derecha', endAt(ref('furniture.x1', -LEG_INSET)), 'left', backZ, ends.right)
  board({ id: 'apron-front', name: 'Faldón del frente', role: 'apron', normal: 'z', x: extent(ref('leg-front-left-2.x1'), ref('leg-front-right-2.x0')), y: apronY, z: endAt(ref('leg-front-left-1.z1')) })
  board({ id: 'apron-back', name: 'Faldón de atrás', role: 'apron', normal: 'z', x: extent(ref('leg-back-left-2.x1'), ref('leg-back-right-2.x0')), y: apronY, z: startAt(ref('leg-back-left-1.z0')) })
  board({ id: 'apron-left', name: 'Faldón izquierdo', role: 'apron', normal: 'x', x: startAt(ref('leg-front-left-1.x0')), y: apronUnder(ends.left), z: extent(ref('leg-back-left-1.z1'), ref('leg-front-left-1.z0')) })
  board({ id: 'apron-right', name: 'Faldón derecho', role: 'apron', normal: 'x', x: endAt(ref('leg-front-right-1.x1')), y: apronUnder(ends.right), z: extent(ref('leg-back-right-1.z1'), ref('leg-front-right-1.z0')) })
  for (const [apron, a, b] of [['apron-front', 'leg-front-left-2', 'leg-front-right-2'], ['apron-back', 'leg-back-left-2', 'leg-back-right-2'], ['apron-left', 'leg-front-left-1', 'leg-back-left-1'], ['apron-right', 'leg-front-right-1', 'leg-back-right-1']]) {
    pocket(apron, a)
    pocket(apron, b)
  }

  // Legs in between, by the widest gap the reference allows between two; under the nearest dividers when that keeps every gap within it.
  const [left, right] = [LEG_INSET + 2 * t, width - LEG_INSET - 2 * t]
  const n = supportsAcross(right - left, 2 * t, ASSUMPTIONS.legs.maxSpan)
  const even = Array.from({ length: n }, (_, k) => left + ((k + 1) / (n + 1)) * (right - left))
  const nearest = even.map((c) => dividers.reduce<number | null>((best, d) => (best === null || Math.abs(d - c) < Math.abs(best - c) ? d : best), null))
  const fits = (centers: number[]) => {
    const edges = [left, ...centers.flatMap((c) => [c - t, c + t]), right]
    return new Set(centers).size === centers.length && edges.every((e, i) => i % 2 === 1 || (edges[i + 1] - e > 0 && edges[i + 1] - e <= ASSUMPTIONS.legs.maxSpan))
  }
  const underDividers = n > 0 && nearest.every((d) => d !== null) && fits(nearest as number[])
  // Between the aprons, a leg at the front and one at the back; on a shallow box, one that fills the gap.
  const room = depth - frontSetback - 2 * LEG_INSET - 2 * t
  const rows: [string, string, Extent][] =
    room > 2 * LEG_WIDTH
      ? [
          ['front', 'del frente', extent(null, ref('apron-front.z0'), LEG_WIDTH)],
          ['back', 'de atrás', extent(ref('apron-back.z1'), null, LEG_WIDTH)],
        ]
      : [['', '', extent(ref('apron-back.z1'), ref('apron-front.z0'))]]
  const middles = even.map((c, k) => {
    const center = underDividers ? (nearest[k] as number) : c
    const first = underDividers ? startAt(ref(`div-${dividers.indexOf(center) + 1}.x0`, t / 2 - t)) : startAt(partway('leg-front-left-2.x1', 'leg-front-right-2.x0', (k + 1) / (n + 1), -t))
    const ids = rows.map(([row, words, z]) => {
      const id = `leg-middle-${k + 1}${row ? `-${row}` : ''}`
      leg(id, `Pata intermedia ${n > 1 ? `${k + 1} ` : ''}${words}`.trim(), first, 'right', z)
      return id
    })
    return { center, id: ids[0] }
  })

  // Rails across every so often between legs: the bottom rests on them and never spans more than a shelf can.
  const bays: [number, FaceRef][] = [[left, 'leg-front-left-2.x1'], ...middles.flatMap(({ center, id }): [number, FaceRef][] => [[center - t, `${id}-1.x0`], [center + t, `${id}-2.x1`]]), [right, 'leg-front-right-2.x0']]
  let rail = 0
  for (let i = 0; i < bays.length; i += 2) {
    const [[from, a], [to, b]] = [bays[i], bays[i + 1]]
    const count = supportsAcross(to - from, t)
    for (let k = 1; k <= count; k++) {
      rail++
      board({ id: `leg-rail-${rail}`, name: `Travesaño ${rail} de la base`, role: 'divider', normal: 'x', x: startAt(partway(a, b, k / (count + 1), -t / 2)), y: apronY, z: extent(ref('apron-back.z1'), ref('apron-front.z0')) })
    }
  }
  return { pieces, joints }
}

interface BuiltCabinet {
  design: Design
  /** Cells that could not be built as asked, for the person. */
  notes: string[]
}

/** What the plan settles once and every part of the cabinet reads. */
function layoutOf(plan: CabinetPlan, catalog: Catalog) {
  const build = plan.construction
  const t = thicknessOf(catalog, plan.material)
  const cells = leafCells(plan.columns)
  const overlays = cells.some((c) => ((c.content === 'door' || c.content === 'closed') && build.doors === 'overlay') || (c.content === 'drawer' && build.drawerFronts === 'overlay'))
  // Overlay fronts sit in front of the carcass, so the carcass stops one thickness short of the front.
  const front: Position = overlays ? ref('furniture.z1', -t) : ref('furniture.z1')
  const backFace: FaceRef = build.back === 'nailed' ? 'back.z1' : 'furniture.z0'
  const onLegs = plan.base === 'legs'
  // On legs the box starts where they end: the sides and the back stand on the bottom's level, not on the floor.
  const boxFloor = onLegs ? ref('bottom.y0') : ref('furniture.y0')
  const over = build.top !== 'between'
  /** The outer sides run up through the top, and the corners where they meet it are cut as fingers. */
  const fingered = build.top === 'fingers'

  // A column with a void stops short of the floor or of the top: the fixed shelf next to the void is its own floor or roof, and what ran from side to side comes in stretches.
  const n = plan.columns.length
  const ranges = plan.columns.map(builtRange)
  const onFloor = ranges.map((r) => r.lo === 0)
  const toTop = ranges.map((r) => r.hi === r.last)
  const floorBoard = (i: number) => `c${i + 1}-sep-${ranges[i].lo}`
  const roofBoard = (i: number) => `c${i + 1}-sep-${ranges[i].hi + 1}`
  const leftWall = (i: number) => (i === 0 ? 'side-left' : `div-${i}`)
  const rightWall = (i: number) => (i === n - 1 ? 'side-right' : `div-${i + 1}`)
  const roofLevel = (i: number): Position => (toTop[i] ? (over ? ref('top.y0') : ref('furniture.y1')) : ref(`${roofBoard(i)}.y1`))
  return {
    plan,
    catalog,
    build,
    t,
    half: t / 2,
    overlays,
    front,
    backFace,
    depth: () => extent(ref(backFace), front),
    panel: panelOf(plan.material),
    onLegs,
    boxFloor,
    over,
    fingered,
    n,
    ranges,
    onFloor,
    toTop,
    voids: onFloor.includes(false) || toTop.includes(false),
    floorBoard,
    roofBoard,
    floorLevel: (i: number): Position => (onFloor[i] ? boxFloor : ref(`${floorBoard(i)}.y0`)),
    roofLevel,
    /** Where a side stops: with fingers it runs up through the top. */
    sideRoof: (i: number): Position => (fingered && toTop[i] ? ref('furniture.y1') : roofLevel(i)),
    between: (first: number, last: number) => extent(ref(`${leftWall(first)}.x1`), ref(`${rightWall(last)}.x0`)),
    /** A stretch of floor goes between the sides, and under the divider that ends it: that divider stands on it like the others. */
    floorSpan: (first: number, last: number) => extent(first === 0 ? ref('side-left.x1') : ref(`div-${first}.x0`), last === n - 1 ? ref('side-right.x0') : ref(`div-${last + 1}.x1`)),
    voidShare: (i: number, end: 'lo' | 'hi') => plan.columns[i].cells[end === 'lo' ? 0 : ranges[i].last].height / (plan.columns[i].cells.reduce((s, c) => s + c.height, 0) || 1),
    /** Where each column ends, as a share of the width between the sides. */
    columnEdges: shares(plan.columns.map((c) => c.width)),
  }
}
type Layout = ReturnType<typeof layoutOf>

/** The back: one board, or one per column when a column stops short, as tall as what it builds and meeting at the middle of each divider. */
function backs(l: Layout): Piece[] {
  const { plan, n, half } = l
  if (l.build.back !== 'nailed') return []
  const board = { role: 'back' as const, material: backBoard(l.catalog).id, normal: 'z' as const, z: startAt(ref('furniture.z0')) }
  if (!l.voids) return [makePiece({ ...board, id: 'back', name: 'Trasera', x: extent(ref('furniture.x0'), ref('furniture.x1')), y: extent(l.boxFloor, ref('furniture.y1')) })]
  return plan.columns.map((_, i) =>
    makePiece({
      ...board,
      id: nth('back', i),
      name: `Trasera de la columna ${i + 1}`,
      x: extent(i === 0 ? ref('furniture.x0') : ref(`div-${i}.x0`, half), i === n - 1 ? ref('furniture.x1') : ref(`div-${i + 1}.x0`, half)),
      y: extent(l.floorLevel(i), l.toTop[i] ? ref('furniture.y1') : ref(`${l.roofBoard(i)}.y1`)),
    }),
  )
}

/** The box: back, sides, kick, floor and top; the last three in stretches when a column stops short. */
function carcass(l: Layout): Piece[] {
  const { plan, panel, n, t, depth } = l
  const kick = (first: number, last: number, k: number) =>
    makePiece({ id: nth('kick', k), name: 'Zoclo', role: 'kick', material: plan.material, normal: 'z', x: l.floorSpan(first, last), y: extent(ref('furniture.y0'), null, KICK_HEIGHT.cabinet), z: endAt(l.overlays ? ref('furniture.z1', -t - KICK_SETBACK) : ref('furniture.z1', -KICK_SETBACK)) })
  const top = (first: number, last: number, k: number) =>
    l.over
      ? // Over the walls of its stretch, out to their far faces.
        panel({ id: nth('top', k), name: 'Cubierta', role: 'top', normal: 'y', x: extent(first === 0 ? ref('furniture.x0') : ref(`div-${first}.x0`), last === n - 1 ? ref('furniture.x1') : ref(`div-${last + 1}.x1`)), y: endAt(ref('furniture.y1')), z: depth() })
      : panel({ id: nth('top', k), name: 'Techo', role: 'top', normal: 'y', x: l.between(first, last), y: endAt(ref('furniture.y1')), z: depth() })
  return [
    ...backs(l),
    panel({ id: 'side-left', name: 'Lateral izquierdo', role: 'side', normal: 'x', x: startAt(ref('furniture.x0')), y: extent(l.floorLevel(0), l.sideRoof(0)), z: depth() }),
    panel({ id: 'side-right', name: 'Lateral derecho', role: 'side', normal: 'x', x: endAt(ref('furniture.x1')), y: extent(l.floorLevel(n - 1), l.sideRoof(n - 1)), z: depth() }),
    ...(plan.base === 'kick' ? runs(l.onFloor).map(([first, last], k) => kick(first, last, k)) : []),
    ...runs(l.onFloor).map(([first, last], k) =>
      panel({ id: nth('bottom', k), name: 'Piso', role: 'bottom', normal: 'y', x: l.floorSpan(first, last), y: startAt(plan.base === 'kick' ? ref('kick.y1') : ref('furniture.y0', l.onLegs ? plan.legHeight : 0)), z: depth(), load: 'medium' }),
    ),
    ...runs(l.toTop).map(([first, last], k) => top(first, last, k)),
  ]
}

/** The two outer corners of a top with fingers: the sides go through the top, so they overlap it by its thickness. */
function topJoints(l: Layout): Joint[] {
  if (!l.fingered) return []
  return runs(l.toTop).flatMap(([first, last], k) =>
    ([['side-left', first === 0], ['side-right', last === l.n - 1]] as const).flatMap(([side, reaches]) => (reaches ? [makeJoint(`j-${nth('top', k)}-${side}`, side, nth('top', k), 'finger', [], { depth: l.t })] : [])),
  )
}

function dividers(l: Layout): Piece[] {
  const { onFloor, toTop, over, voidShare } = l
  return l.columnEdges.slice(0, -1).map((share, i) => {
    // Beside a column that reaches the floor it stands on the bottom; between two that stop short, it starts at the lower of their floors.
    const from = onFloor[i] || onFloor[i + 1] ? ref('bottom.y1') : ref(`${l.floorBoard(voidShare(i, 'lo') <= voidShare(i + 1, 'lo') ? i : i + 1)}.y0`)
    const to = toTop[i] && toTop[i + 1] ? ref('top.y0') : toTop[i] || toTop[i + 1] ? (over ? ref('top.y0') : ref('furniture.y1')) : ref(`${l.roofBoard(voidShare(i, 'hi') <= voidShare(i + 1, 'hi') ? i : i + 1)}.y1`)
    return l.panel({ id: `div-${i + 1}`, name: `Divisor ${i + 1}`, role: 'divider', normal: 'x', x: startAt(partway('side-left.x1', 'side-right.x0', share, -l.half)), y: extent(from, to), z: l.depth() })
  })
}

type Box = { x: Extent; y: Extent }

/** A drawer a cell asks for, before it has its number. */
interface AskedDrawer {
  /** Where its cell is: column, cell, and on through the columns of a split cell. */
  cell: number[]
  bounds: Pick<AddDrawer, 'left' | 'right' | 'bottom' | 'top'>
  overlay: Box
}

/** What the cells of the grid put in the box. */
interface Filling {
  pieces: Piece[]
  joints: Joint[]
  /** Overlay doors are found by contact, which picks the nearest upright: the hinge side has to be said once the pieces exist. */
  hung: { door: string; upright: string }[]
  drawers: AskedDrawer[]
}

/** One opening of a column: the faces around it, and the box a front takes over it or inside it. */
interface Opening {
  id: string
  /** For names: which column and which cell, when there is more than one. */
  label: string
  left: FaceRef
  right: FaceRef
  bottom: FaceRef
  top: FaceRef
  overlay: Box
  inset: Box
  /** One leaf hangs on the outer edge or the inner one, by which half of the furniture its column is in; a column in the middle hangs on the left. */
  hangsLeft: boolean
}

function shelvesOf(l: Layout, cell: PlanCell, o: Opening): Piece[] {
  const behindDoor = cell.content === 'door'
  const shelves = cell.content === 'open' || behindDoor ? (cell.shelves ?? 0) : 0
  return Array.from({ length: shelves }, (_, i) => i + 1).map((k) =>
    l.panel({
      id: `${o.id}-shelf-${k}`,
      name: `Repisa ${k}${o.label}`,
      role: 'shelf',
      normal: 'y',
      x: extent(ref(o.left), ref(o.right)),
      y: startAt(partway(o.bottom, o.top, k / (shelves + 1), -l.half)),
      // Behind a door the shelf stops short of it: an overlay door is in front of the carcass, an inset one inside it.
      z: extent(ref(l.backFace), behindDoor ? shift(l.front, (l.build.doors === 'inset' ? -l.t : 0) - SHELF_SETBACK) : l.front),
      load: 'medium',
      support: l.build.shelves === 'movable' ? 'movable' : 'fixed',
    }),
  )
}

/** What closes a cell: a fixed cover, or one or two door leaves with their hinges. */
function frontsOf(l: Layout, cell: PlanCell, o: Opening): Pick<Filling, 'pieces' | 'joints' | 'hung'> {
  const { plan, build } = l
  const overlaid = build.doors === 'overlay'
  // Overlay leaves close the front of the piece; inset ones sit flush with the carcass, wherever overlay drawer fronts put it.
  const leaf = { material: plan.material, normal: 'z' as const, z: endAt(overlaid ? ref('furniture.z1') : l.front), edges: ['front', 'back', 'left', 'right', 'top', 'bottom'] as Piece['edges'] }
  if (cell.content === 'closed') {
    // Inset, a fixed cover fills the opening edge to edge and is screwed like any panel.
    const box = overlaid ? o.overlay : { x: extent(ref(o.left), ref(o.right)), y: extent(ref(o.bottom), ref(o.top)) }
    return { pieces: [makePiece({ ...leaf, id: `${o.id}-cover`, name: `Tapa${o.label}`, role: 'other', ...box })], joints: [], hung: [] }
  }
  if (cell.content !== 'door') return { pieces: [], joints: [], hung: [] }

  const box = overlaid ? o.overlay : o.inset
  const [x0, x1] = [box.x.from!, box.x.to!]
  const doors =
    Math.min(cell.doors ?? 1, 2) === 1
      ? [{ id: `${o.id}-door`, name: `Puerta${o.label}`, x: extent(x0, x1), hinge: o.hangsLeft ? o.left : o.right }]
      : [
          { id: `${o.id}-door-left`, name: `Puerta izquierda${o.label}`, x: extent(x0, partway(o.left, o.right, 0.5, -GAP / 2)), hinge: o.left },
          { id: `${o.id}-door-right`, name: `Puerta derecha${o.label}`, x: extent(partway(o.left, o.right, 0.5, GAP / 2), x1), hinge: o.right },
        ]
  // An inset door is declared with its hinge, since it touches nothing; an overlay one gets it from completeJoints, straight or cranked by what it covers.
  const insetHinge = hingeFor(l.catalog, 'inset') ?? pickHardware(l.catalog, 'hinge')
  return {
    pieces: doors.map((d) => makePiece({ ...leaf, id: d.id, name: d.name, role: 'door', x: d.x, y: box.y })),
    joints: overlaid ? [] : doors.map((d) => makeJoint(`j-${d.id}`, d.id, pieceOf(d.hinge), 'cup-hinge', insetHinge ? [{ hardwareId: insetHinge.id, count: null }] : [])),
    hung: overlaid ? doors.map((d) => ({ door: d.id, upright: pieceOf(d.hinge) })) : [],
  }
}

/** A column to fill: where it stands and what it stacks. One of the grid runs between the bottom and the top; one inside a split cell, between that cell's boards. */
interface ColumnSpec {
  cells: PlanCell[]
  /** Column, cell, column… from the plan's columns down to this one. */
  path: number[]
  id: string
  /** For names: «1», or «1.2.1» inside a split cell. */
  name: string
  left: FaceRef
  right: FaceRef
  bottom: FaceRef
  top: FaceRef
  overX: Extent
  overBottom: Position
  overTop: Position
  /** The share of the width between the sides it takes, for which half its doors hang from. */
  span: [number, number]
  /** Only a column of the grid may stop short of the floor or the top. */
  range: ReturnType<typeof builtRange> | null
}

/** A column of the grid, as `fill` takes it. */
function gridColumn(l: Layout, i: number): ColumnSpec {
  const { plan, n, half } = l
  return {
    cells: plan.columns[i].cells,
    path: [i],
    id: `c${i + 1}`,
    name: `${i + 1}`,
    left: i === 0 ? 'side-left.x1' : `div-${i}.x1`,
    right: i === n - 1 ? 'side-right.x0' : `div-${i + 1}.x0`,
    bottom: 'bottom.y1',
    top: 'top.y0',
    // Overlay edges: over the outer sides almost to the edge, over a divider up to its middle.
    overX: extent(i === 0 ? ref('furniture.x0', GAP) : ref(`div-${i}.x0`, half + GAP / 2), i === n - 1 ? ref('furniture.x1', -GAP) : ref(`div-${i + 1}.x0`, half - GAP / 2)),
    overBottom: ref('bottom.y0', GAP),
    overTop: l.over ? ref('top.y0', -GAP) : ref('furniture.y1', -GAP),
    span: [i === 0 ? 0 : l.columnEdges[i - 1], l.columnEdges[i]],
    range: l.ranges[i],
  }
}

/** One column: its fixed shelves between cells, and what each cell holds; a split cell gets its dividers and fills its own columns the same way. */
function fill(l: Layout, spec: ColumnSpec): Filling {
  const { half, build } = l
  const { cells, id, range } = spec
  const m = cells.length
  const nested = spec.path.length > 1
  const middle = (spec.span[0] + spec.span[1]) / 2
  const hangsLeft = Math.abs(middle - 0.5) < 1e-6 || (middle < 0.5) === (build.hinges === 'outside')

  const separators = shares(cells.map((c) => c.height)).slice(0, -1).map((share, j) => {
    // Next to a void the fixed shelf is the column's own floor or roof.
    const edge =
      range && j + 1 === range.lo
        ? { name: `Piso de la columna ${spec.name}`, role: 'bottom' as const, load: 'medium' as const }
        : range && j === range.hi
          ? { name: `Techo de la columna ${spec.name}`, role: 'top' as const }
          : { name: `Entrepaño fijo ${l.n > 1 || nested ? `${spec.name}.` : ''}${j + 1}`, role: 'shelf' as const }
    return l.panel({ id: `${id}-sep-${j + 1}`, normal: 'y', x: extent(ref(spec.left), ref(spec.right)), y: startAt(partway(spec.bottom, spec.top, share, -half)), z: l.depth(), ...edge })
  })

  const filling: Filling = { pieces: separators, joints: [], hung: [], drawers: [] }
  cells.forEach((cell, j) => {
    if (cell.content === 'void') return
    const bottom: FaceRef = j === 0 ? spec.bottom : `${id}-sep-${j}.y1`
    const top: FaceRef = j === m - 1 ? spec.top : `${id}-sep-${j + 1}.y0`
    const overBottom = j === 0 ? spec.overBottom : ref(`${id}-sep-${j}.y0`, half + GAP / 2)
    const overTop = j === m - 1 ? spec.overTop : ref(`${id}-sep-${j + 1}.y0`, half - GAP / 2)
    const cellId = `${id}-h${j + 1}`

    if (cell.columns) {
      // A split cell: dividers between its boards, and each of its columns filled as any other.
      const edges = shares(cell.columns.map((c) => c.width))
      const k = cell.columns.length
      const [s0, s1] = spec.span
      filling.pieces.push(
        ...edges.slice(0, -1).map((share, d) =>
          l.panel({ id: `${cellId}-div-${d + 1}`, name: `Divisor ${d + 1} del hueco ${spec.name}.${j + 1}`, role: 'divider', normal: 'x', x: startAt(partway(spec.left, spec.right, share, -half)), y: extent(ref(bottom), ref(top)), z: l.depth() }),
        ),
      )
      cell.columns.forEach((column, c) => {
        const inner = fill(l, {
          cells: column.cells,
          path: [...spec.path, j, c],
          id: `${cellId}-c${c + 1}`,
          name: `${spec.name}.${j + 1}.${c + 1}`,
          left: c === 0 ? spec.left : `${cellId}-div-${c}.x1`,
          right: c === k - 1 ? spec.right : `${cellId}-div-${c + 1}.x0`,
          bottom,
          top,
          overX: extent(c === 0 ? spec.overX.from! : ref(`${cellId}-div-${c}.x0`, half + GAP / 2), c === k - 1 ? spec.overX.to! : ref(`${cellId}-div-${c + 1}.x0`, half - GAP / 2)),
          overBottom,
          overTop,
          span: [s0 + (c === 0 ? 0 : edges[c - 1]) * (s1 - s0), s0 + edges[c] * (s1 - s0)],
          range: null,
        })
        filling.pieces.push(...inner.pieces)
        filling.joints.push(...inner.joints)
        filling.hung.push(...inner.hung)
        filling.drawers.push(...inner.drawers)
      })
      return
    }

    const opening: Opening = {
      id: cellId,
      label: nested ? ` de la columna ${spec.name}${m > 1 ? ` (hueco ${j + 1})` : ''}` : `${l.n > 1 ? ` de la columna ${spec.name}` : ''}${m > 1 ? ` (hueco ${j + 1})` : ''}`,
      left: spec.left,
      right: spec.right,
      bottom,
      top,
      overlay: { x: spec.overX, y: extent(overBottom, overTop) },
      inset: { x: extent(ref(spec.left, GAP), ref(spec.right, -GAP)), y: extent(ref(bottom, GAP), ref(top, -GAP)) },
      hangsLeft,
    }
    const fronts = frontsOf(l, cell, opening)
    filling.pieces.push(...shelvesOf(l, cell, opening), ...fronts.pieces)
    filling.joints.push(...fronts.joints)
    filling.hung.push(...fronts.hung)
    if (cell.content === 'drawer') filling.drawers.push({ cell: [...spec.path, j], bounds: { left: spec.left, right: spec.right, bottom, top }, overlay: opening.overlay })
  })
  return filling
}

/** What a carpenter adds without being asked, each kept only if the design still holds: a support under each divider on a kick, a rail for the wall screws when hung. */
function withExtras(l: Layout, design: Design): Design {
  const { plan, panel, catalog, onFloor, backFace } = l
  const extras: Operation[] = []
  if (plan.base === 'kick')
    l.columnEdges.slice(0, -1).forEach(
      (_, i) => onFloor[i] && onFloor[i + 1] && extras.push({ op: 'addPiece', piece: panel({ id: `bottom-support-${i + 1}`, name: `Apoyo del piso ${i + 1}`, role: 'divider', normal: 'x', x: startAt(ref(`div-${i + 1}.x0`)), y: extent(ref('furniture.y0'), ref('bottom.y0')), z: extent(ref(backFace), ref('kick.z0')) }) }),
    )
  if (plan.wallMounted && plan.base === 'floor' && !l.voids)
    extras.push({ op: 'addPiece', piece: panel({ id: 'hanging-rail', name: 'Listón de colgar', role: 'brace', normal: 'z', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: extent(null, ref('top.y0'), HANGING_RAIL), z: startAt(ref(backFace)) }) })
  return extras.reduce((kept, extra) => {
    const result = applyOperations(kept, [extra], catalog)
    return result.ok && analyze(completeJoints(result.value.design, catalog), catalog).valid ? result.value.design : kept
  }, design)
}

/** The last of the build, which needs the pieces in place: the hinges of overlay doors, and what is cut into drawer boxes and fronts. */
function finished(l: Layout, built: Design, hung: Filling['hung']): BuiltCabinet {
  const { plan, catalog } = l
  const { pulls, fronts: frontStyle } = plan.construction
  const fingers = plan.drawerFingers ?? DEFAULT_FINGERS
  const notes: string[] = []
  let design = built
  const geometry = resolveGeometry(design, catalog)
  if (geometry.ok) {
    const byId = new Map(design.pieces.map((p) => [p.id, p]))
    const declared = hung.flatMap((h) => {
      const door = byId.get(h.door)
      const upright = byId.get(h.upright)
      return door && upright ? [{ ...hingeOn(door, upright, geometry.value.boxes, catalog), id: `j-${h.door}` }] : []
    })
    design = { ...design, joints: [...design.joints, ...declared] }
  }
  const fronts = design.pieces.filter((p) => p.role === 'door' || p.role === 'drawer-front').length
  const cutBoxes = geometry.ok && design.joints.some((u) => u.type === 'finger') ? withFingerCuts(design, geometry.value.boxes, fingers) : design
  const cutFronts = geometry.ok ? withFrontCuts(cutBoxes, geometry.value.boxes, { notch: pulls === 'notch', grooved: frontStyle === 'grooved' }) : cutBoxes
  const withPulls: Design = pulls === 'none' ? cutFronts : { ...cutFronts, pulls }
  if (pulls === 'notch' && fronts) notes.push(`Muesca para abrir en el canto de ${fronts} ${fronts === 1 ? 'frente' : 'frentes'}: se fresa con router, no se compra nada.`)
  const fingeredTops = design.joints.filter((u) => u.type === 'finger' && u.b.startsWith('top')).length
  if (fingeredTops) notes.push(`Cubierta con dedos en ${fingeredTops} ${fingeredTops === 1 ? 'esquina' : 'esquinas'}, ${fingers} por esquina: los costados suben hasta la cara de arriba. Se cortan con router en mesa o con sierra de mesa y plantilla, y se arman con pegamento. Quedan a la vista.`)
  const withFingers = fingerDrawers(design)
  if (withFingers) notes.push(`Esquinas de dedos en ${withFingers} ${withFingers === 1 ? 'cajón' : 'cajones'}, ${fingers} por esquina: se cortan con router en mesa o con sierra de mesa y plantilla, y se arman con pegamento. Quedan a la vista.`)
  return { design: completeJoints(withPulls, catalog), notes }
}

/** Columns with some cells built as open ones, split cells looked into: what a void with nothing to hang from, or a drawer that does not fit, becomes. */
const openCells = (columns: PlanColumn[], which: (cell: PlanCell, path: number[]) => boolean, path: number[] = []): PlanColumn[] =>
  columns.map((col, i) => ({
    ...col,
    cells: col.cells.map((cell, j) =>
      cell.columns ? { ...cell, columns: openCells(cell.columns, which, [...path, i, j]) } : which(cell, [...path, i, j]) ? { ...cell, content: 'open' as const, shelves: 0, doors: null } : cell,
    ),
  }))
const opened = (plan: CabinetPlan, which: (cell: PlanCell, path: number[]) => boolean): CabinetPlan => ({ ...plan, columns: openCells(plan.columns, which) })

export function buildCabinet(plan: CabinetPlan, catalog: Catalog): BuiltCabinet {
  // A void inside a split cell has nothing to hang from either: it is built as an open cell, and said.
  if (!nestingFits(plan)) {
    const built = buildCabinet(opened(plan, (cell, path) => path.length > 2 && cell.content === 'void'), catalog)
    return { design: built.design, notes: [NESTING_MISPLACED, ...built.notes] }
  }
  if (!voidsFit(plan)) {
    const built = buildCabinet(opened(plan, (cell) => cell.content === 'void'), catalog)
    return { design: built.design, notes: [VOIDS_MISPLACED, ...built.notes] }
  }
  const l = layoutOf(plan, catalog)
  const { build, t } = l
  // A column at an end that stops short of the floor takes the legs of that end up to its own floor.
  const last = plan.columns.length - 1
  const ends = { left: l.onFloor[0] ? 'bottom.y0' : `${l.floorBoard(0)}.y0`, right: l.onFloor[last] ? 'bottom.y0' : `${l.floorBoard(last)}.y0` } as const
  const stand = l.onLegs ? legBase(plan, t, l.overlays ? t : 0, l.columnEdges.slice(0, -1).map((share) => t + share * (plan.dimensions.width - 2 * t)), ends) : { pieces: [], joints: [] }
  const columns = plan.columns.map((_, i) => fill(l, gridColumn(l, i)))
  const asked = columns.flatMap((c) => c.drawers)
  const drawers = asked.map(({ bounds }, k): AddDrawer => ({ op: 'addDrawer', group: `drawer-${k + 1}`, name: `Cajón ${k + 1}`, ...bounds, front: build.drawerFronts === 'overlay' ? 'furniture.z1' : 'side-left.z1', back: l.backFace, material: plan.material, bottomMaterial: backBoard(catalog).id }))

  // A cabinet's plan does not say whether it is a bookcase or a wardrobe: its design has no `kind` and the checks by use read its name.
  const design: Design = {
    schema: 1,
    name: plan.name,
    dimensions: { width: plan.dimensions.width, height: plan.dimensions.height, depth: plan.dimensions.depth },
    wallAnchored: plan.wallMounted,
    notes: '',
    pieces: [...carcass(l), ...stand.pieces, ...dividers(l), ...columns.flatMap((c) => c.pieces)],
    joints: [...stand.joints, ...topJoints(l), ...columns.flatMap((c) => c.joints)],
  }
  const overlayOf = new Map(drawers.map((d, k) => [d.group, asked[k].overlay]))
  // An overlay front is the inset one grown over the edges and brought forward; the box follows it.
  const withFronts = (built: Design, drawer: AddDrawer): Design => {
    const overlay = overlayOf.get(drawer.group)
    if (build.drawerFronts !== 'overlay' || !overlay) return built
    const frontId = `${drawer.group}-front`
    return { ...built, pieces: built.pieces.map((p) => (p.id === frontId ? { ...p, x: overlay.x, y: overlay.y, z: endAt(ref('furniture.z1')) } : p)) }
  }
  const placed = addDrawers(design, drawers, catalog, withFronts)
  // A drawer that does not fit is left as an open cell; the carcass was set back for its front, so it is built again without it.
  const dropped = drawers.flatMap((d, k) => (placed.design.pieces.some((p) => p.id === `${d.group}-front`) ? [] : [asked[k].cell]))
  if (dropped.length) return { design: buildCabinet(opened(plan, (_, path) => dropped.some((cell) => cell.join('.') === path.join('.'))), catalog).design, notes: placed.notes }

  const boxed = build.drawerCorners === 'fingers' ? withFingerBoxes(placed.design, catalog) : placed.design
  const done = finished(l, withExtras(l, boxed), columns.flatMap((c) => c.hung))
  return { design: done.design, notes: [...placed.notes, ...done.notes] }
}

const count = (plan: CabinetPlan, content: PlanCell['content']) => leafCells(plan.columns).filter((c) => c.content === content).length
const layout = (plan: CabinetPlan) => JSON.stringify(plan.columns)

function describeCabinetChanges(before: CabinetPlan, after: CabinetPlan): string[] {
  const changes: string[] = []
  const a = before.dimensions
  const b = after.dimensions
  if (a.height !== b.height || a.width !== b.width || a.depth !== b.depth) changes.push(`medidas ${b.height} × ${b.width} × ${b.depth} mm`)
  if (before.material !== after.material) changes.push(`material ${after.material}`)
  if (before.base !== after.base) changes.push(CABINET_LABELS.base[after.base].phrase)
  if (after.base === 'legs' && before.legHeight !== after.legHeight) changes.push(`patas de ${after.legHeight} mm`)
  if (before.wallMounted !== after.wallMounted) changes.push(after.wallMounted ? 'anclado al muro' : 'sin anclar')
  for (const key of Object.keys(CABINET_LABELS.construction) as (keyof CabinetConstruction)[]) {
    if (before.construction[key] === after.construction[key]) continue
    const { label, options } = CABINET_LABELS.construction[key] as { label: string; options: Record<string, string> }
    changes.push(`${lower(label)} ${lower(options[after.construction[key]])}`)
  }
  if (before.columns.length !== after.columns.length) changes.push(`${after.columns.length} ${after.columns.length === 1 ? 'columna' : 'columnas'}`)
  for (const content of Object.keys(CABINET_LABELS.cell) as PlanCell['content'][]) {
    const [was, is] = [count(before, content), count(after, content)]
    if (was !== is) changes.push(`${is} ${content === 'drawer' ? (is === 1 ? 'cajón' : 'cajones') : `${is === 1 ? 'hueco' : 'huecos'} ${lower(CABINET_LABELS.cell[content])}${is === 1 ? '' : 's'}`}`)
  }
  if (!changes.length && layout(before) !== layout(after)) changes.push('distribución de los huecos')
  return changes
}

function benchCabinets(): [string, CabinetPlan][] {
  const cell = (content: Cell['content'], height = 1, shelves: number | null = null, doors: number | null = null): Cell => ({ height, content, shelves, doors })
  const cabinet = (name: string, dimensions: CabinetPlan['dimensions'], columns: CabinetPlan['columns'], extra: Partial<CabinetPlan> = {}): CabinetPlan => ({ kind: 'cabinet', name, dimensions, material: 'T18', base: 'kick', legHeight: LEG_HEIGHT, wallMounted: true, construction: DEFAULT_CONSTRUCTION, drawerFingers: DEFAULT_FINGERS, columns, ...extra })
  const list: [string, CabinetPlan][] = [
    ['librero', cabinet('Librero', { width: 550, height: 1800, depth: 300 }, [{ width: 1, cells: [cell('open', 1, 4)] }])],
    ['buró', cabinet('Buró', { width: 450, height: 550, depth: 400 }, [{ width: 1, cells: [cell('open', 0.6, 0), cell('drawer', 0.4)] }], { base: 'floor', wallMounted: false })],
    ['alacena', cabinet('Alacena', { width: 600, height: 720, depth: 320 }, [{ width: 1, cells: [cell('door', 1, 1, 2)] }], { base: 'floor' })],
    ['cajonera', cabinet('Cajonera', { width: 500, height: 900, depth: 450 }, [{ width: 1, cells: [cell('drawer'), cell('drawer'), cell('drawer')] }])],
    ['mueble de TV', cabinet('Mueble de TV', { width: 1600, height: 500, depth: 400 }, [{ width: 0.32, cells: [cell('door', 1, 0, 1)] }, { width: 0.36, cells: [cell('open', 1, 1)] }, { width: 0.32, cells: [cell('door', 1, 0, 1)] }], { wallMounted: false })],
    // A sideboard on legs, as the reference KC-APA-01: four columns of doors and drawers under open cubbies.
    [
      'aparador con patas',
      cabinet(
        'Aparador',
        { width: 1600, height: 940, depth: 400 },
        [
          { width: 1, cells: [cell('door', 0.75, 1, 1), cell('drawer', 0.25)] },
          { width: 1, cells: [cell('door', 0.75, 1, 1), cell('open', 0.25)] },
          { width: 1, cells: [cell('door', 0.75, 1, 1), cell('open', 0.25)] },
          { width: 1, cells: [cell('drawer', 0.4), cell('drawer', 0.35), cell('open', 0.25)] },
        ],
        { base: 'legs' },
      ),
    ],
    ['buró con patas', cabinet('Buró', { width: 450, height: 550, depth: 400 }, [{ width: 1, cells: [cell('open', 0.6, 0), cell('drawer', 0.4)] }], { base: 'legs', wallMounted: false })],
  ]
  const sideboard = list.find(([name]) => name === 'aparador con patas')![1]
  const drawerChest = list.find(([name]) => name === 'cajonera')![1]
  const legHeights = [LEG_HEIGHT_RANGE.min, LEG_HEIGHT_RANGE.max].map((legHeight): [string, CabinetPlan] => [`aparador con patas de ${legHeight} mm`, { ...sideboard, legHeight }])
  const withPulls = (['notch', 'handle'] as const).map((pulls): [string, CabinetPlan] => [`aparador con ${pulls === 'notch' ? 'muesca' : 'jaladeras'}`, { ...sideboard, construction: { ...sideboard.construction, pulls } }])
  const withFingers = [3, 5, 9].map((drawerFingers): [string, CabinetPlan] => [`cajonera con ${drawerFingers} dedos`, { ...drawerChest, construction: { ...drawerChest.construction, drawerCorners: 'fingers' }, drawerFingers }])
  // Columns that stop short of the floor: one between two that reach it, with the back and the kick in stretches; one at an end, raised over a leg frame whose legs go up to it.
  const empty: PlanCell = { height: 0.4, content: 'void', shelves: null, doors: null }
  const withVoids: [string, CabinetPlan][] = [
    ['aparador con una columna colgada', cabinet('Aparador', { width: 1200, height: 800, depth: 400 }, [{ width: 1, cells: [cell('door', 1, 1, 1)] }, { width: 1, cells: [empty, cell('open', 0.6, 0)] }, { width: 1, cells: [cell('open', 1, 1)] }], { wallMounted: false, construction: { ...DEFAULT_CONSTRUCTION, top: 'over' } })],
    ['librero con una columna levantada', cabinet('Librero', { width: 880, height: 760, depth: 350 }, [{ width: 0.39, cells: [cell('open', 0.62, 0), cell('open', 0.38, 0)] }, { width: 0.61, cells: [{ ...empty, height: 0.37 }, cell('open', 0.63, 0)] }], { base: 'legs', wallMounted: false })],
  ]
  // Split cells: a bookcase whose levels each have their own divider, and a chest whose rows split their drawers each their own way.
  const split = (height: number, columns: PlanColumn[]): PlanCell => ({ height, content: 'open', shelves: null, doors: null, columns })
  const row = (...widths: [number, PlanCell][]): PlanColumn[] => widths.map(([width, c]) => ({ width, cells: [c] }))
  const withSplitCells: [string, CabinetPlan][] = [
    ['librero con divisores por nivel', cabinet('Librero', { width: 900, height: 1500, depth: 300 }, [{ width: 1, cells: [split(0.25, row([0.34, cell('open', 1, 0)], [0.66, cell('open', 1, 0)])), split(0.25, row([0.5, cell('open', 1, 0)], [0.5, cell('open', 1, 0)])), split(0.25, row([0.42, cell('open', 1, 1)], [0.58, cell('open', 1, 0)])), split(0.25, row([0.66, cell('open', 1, 0)], [0.34, cell('open', 1, 0)]))] }], { base: 'floor' })],
    ['cajonera con cajones que cruzan', cabinet('Cajonera', { width: 1150, height: 780, depth: 550 }, [{ width: 1, cells: [split(0.375, row([2, cell('drawer')], [1, cell('drawer')])), split(0.375, row([1, cell('drawer')], [2, cell('drawer')])), split(0.25, row([2, cell('drawer')], [1, cell('open', 1, 1)]))] }], { base: 'legs', wallMounted: true })],
  ]
  const withTopFingers = ['librero', 'aparador con patas'].map((name): [string, CabinetPlan] => {
    const plan = list.find(([n]) => n === name)![1]
    return [`${name} con cubierta de dedos`, { ...plan, construction: { ...plan.construction, top: 'fingers' } }]
  })
  return [...list, ...withPulls, ...legHeights, ...withFingers, ...withTopFingers, ...withVoids, ...withSplitCells]
}

const withSize = (plan: CabinetPlan, size: Partial<CabinetPlan['dimensions']>): CabinetPlan => ({ ...plan, dimensions: { ...plan.dimensions, ...size } })

const hasCell = (p: CabinetPlan, test: (cell: PlanCell) => boolean) => leafCells(p.columns).some(test)
/** A choice with nothing to decide stays out of the form. */
const VISIBLE_WHEN: Partial<Record<keyof CabinetConstruction, (p: CabinetPlan) => boolean>> = {
  fronts: (p) => hasCell(p, (x) => x.content === 'door' || x.content === 'drawer'),
  hinges: (p) => hasCell(p, (x) => x.content === 'door' && (x.doors ?? 1) < 2),
  pulls: (p) => hasCell(p, (x) => x.content === 'door' || x.content === 'drawer'),
  drawerCorners: (p) => hasCell(p, (x) => x.content === 'drawer'),
}

/** One choice per way of building it, in the order of its labels. */
const constructionFields = (Object.keys(CABINET_LABELS.construction) as (keyof CabinetConstruction)[]).map((key) =>
  choice<CabinetPlan, string>({
    key: `construction.${key}`,
    label: CABINET_LABELS.construction[key].label,
    options: optionsOf(CABINET_LABELS.construction[key].options),
    get: (p) => p.construction[key],
    set: (p, value) => ({ ...p, construction: { ...p.construction, [key]: value } }),
    // Nothing to open, nothing to choose.
    visibleWhen: VISIBLE_WHEN[key],
  }),
)

/** A cabinet's plan: its measures, how it is built and its grid of columns and cells, which has a component of its own. */
const cabinetFields: FieldSpec<CabinetPlan>[] = [
  section('Medidas', [
    numbers(3, [
      number({ key: 'dimensions.height', label: 'Alto', lockedByDefault: true, get: (p) => p.dimensions.height, set: (p, height) => withSize(p, { height }) }),
      number({ key: 'dimensions.width', label: 'Ancho', lockedByDefault: true, get: (p) => p.dimensions.width, set: (p, width) => withSize(p, { width }) }),
      number({ key: 'dimensions.depth', label: 'Fondo', get: (p) => p.dimensions.depth, set: (p, depth) => withSize(p, { depth }) }),
    ]),
  ]),
  section('Cómo se arma', [
    material({ key: 'material', label: 'Triplay', use: 'carcass', get: (p) => p.material, set: (p, material) => ({ ...p, material }) }),
    choice({ key: 'base', label: 'Base', ...fromLabels(CABINET_LABELS.base), get: (p) => p.base, set: (p, base) => ({ ...p, base }) }),
    numbers(2, [number({ key: 'legHeight', label: 'Alto de las patas', part: 'Patas', min: LEG_HEIGHT_RANGE.min, max: LEG_HEIGHT_RANGE.max, get: (p) => p.legHeight, set: (p, legHeight) => ({ ...p, legHeight }) })], (p) => p.base === 'legs'),
    yesNo({ key: 'wallMounted', label: 'Anclado al muro', lockedByDefault: true, get: (p) => p.wallMounted, set: (p, wallMounted) => ({ ...p, wallMounted }) }),
    ...constructionFields,
    stepper({ key: 'drawerFingers', label: 'Dedos por esquina', ariaLabel: 'dedos por esquina del cajón', min: FINGERS_RANGE.min, max: FINGERS_RANGE.max, visibleWhen: (p) => p.construction.top === 'fingers' || (p.construction.drawerCorners === 'fingers' && hasCell(p, (x) => x.content === 'drawer')), get: (p) => p.drawerFingers ?? DEFAULT_FINGERS, set: (p, drawerFingers) => ({ ...p, drawerFingers }) }),
  ]),
  custom({ key: 'columns', component: 'cabinetColumns', label: 'Columnas y huecos', get: (p) => p.columns, set: (p, columns) => ({ ...p, columns }) }),
]

const drawersBuilt = (design: Design) => design.pieces.filter((p) => p.role === 'drawer-front').length
const doorLeavesAsked = (plan: CabinetPlan) => leafCells(plan.columns).reduce((n, c) => n + (c.content === 'door' ? Math.min(c.doors ?? 1, 2) : 0), 0)

/** What is quick in a cabinet: its measures, the counts of drawers, doors and open niches, and the few choices that move the cost or the look most. */
const cabinetQuick: QuickSpec<CabinetPlan> = {
  measures: true,
  counts: ['drawer', 'door', 'open'],
  fields: ['base', 'construction.pulls', 'material'],
  builtAsAsked: (plan, design) => {
    const asked = count(plan, 'drawer')
    if (drawersBuilt(design) !== asked) return `Solo caben ${drawersBuilt(design)} de ${asked} cajones en esos huecos.`
    if (design.pieces.filter((p) => p.role === 'door').length !== doorLeavesAsked(plan)) return 'Una puerta no quedó como se pidió.'
    return null
  },
}

export const cabinetModule: FurnitureModule<CabinetPlan> = {
  kind: 'cabinet',
  schema: CabinetPlan,
  rules: [
    { holds: carcassFits, message: CARCASS_TOO_LOW, path: ['legHeight'] },
    { holds: voidsFit, message: VOIDS_MISPLACED, path: ['columns'] },
    { holds: nestingFits, message: NESTING_MISPLACED, path: ['columns'] },
  ],
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
  quick: cabinetQuick,
}
