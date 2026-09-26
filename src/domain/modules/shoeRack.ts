import { z } from 'zod'
import { DIMENSION_OF_AXIS, type Design, type Load } from '../design/schema'
import { materialById, type Catalog } from '../materials/catalog'
import { stiffness } from '../materials/grades'
import type { Cell } from '../reading/reading'
import { ASSUMPTIONS } from '../structure/assumptions'
import { maxSpan } from '../structure/rules/deflection'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetPlan } from './cabinet'
import { KICK_HEIGHT, lower, MAX_SPAN, measuresSummary, thicknessOf } from './common'
import { choice, material, number, numbers, optionsOf, section, stepper, yesNo, type FieldSpec } from './fields'
import type { FurnitureModule, Labels } from './module'

// A shoe rack from its ficha (docs/carpinteria/muebles-y-medidas.md §2.6), built as a one-column cabinet with fixed shelves that also brace the shallow box.
// Its levels are flat: inclined shelves are not buildable yet, since every piece is a box along the axes.

/** Depth for adult shoes, in mm: 300 to 380, 330 usual. */
export const SHOE_RACK_DEPTH = { min: 300, usual: 330, max: 380 } as const
/** Width a pair takes, with room to take it out, in mm. */
export const PAIR_WIDTH = 230
/** Clear height of a level for low shoes, in mm: 150 to 200, 170 usual. */
export const LEVEL_HEIGHT = { min: 150, usual: 170, max: 200 } as const
/** Clear height of a level for boots, in mm. */
export const BOOT_LEVEL_HEIGHT = 450
/** A level of shoes, a few pairs of about a kilo each. */
const SHELF_LOAD: Load = 'light'
/** The most levels the form offers. */
export const MAX_LEVELS = 10

export const ShoeRackPlan = z.object({
  kind: z.literal('shoeRack'),
  name: z.string().describe('Name of the furniture for the person, in Spanish: "Zapatera", "Zapatera con puertas"'),
  dimensions: z
    .object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() })
    .describe(`Outside measures in mm. Depth ${SHOE_RACK_DEPTH.min}–${SHOE_RACK_DEPTH.max}, usually ${SHOE_RACK_DEPTH.usual}; each pair takes about ${PAIR_WIDTH} of width`),
  material: z.string().describe('Plywood id for the carcass, usually "T18"'),
  levels: z
    .number()
    .int()
    .min(1)
    .max(MAX_LEVELS)
    .describe(`How many levels for shoes, from bottom to top, the boot level included; a level for low shoes takes ${LEVEL_HEIGHT.min}–${LEVEL_HEIGHT.max} mm of clear height, usually ${LEVEL_HEIGHT.usual}`),
  bootLevel: z.boolean().describe(`Whether the bottom level is tall for boots (${BOOT_LEVEL_HEIGHT} mm clear); false if every level is for low shoes`),
  front: z.enum(['open', 'doors']).describe('open: open levels; doors: hinged overlay doors in front of the levels'),
  base: z.enum(['kick', 'floor']).describe('kick: kick plate at the front; floor: the bottom sits directly on the floor'),
  seat: z.boolean().describe('Whether the top is a seat to sit on while putting shoes on (a low shoe bench, 420–480 mm high)'),
  wallMounted: z.boolean().describe(`Whether it is anchored to the wall: true when it has doors or is ${ASSUMPTIONS.tipping.criticalHeight} mm or taller, since it is shallow and tips over easily`),
})
export type ShoeRackPlan = z.infer<typeof ShoeRackPlan>

export const SHOE_RACK_LABELS = {
  front: { open: { option: 'Abierta', phrase: 'abierta' }, doors: { option: 'Con puertas', phrase: 'con puertas' } } satisfies Labels<ShoeRackPlan['front']>,
  base: { kick: { option: 'Con zoclo', phrase: 'con zoclo' }, floor: { option: 'Directa', phrase: 'sin zoclo' } } satisfies Labels<ShoeRackPlan['base']>,
}

/** Clear height inside the box, from its floor to its top, in mm. */
const innerHeight = (plan: ShoeRackPlan, t: number) => plan.dimensions.height - (plan.base === 'kick' ? KICK_HEIGHT.cabinet : 0) - 2 * t

const lowLevels = (plan: ShoeRackPlan) => plan.levels - (plan.bootLevel ? 1 : 0)

