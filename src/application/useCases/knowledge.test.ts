import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { exampleSideboard } from '../../domain/furniture/fixtures/references.test-util'
import type { KnowledgeSelection } from '../../domain/furniture/knowledge/select'
import type { ToolLevel } from '../../domain/materials/tools'
import type { DesignRepository } from '../../ports/DesignRepository'
import type { LLMProvider } from '../../ports/LLMProvider'
import { createUseCases } from '.'

const repository = (): DesignRepository => ({ load: () => null, save: () => {}, clear: () => {} })
const signal = () => new AbortController().signal

function spy() {
  const seen: { method: string; knowledge: KnowledgeSelection | null | undefined }[] = []
  const simulated = createSimulated(0)
  const note = (method: string, r: { knowledge?: KnowledgeSelection | null }) => seen.push({ method, knowledge: r.knowledge })
  const llm: LLMProvider = {
    ...simulated,
    readPhoto: async (r, s) => (note('readPhoto', r), simulated.readPhoto(r, s)),
    planDesign: async (r, s) => (note('planDesign', r), simulated.planDesign!(r, s)),
    reconstruct: async (r, s) => (note('reconstruct', r), simulated.reconstruct(r, s)),
    adjustPlan: async (r) => (note('adjustPlan', r), Promise.reject(new Error('no plans in the simulated expert'))),
    proposeAdjustment: async (r, s) => (note('proposeAdjustment', r), simulated.proposeAdjustment(r, s)),
    reviewPurchase: async (r, s) => (note('reviewPurchase', r), simulated.reviewPurchase(r, s)),
  }
  return { llm, seen }
}

const request = { measures: null, photos: [], thumbnails: [], notes: 'Un librero', kind: 'bookcase' as const }
const build = (toolLevel?: ToolLevel) => {
  const { llm, seen } = spy()
  return { seen, c: createUseCases({ llm: () => llm, catalog: testCatalog, repository: repository(), toolLevel: toolLevel && (() => toolLevel) }) }
}
const sent = (seen: ReturnType<typeof spy>['seen'], method: string) => seen.find((s) => s.method === method)?.knowledge

describe('the knowledge selected for the expert', () => {
  it('carries the person’s tool level and the chosen kind’s guide to the skeleton', async () => {
    const { c, seen } = build(3)
    await c.reconstruct(request, signal())
    expect(sent(seen, 'planDesign')).toEqual({ core: 'full', guide: 'bookcase', guideSize: 'full', tools: 3 })
  })

  it('defaults to level 1 when nobody says', async () => {
    const { c, seen } = build()
    await c.reconstruct(request, signal())
    expect(sent(seen, 'planDesign')?.tools).toBe(1)
  })

  it('follows the level at call time', async () => {
    const { llm, seen } = spy()
    let level: ToolLevel = 1
    const c = createUseCases({ llm: () => llm, catalog: testCatalog, repository: repository(), toolLevel: () => level })
    await c.reconstruct(request, signal())
    level = 2
    await c.reconstruct(request, signal())
    expect(seen.filter((s) => s.method === 'planDesign').map((s) => s.knowledge?.tools)).toEqual([1, 2])
  })

  it('reaches the plan adjustment and the review from the design in hand', async () => {
    const { c, seen } = build(2)
    const state = c.openExample(exampleSideboard)
    await c.adjust(state, 'Hazlo más elegante', signal())
    await c.reviewPurchase(state, testCatalog, signal())
    expect(sent(seen, 'adjustPlan')).toEqual({ core: 'short', guide: 'sideboard', guideSize: 'full', tools: 2 })
    expect(sent(seen, 'proposeAdjustment')).toMatchObject({ core: 'short', guideSize: 'short', tools: 2 })
    expect(sent(seen, 'reviewPurchase')).toMatchObject({ core: 'short', guideSize: 'short', tools: 2 })
  })

  it('selects no guide and no tools for a photo reading', async () => {
    const { c, seen } = build(3)
    await c.readPhoto({ base64: 'abc' }, 'Un librero')
    expect(sent(seen, 'readPhoto')).toEqual({ core: 'photo', guide: null, guideSize: 'short', tools: null })
  })
})
