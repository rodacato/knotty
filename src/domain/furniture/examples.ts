import type { Design } from '../design/schema'
import type { DesignKind } from '../design/kind'
import type { Catalog } from '../materials/catalog'
import type { FinishId } from '../materials/finishes'
import { DEFAULT_CONSTRUCTION, type CabinetPlan } from './modules/cabinet'
import { buildPlan, type FurniturePlan } from './modules/plan'

// What the person can start from: a ready design, or a plan Knotty builds (a base), so the plan sheet and the local requests work from the first click.

export type Example =
  | { name: string; design: Design }
  | {
      name: string
      plan: FurniturePlan
      /** What the example is, for the person: the builder leaves a plan's design without notes. */
      notes: string
      finish?: FinishId
      /** What it is, since a cabinet plan does not say it. */
      kind?: DesignKind
    }

const door = (height: number) => ({ height, content: 'door' as const, shelves: 1, doors: 1 })
const drawer = (height: number) => ({ height, content: 'drawer' as const, shelves: null, doors: null })
const open = (height: number) => ({ height, content: 'open' as const, shelves: 0, doors: null })

/** The first product of the reference catalog (KC-APA-01), a sideboard: what its photos show that a cabinet plan can say (step 29 of the proposal). */
export const sideboardPlan: CabinetPlan = {
  kind: 'cabinet',
  name: 'Aparador',
  dimensions: { width: 1600, height: 940, depth: 400 },
  material: 'T18',
  // The original stands on splayed legs: here straight ones, of two glued layers, under an apron (step 30).
  base: 'legs',
  // 940 mm with doors and drawers: anchored to the wall (R4).
  wallMounted: true,
  construction: { ...DEFAULT_CONSTRUCTION, doors: 'inset', drawerFronts: 'inset', top: 'between', back: 'nailed', shelves: 'movable' },
  columns: [
    { width: 1, cells: [door(0.75), drawer(0.25)] },
    { width: 1, cells: [door(0.75), open(0.25)] },
    { width: 1, cells: [door(0.75), open(0.25)] },
    { width: 1, cells: [drawer(0.375), drawer(0.375), open(0.25)] },
  ],
}

export const exampleSideboard: Extract<Example, { plan: FurniturePlan }> = {
  name: 'Aparador',
  plan: sideboardPlan,
  notes: 'Aparador de comedor de cuatro columnas: abajo tres puertas embutidas con un entrepaño cada una y dos cajones a la derecha; arriba un cajoncito y tres nichos abiertos. Terminado natural con barniz de poliuretano.',
  finish: 'polyurethane',
  kind: 'sideboard',
}

/** Where a base goes in the home screen's filter. */
export type BaseCategory = 'bedroom' | 'storage' | 'tables'

/** A starting point on the home screen: always a plan, so the ficha edits it without the expert. `reference` is the catalog product it approximates. */
export type Base = Extract<Example, { plan: FurniturePlan }> & { id: string; category: BaseCategory; reference?: string }

const lowSideboard: Base = {
  id: 'low-sideboard',
  name: 'Aparador bajo',
  category: 'storage',
  reference: 'KC-APA-02',
  kind: 'sideboard',
  notes: 'Aparador bajo de tres columnas: una puerta a cada lado con un entrepaño detrás y un hueco abierto en medio.',
  plan: {
    kind: 'cabinet',
    name: 'Aparador bajo',
    dimensions: { width: 1500, height: 700, depth: 390 },
    material: 'T18',
    base: 'kick',
    // 700 mm with doors: past the anchoring threshold for storage (R4).
    wallMounted: true,
    construction: DEFAULT_CONSTRUCTION,
    columns: [
      { width: 1, cells: [door(1)] },
      { width: 1, cells: [open(1)] },
      { width: 1, cells: [door(1)] },
    ],
  },
}

const openBookcase: Base = {
  id: 'open-bookcase',
  name: 'Librero abierto',
  category: 'storage',
  reference: 'KC-LIB-01',
  kind: 'bookcase',
  notes: 'Librero abierto de dos columnas con repisas móviles, trasera clavada y anclado al muro.',
  plan: {
    kind: 'cabinet',
    name: 'Librero abierto',
    dimensions: { width: 900, height: 1950, depth: 290 },
    material: 'T18',
    base: 'kick',
    wallMounted: true,
    construction: DEFAULT_CONSTRUCTION,
    // Two columns: one shelf across 900 mm would sag under books.
    columns: [
      { width: 1, cells: [{ height: 1, content: 'open', shelves: 5, doors: null }] },
      { width: 1, cells: [{ height: 1, content: 'open', shelves: 5, doors: null }] },
    ],
  },
}

const bedWithDrawers: Base = {
  id: 'bed-with-drawers',
  name: 'Cama con cajones',
  category: 'bedroom',
  reference: 'KC-CAM-02',
  notes: 'Cama matrimonial con dos cajones de cada lado y cabecera lisa.',
  plan: {
    kind: 'bed',
    name: 'Cama con cajones',
    mattress: 'matrimonial',
    material: 'T18',
    height: 400,
    drawers: { side: 'both', count: 2, position: 'center' },
    headboard: { style: 'plain', height: 1000, depth: 0, shelves: 0 },
  },
}

const shoeRack: Base = {
  id: 'shoe-rack',
  name: 'Zapatera',
  category: 'storage',
  reference: 'KC-OTR-03',
  notes: 'Zapatera de cuatro niveles con dos puertas, anclada al muro.',
  plan: { kind: 'shoeRack', name: 'Zapatera', dimensions: { width: 630, height: 1000, depth: 380 }, material: 'T18', levels: 4, bootLevel: false, front: 'doors', base: 'kick', seat: false, wallMounted: true },
}

const nightstand: Base = {
  id: 'nightstand',
  name: 'Buró',
  category: 'bedroom',
  reference: 'KC-BUR-01',
  kind: 'nightstand',
  notes: 'Buró con un cajón arriba y un hueco abierto abajo.',
  plan: {
    kind: 'cabinet',
    name: 'Buró',
    dimensions: { width: 450, height: 500, depth: 350 },
    material: 'T18',
    base: 'floor',
    wallMounted: false,
    construction: DEFAULT_CONSTRUCTION,
    columns: [{ width: 1, cells: [open(0.6), drawer(0.4)] }],
  },
}

const coffeeTable: Base = {
  id: 'coffee-table',
  name: 'Mesa de centro',
  category: 'tables',
  notes: 'Mesa de centro con una repisa baja entre los costados.',
  plan: { kind: 'table', use: 'coffee', name: 'Mesa de centro', material: 'T18', dimensions: { width: 1000, height: 420, depth: 550 }, overhang: 0, shelf: true, pedestal: { side: 'none', drawers: 0 } },
}

/** The bases on the home screen, in order. */
export const BASES: Base[] = [
  lowSideboard,
  openBookcase,
  bedWithDrawers,
  shoeRack,
  nightstand,
  coffeeTable,
  { ...exampleSideboard, id: 'sideboard-on-legs', name: 'Aparador con patas', plan: { ...sideboardPlan, name: 'Aparador con patas' }, category: 'storage', reference: 'KC-APA-01' },
]

/** The example's design, and the plan it comes from when it has one. */
export function exampleDesign(example: Example, catalog: Catalog): { design: Design; plan: FurniturePlan | null } {
  if ('design' in example) return { design: example.design, plan: null }
  const { design } = buildPlan(example.plan, catalog)
  return { design: { ...design, notes: example.notes, ...(example.finish ? { finish: example.finish } : {}), ...(example.kind ? { kind: example.kind } : {}) }, plan: example.plan }
}
