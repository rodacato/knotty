import type { Design } from '../design/schema'
import type { Catalog } from '../materials/catalog'
import type { FinishId } from '../materials/finishes'
import { exampleBookcase } from './fixtures/bookcase'
import { exampleNightstand } from './fixtures/nightstand'
import { exampleWallCabinet } from './fixtures/wallCabinet'
import { DEFAULT_CONSTRUCTION, type CabinetPlan } from './modules/cabinet'
import { buildPlan, type FurniturePlan } from './modules/plan'

// The examples the person can start from: a ready design, or a plan Knotty builds, so the plan sheet and the local requests work from the first click.

export type Example =
  | { name: string; design: Design }
  | {
      name: string
      plan: FurniturePlan
      /** What the example is, for the person: the builder leaves a plan's design without notes. */
      notes: string
      finish?: FinishId
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
  // The original stands on splayed legs, which no plan has yet: a kick plate for now.
  base: 'kick',
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

export const exampleSideboard: Example = {
  name: 'Aparador',
  plan: sideboardPlan,
  notes: 'Aparador de comedor de cuatro columnas: abajo tres puertas embutidas con un entrepaño cada una y dos cajones a la derecha; arriba un cajoncito y tres nichos abiertos. Terminado natural con barniz de poliuretano.',
  finish: 'polyurethane',
}

/** The examples on the home screen, in order. */
export const EXAMPLES: Example[] = [
  { name: exampleBookcase.name, design: exampleBookcase },
  { name: exampleNightstand.name, design: exampleNightstand },
  { name: exampleWallCabinet.name, design: exampleWallCabinet },
  exampleSideboard,
]

/** The example's design, and the plan it comes from when it has one. */
export function exampleDesign(example: Example, catalog: Catalog): { design: Design; plan: FurniturePlan | null } {
  if ('design' in example) return { design: example.design, plan: null }
  const { design } = buildPlan(example.plan, catalog)
  return { design: { ...design, notes: example.notes, ...(example.finish ? { finish: example.finish } : {}) }, plan: example.plan }
}
