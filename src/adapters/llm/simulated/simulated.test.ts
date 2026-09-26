import { describe, expect, it } from 'vitest'
import { analyze } from '../../../domain/analysis'
import { testCatalog } from '../../../domain/fixtures/catalog.test-util'
import { buildPlan } from '../../../domain/modules/plan'
import { expertPlans } from '../../../ports/LLMProvider'
import { createSimulated } from './simulated'

const plan = async (notes: string) => {
  const r = await createSimulated(0).planDesign!({ measures: null, photos: [], notes, reading: null, catalog: testCatalog, correction: null }, new AbortController().signal)
  return Object.values(expertPlans(r.value)).find((p) => p !== null) ?? null
}

describe('the simulated expert', () => {
  it('designs a shoe rack from its plan: the height said, doors and anchored, and it builds clean', async () => {
    const rack = await plan('Una zapatera de 90 cm de alto con puertas')
    expect(rack).toMatchObject({ kind: 'shoeRack', dimensions: { height: 900 }, front: 'doors', wallMounted: true })
    const a = analyze(buildPlan(rack!, testCatalog).design, testCatalog)
    expect(a.valid && a.findings).toEqual([])
  })

  it('makes room for the pairs asked, and a shoe bench is low and has a seat', async () => {
    expect(await plan('Zapatera para 12 pares')).toMatchObject({ kind: 'shoeRack', front: 'open', levels: 4, dimensions: { width: 750 } })
    expect(await plan('Una banca zapatera para la entrada')).toMatchObject({ kind: 'shoeRack', seat: true, dimensions: { height: 450 } })
  })
})
