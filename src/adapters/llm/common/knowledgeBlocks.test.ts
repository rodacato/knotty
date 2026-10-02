import { describe, expect, it } from 'vitest'
import { exampleBookcase } from '../../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../../domain/furniture/fixtures/catalog.test-util'
import type { KnowledgeSelection } from '../../../domain/furniture/knowledge/select'
import { createExpert, type Transport } from './expert'

const knowledge: KnowledgeSelection = { core: 'full', guide: 'bookcase', guideSize: 'full', tools: 3 }
const signal = new AbortController().signal

async function rendered(run: (expert: ReturnType<typeof createExpert>, knowledge: KnowledgeSelection | undefined) => Promise<unknown>, withKnowledge: boolean) {
  const calls: unknown[] = []
  const transport: Transport = {
    provider: 'test',
    model: 'm',
    async completeJSON(system, content, schema) {
      calls.push({ system, content, schema })
      return { json: {}, usage: {} }
    },
  }
  await run(createExpert(transport, 'Test'), withKnowledge ? knowledge : undefined).catch(() => {})
  return calls
}

describe('the expert does not read the knowledge selection yet', () => {
  const state = { measures: null, photos: [], notes: 'un librero', reading: null, catalog: testCatalog, correction: null }
  it.each([
    ['reconstruct', (e: ReturnType<typeof createExpert>, k?: KnowledgeSelection) => e.reconstruct({ ...state, knowledge: k }, signal)],
    ['planDesign', (e: ReturnType<typeof createExpert>, k?: KnowledgeSelection) => e.planDesign!({ ...state, knowledge: k, routeKind: 'bookcase' }, signal)],
    ['proposeAdjustment', (e: ReturnType<typeof createExpert>, k?: KnowledgeSelection) => e.proposeAdjustment({ context: 'c', request: 'más ancho', design: exampleBookcase, proposal: null, catalog: testCatalog, correction: null, knowledge: k }, signal)],
    ['reviewPurchase', (e: ReturnType<typeof createExpert>, k?: KnowledgeSelection) => e.reviewPurchase({ context: 'c', review: 'r', design: exampleBookcase, checks: [], catalog: testCatalog, knowledge: k }, signal)],
    ['readPhoto', (e: ReturnType<typeof createExpert>, k?: KnowledgeSelection) => e.readPhoto({ photo: { base64: 'abc' }, context: 'c', knowledge: k }, signal)],
  ])('%s sends the same prompt with or without it', async (_, run) => {
    const without = await rendered(run, false)
    expect(without.length).toBeGreaterThan(0)
    expect(await rendered(run, true)).toEqual(without)
  })
})
