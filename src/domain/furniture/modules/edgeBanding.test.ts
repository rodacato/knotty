import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import type { Design, Edge } from '../../design/schema'
import type { Operation } from '../../editing/operations/schema'
import { estimatePurchase } from '../../estimate/purchase'
import { testCatalog } from '../fixtures/catalog.test-util'
import { testReferences } from '../fixtures/references.test-util'
import { buildPlan, describePlanChanges, FurniturePlan, MODULES } from './plan'
import { rebuildFromPlan } from './rebuild'

const IN_SIGHT = {
  cabinet: 'aparador con patas, cantos a la vista',
  table: 'escritorio con 3 cajones a la izquierda, cantos a la vista',
  bed: 'queen, cabecera librero, cajones de los dos lados, cantos a la vista',
  shoeRack: 'con puertas, cantos a la vista',
} as const

const variant = (kind: keyof typeof IN_SIGHT) => (MODULES[kind].benchVariants() as [string, FurniturePlan][]).find(([name]) => name === IN_SIGHT[kind])![1]
const unbanded = (design: Design) => ({ ...design, pieces: design.pieces.map((p) => ({ ...p, edges: [] })) })
const bandedIds = (design: Design) => design.pieces.filter((p) => p.edges.length).map((p) => p.id)
const checked = (design: Design) => {
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return a
}
const unsaid = (plan: FurniturePlan) => FurniturePlan.parse(Object.fromEntries(Object.entries(plan).filter(([key]) => key !== 'edges')))

function purchaseOf(plan: FurniturePlan) {
  const design = buildPlan(plan, testCatalog).design
  const purchase = estimatePurchase(design, checked(design).geo, testCatalog)
  const tape = purchase.hardware.find((h) => h.hardware.role === 'edge-banding')
  return { purchase, tape, rest: purchase.hardware.filter((h) => h !== tape).map((h) => [h.hardware.id, h.count, h.cost]) }
}

describe.each(Object.keys(IN_SIGHT) as (keyof typeof IN_SIGHT)[])('the edges of a %s', (kind) => {
  const exposed = variant(kind)
  const banded = { ...exposed, edges: 'banded' } as FurniturePlan

  it('in sight, no piece is born banded: panels, doors, drawer fronts and boxes', () => {
    const built = buildPlan(banded, testCatalog).design
    expect(new Set(built.pieces.filter((p) => p.edges.length).map((p) => p.role)).size).toBeGreaterThan(1)
    expect(bandedIds(buildPlan(exposed, testCatalog).design)).toEqual([])
  })

  it('changes nothing but the edges of the pieces, and warns of nothing new', () => {
    const [a, b] = [buildPlan(banded, testCatalog), buildPlan(exposed, testCatalog)]
    expect(b.design).toEqual(unbanded(a.design))
    expect(b.notes).toEqual(a.notes)
    const messages = (design: Design) => [...checked(design).findings, ...checked(design).warnings].map((f) => f.message)
    expect(messages(b.design)).toEqual(messages(a.design))
  })

  it('banded is what a plan that does not say builds', () => {
    expect(buildPlan(unsaid(exposed), testCatalog)).toEqual(buildPlan(banded, testCatalog))
  })

  it('says the change, and nothing when a plan that did not say is told banded', () => {
    expect(describePlanChanges(banded, exposed)).toEqual(['cantos a la vista'])
    expect(describePlanChanges(exposed, banded)).toEqual(['con cubrecanto'])
    expect(describePlanChanges(unsaid(exposed), banded)).toEqual([])
  })
})

describe('what edges in sight take off the purchase', () => {
  // The sideboard of the catalog, and a table of the «Triplay visto» line.
  it.each(['KC-APA-01', 'KC-MES-02'])('%s: no edge banding, and the cost drops by exactly its line', (code) => {
    const reference = testReferences.latest(code)!
    const plan = reference.plan!
    const [banded, exposed] = [purchaseOf(plan), purchaseOf(FurniturePlan.parse({ ...plan, edges: 'exposed' }))]
    expect(banded.tape!.count).toBe(reference.expect.hardware['edge-banding-19'])
    expect(banded.purchase.edgeBanding).toBeGreaterThan(0)
    expect(exposed.purchase.edgeBanding).toBe(0)
    expect(exposed.tape).toBeUndefined()
    expect(exposed.purchase.cost.total).toBe(banded.purchase.cost.total - banded.tape!.cost!)
    expect(exposed.rest).toEqual(banded.rest)
    expect(exposed.purchase.sheets).toEqual(banded.purchase.sheets)
  })
})

describe('a piece banded or bared on top of the plan', () => {
  const plan = variant('cabinet')
  const edges = (id: string, value: Edge[]): Operation => ({ op: 'changeProperties', id, name: null, role: null, grain: null, load: null, support: null, edges: value, confidence: null })

  it('keeps its banding when the whole piece leaves its edges in sight', () => {
    const { design, dropped } = rebuildFromPlan(plan, [edges('top', ['front'])], testCatalog)
    expect(dropped).toEqual([])
    expect(bandedIds(design)).toEqual(['top'])
  })

  it('stays bare when the whole piece goes back to edge banding', () => {
    const { design } = rebuildFromPlan({ ...plan, edges: 'banded' }, [edges('top', [])], testCatalog)
    expect(design.pieces.find((p) => p.id === 'top')!.edges).toEqual([])
    expect(bandedIds(design).length).toBeGreaterThan(1)
  })
})

describe('what the field does not take', () => {
  it.each(['rounded', 'none', ''])('refuses «%s»: a profile is the piece’s (D45), not the plan’s', (value) => {
    expect(FurniturePlan.safeParse({ ...variant('table'), edges: value }).success).toBe(false)
  })
})