/** How the box is laid out: its columns, as few as keep every shelf (and the seat) within the span the sag check allows, and the boot level's share. */
function layoutOf(plan: ShoeRackPlan, catalog: Catalog) {
  const t = thicknessOf(catalog, plan.material)
  const board = materialById(catalog, plan.material)
  const inner = plan.dimensions.width - 2 * t
  const span = (load: Load) => (board ? maxSpan(plan.dimensions.depth, t, load, stiffness(board.grade, t).parallel) : MAX_SPAN)
  const longest = Math.min(span(SHELF_LOAD), plan.seat ? span('heavy') : Infinity)
  let columns = 1
  while ((inner - (columns - 1) * t) / columns > longest) columns++
  const columnWidth = (inner - (columns - 1) * t) / columns
  // The boot level keeps its height only while every low level above it still gets the least a shoe needs.
  const height = innerHeight(plan, t)
  const room = Math.min(BOOT_LEVEL_HEIGHT, height - lowLevels(plan) * (LEVEL_HEIGHT.min + t) - t / 2)
  const boot = !plan.bootLevel ? 0 : !lowLevels(plan) ? height : room >= LEVEL_HEIGHT.min ? room + t / 2 : 0
  const low = boot ? lowLevels(plan) : plan.levels
  const level = low ? (height - (plan.levels - 1) * t - (boot && boot - t / 2)) / low : 0
  return { t, columns, low, pairs: columns * Math.floor(columnWidth / PAIR_WIDTH) * plan.levels, bootShare: boot / height, bootHeight: boot && boot - t / 2, level }
}

/** The same box as a cabinet: its columns side by side, each with the boot level under a fixed shelf and the low levels above. */
function asCabinet(plan: ShoeRackPlan, layout: ReturnType<typeof layoutOf>): CabinetPlan {
  const content: Cell['content'] = plan.front === 'doors' ? 'door' : 'open'
  const columnWidth = (plan.dimensions.width - (layout.columns + 1) * layout.t) / layout.columns
  const doors = content === 'door' ? (columnWidth > ASSUMPTIONS.doors.maxWidth ? 2 : 1) : null
  const cells: Cell[] = []
  if (layout.bootShare > 0) cells.push({ height: layout.bootShare, content, shelves: 0, doors })
  if (layout.low) cells.push({ height: 1 - layout.bootShare, content, shelves: layout.low - 1, doors })
  return {
    kind: 'cabinet',
    name: plan.name,
    dimensions: plan.dimensions,
    material: plan.material,
    base: plan.base,
    wallMounted: plan.wallMounted,
    construction: { ...DEFAULT_CONSTRUCTION, top: plan.seat ? 'over' : 'between', shelves: 'fixed' },
    columns: Array.from({ length: layout.columns }, () => ({ width: 1, cells })),
  }
}

export function buildShoeRack(plan: ShoeRackPlan, catalog: Catalog): { design: Design; notes: string[] } {
  const layout = layoutOf(plan, catalog)
  const built = buildCabinet(asCabinet(plan, layout), catalog)
  const notes = [...built.notes]
  if (layout.low && layout.level < LEVEL_HEIGHT.min) notes.push(`Cada nivel queda de ${Math.round(layout.level)} mm de alto libre y un zapato bajo necesita ${LEVEL_HEIGHT.min}: quita un nivel o hazla más alta.`)
  if (plan.bootLevel && layout.bootHeight < BOOT_LEVEL_HEIGHT)
    notes.push(layout.bootHeight ? `El nivel para botas queda de ${Math.round(layout.bootHeight)} mm de alto libre; unas botas altas piden ${BOOT_LEVEL_HEIGHT}.` : 'No cupo el nivel para botas: los niveles de zapato bajo ocupan todo el alto.')
  if (!layout.pairs) notes.push(`Por dentro mide menos de ${PAIR_WIDTH} mm de ancho: no cabe un par.`)
  // Shoes are a light load; a seat carries a person.
  const pieces = built.design.pieces.map((p) =>
    plan.seat && p.id === 'top' ? { ...p, name: 'Asiento', load: 'heavy' as const } : p.role === 'shelf' || p.role === 'bottom' ? { ...p, load: SHELF_LOAD } : p,
  )
  return { design: { ...built.design, pieces, kind: 'shoeRack' }, notes }
}

function describeShoeRackChanges(before: ShoeRackPlan, after: ShoeRackPlan): string[] {
  const changes: string[] = []
  const [a, b] = [before.dimensions, after.dimensions]
  if (a.height !== b.height || a.width !== b.width || a.depth !== b.depth) changes.push(`medidas ${b.height} × ${b.width} × ${b.depth} mm`)
  if (before.material !== after.material) changes.push(`material ${after.material}`)
  if (before.levels !== after.levels) changes.push(`${after.levels} ${after.levels === 1 ? 'nivel' : 'niveles'}`)
  if (before.bootLevel !== after.bootLevel) changes.push(after.bootLevel ? 'nivel para botas abajo' : 'sin nivel para botas')
  if (before.front !== after.front) changes.push(SHOE_RACK_LABELS.front[after.front].phrase)
  if (before.base !== after.base) changes.push(SHOE_RACK_LABELS.base[after.base].phrase)
  if (before.seat !== after.seat) changes.push(after.seat ? 'con asiento arriba' : 'sin asiento')
  if (before.wallMounted !== after.wallMounted) changes.push(after.wallMounted ? 'anclada al muro' : 'sin anclar')
  return changes
}

