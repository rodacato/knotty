import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createBundledReferences } from '../../adapters/references/store'
import { exampleOf } from '../../domain/furniture/examples'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { leafCells, type CabinetPlan } from '../../domain/furniture/modules/cabinet'
import { FurniturePlan } from '../../domain/furniture/modules/plan'
import { currentDesign } from '../../domain/session/state'
import { answerWith, expertCanWrite, expertPlans, PlanAdjustment, type LLMProvider } from '../../ports/LLMProvider'
import { createUseCases, currentPlan } from './index'

const store = createBundledReferences()
const plans = store.all().flatMap((r) => (r.plan ? [{ code: r.code, plan: r.plan }] : []))

/** What comes back of a plan the expert returns untouched: its answer as Knotty reads it. */
const echoed = (plan: FurniturePlan) => {
  const answer = PlanAdjustment.safeParse({ explanation: '', summary: '', action: 'plan', ...answerWith(plan), questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [] })
  return answer.success ? expertPlans(answer.data)[plan.kind] : null
}

describe('a plan the expert cannot write back', () => {
  it('is every shipped cabinet with a void, a chest, a split cell or a cell with something of its own, and no other ficha', () => {
    const lost = plans.filter(({ plan }) => !expertCanWrite(plan))
    expect(lost.map(({ code }) => code).sort()).toEqual([
      'GN-BAU-01', 'GN-CLO-01', 'GN-COC-03', 'GN-LIB-02', 'GN-TV-01', 'KC-APA-02', 'KC-BUR-01', 'KC-CAJ-01', 'KC-CAJ-02', 'KC-CAJ-03', 'KC-CAJ-04',
      'KC-CON-01', 'KC-LIB-01', 'KC-LIB-04', 'KC-LIB-09', 'KC-OTR-03', 'KC-OTR-04', 'KC-REP-02', 'KC-REP-03', 'KC-TV-01', 'KC-TV-03',
    ])
    expect(lost.map(({ plan }) => plan.kind)).toEqual(lost.map(() => 'cabinet'))
    expect(plans.filter(({ plan }) => plan.kind === 'cabinet')).toHaveLength(42)
  })

  it('tells apart, ficha by ficha, the plan that comes back whole from the one that comes back without something or not at all', () => {
    const backWhole = plans.filter(({ plan }) => isDeepStrictEqual(echoed(plan), FurniturePlan.parse(plan)))
    expect(backWhole.map(({ code }) => code)).toEqual(plans.filter(({ plan }) => expertCanWrite(plan)).map(({ code }) => code))
    expect(backWhole).toHaveLength(39)
  })

  it('keeps GN-BAU-01 off the plan path, so its chest is not closed over', async () => {
    const calls: string[] = []
    const trunk = store.latest('GN-BAU-01')!
    const sideboard = store.latest('GN-APA-01')!
    const origin = { provider: 'test', model: 'controlled', promptId: 'test' }
    const llm: LLMProvider = {
      ...createSimulated(0),
      adjustPlan: async ({ plan }) => {
        calls.push('plan')
        return { value: { explanation: 'Listo.', summary: 'Poner jaladeras', action: 'plan', ...answerWith(echoed(plan) ?? plan), questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [] }, origin, usage: {} }
      },
      proposeAdjustment: async () => {
        calls.push('pieces')
        return { value: { explanation: 'No propuse cambios en las piezas.', summary: '', operations: [], questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [], acceptedRisks: [] }, origin, usage: {} }
      },
    }
    let id = 0
    const useCases = createUseCases({ llm: () => llm, catalog: testCatalog, repository: { load: () => null, save: () => {}, clear: () => {} }, now: () => '2026-10-09T18:00:00Z', newId: () => `write-${++id}` })
    const request = 'Que se vea más ligero, como de catálogo.'
    const signal = new AbortController().signal

    const initial = useCases.openExample(exampleOf(trunk))
    const lids = currentDesign(initial).pieces.filter((p) => p.role === 'door').length
    expect(leafCells((trunk.plan as CabinetPlan).columns).some((c) => c.content === 'chest')).toBe(true)
    const state = await useCases.adjust(initial, request, signal)
    expect(calls).toEqual(['pieces'])
    expect(currentPlan(state).plan).toEqual(trunk.plan)
    expect(currentDesign(state).pieces.filter((p) => p.role === 'door')).toHaveLength(lids)

    calls.length = 0
    await useCases.adjust(useCases.openExample(exampleOf(sideboard)), request, signal)
    expect(calls).toEqual(['plan'])
  })
})