function benchShoeRacks(): [string, ShoeRackPlan][] {
  const rack = (name: string, dimensions: ShoeRackPlan['dimensions'], extra: Partial<ShoeRackPlan> = {}): ShoeRackPlan => ({ kind: 'shoeRack', name, dimensions, material: 'T18', levels: 4, bootLevel: false, front: 'open', base: 'kick', seat: false, wallMounted: false, ...extra })
  return [
    ['abierta', rack('Zapatera', { width: 800, height: 900, depth: 330 })],
    ['con puertas', rack('Zapatera con puertas', { width: 800, height: 900, depth: 330 }, { front: 'doors', wallMounted: true })],
    ['angosta con una puerta', rack('Zapatera', { width: 500, height: 900, depth: 300 }, { front: 'doors', base: 'floor', wallMounted: true })],
    ['alta con nivel para botas', rack('Zapatera alta', { width: 800, height: 1500, depth: 380 }, { levels: 6, bootLevel: true, front: 'doors', wallMounted: true })],
    ['banca zapatera', rack('Banca zapatera', { width: 900, height: 450, depth: 330 }, { levels: 2, seat: true })],
  ]
}

const NAME: Record<ShoeRackPlan['front'], string> = { open: 'Zapatera', doors: 'Zapatera con puertas' }

const withSize = (plan: ShoeRackPlan, size: Partial<ShoeRackPlan['dimensions']>): ShoeRackPlan => ({ ...plan, dimensions: { ...plan.dimensions, ...size } })

/** A shoe rack's plan: its measures, its levels and front, and how it stands. */
const shoeRackFields: FieldSpec<ShoeRackPlan>[] = [
  section('Medidas', [
    numbers(3, [
      number({ key: 'dimensions.height', label: 'Alto', get: (p) => p.dimensions.height, set: (p, height) => withSize(p, { height }) }),
      number({ key: 'dimensions.width', label: 'Ancho', get: (p) => p.dimensions.width, set: (p, width) => withSize(p, { width }) }),
      number({ key: 'dimensions.depth', label: 'Fondo', get: (p) => p.dimensions.depth, set: (p, depth) => withSize(p, { depth }) }),
    ]),
  ]),
  section('Zapatos', [
    stepper({ key: 'levels', label: 'Niveles', ariaLabel: 'niveles para zapatos', min: 1, max: MAX_LEVELS, get: (p) => p.levels, set: (p, levels) => ({ ...p, levels }) }),
    yesNo({ key: 'bootLevel', label: 'Nivel para botas abajo', get: (p) => p.bootLevel, set: (p, bootLevel) => ({ ...p, bootLevel }) }),
    // The plain name follows the front; a name of its own stays.
    choice({ key: 'front', label: 'Frente', options: optionsOf(SHOE_RACK_LABELS.front), get: (p) => p.front, set: (p, front) => ({ ...p, front, name: p.name === NAME[p.front] ? NAME[front] : p.name }) }),
    yesNo({ key: 'seat', label: 'Asiento arriba', get: (p) => p.seat, set: (p, seat) => ({ ...p, seat }) }),
  ]),
  section('Cómo se arma', [
    material({ key: 'material', label: 'Triplay', use: 'carcass', get: (p) => p.material, set: (p, material) => ({ ...p, material }) }),
    choice({ key: 'base', label: 'Base', options: optionsOf(SHOE_RACK_LABELS.base), get: (p) => p.base, set: (p, base) => ({ ...p, base }) }),
    yesNo({ key: 'wallMounted', label: 'Anclada al muro', get: (p) => p.wallMounted, set: (p, wallMounted) => ({ ...p, wallMounted }) }),
  ]),
]

export const shoeRackModule: FurnitureModule<ShoeRackPlan> = {
  kind: 'shoeRack',
  schema: ShoeRackPlan,
  label: 'una zapatera',
  expert: { what: 'a shoe rack (a shallow box of flat shoe levels, open or with doors, optionally with a seat on top)' },
  build: buildShoeRack,
  describeChanges: describeShoeRackChanges,
  resize: (plan, axis, value) => ({ ok: true, plan: { ...plan, dimensions: { ...plan.dimensions, [DIMENSION_OF_AXIS[axis]]: value } } }),
  withMeasures: (plan, { width, height, depth }) => ({ ...plan, dimensions: { width, height, depth } }),
  summary: (_, dimensions) => measuresSummary(dimensions),
  measuresNote: () => null,
  traceLabel: (plan) => `Zapatera de ${plan.levels} ${plan.levels === 1 ? 'nivel' : 'niveles'} (${lower(SHOE_RACK_LABELS.front[plan.front].option)})`,
  benchVariants: benchShoeRacks,
  fields: shoeRackFields,
}
