import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { applySettings, type Catalog } from '../../domain/materials/catalog'
import type { DesignRepository } from '../../ports/DesignRepository'
import type { LLMProvider } from '../../ports/LLMProvider'
import { createUseCases } from '.'

const repository = (): DesignRepository => ({ load: () => null, save: () => {}, clear: () => {} })
const signal = () => new AbortController().signal
const request = { measures: null, photos: [], thumbnails: [], notes: 'Un librero', kind: null }

function spy() {
  const seen: Catalog[] = []
  const simulated = createSimulated(0)
  const llm: LLMProvider = {
    ...simulated,
    planDesign: async (s, sig) => (seen.push(s.catalog), simulated.planDesign!(s, sig)),
    reconstruct: async (s, sig) => (seen.push(s.catalog), simulated.reconstruct(s, sig)),
  }
  return { llm, seen }
}

describe('the catalog the expert reads', () => {
  it('is the base catalog by default', async () => {
    const { llm, seen } = spy()
    await createUseCases({ llm: () => llm, catalog: testCatalog, repository: repository() }).reconstruct(request, signal())
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.every((catalog) => catalog === testCatalog)).toBe(true)
  })

  it('follows the person’s settings at call time, not at creation', async () => {
    const { llm, seen } = spy()
    let trim = 20
    const promptCatalog = () => applySettings(testCatalog, { prices: {}, layout: { ...testCatalog.layout, trim } })
    const c = createUseCases({ llm: () => llm, catalog: testCatalog, promptCatalog, repository: repository() })
    await c.reconstruct(request, signal())
    trim = 35
    await c.reconstruct(request, signal())
    expect(new Set(seen.map((catalog) => catalog.layout.trim))).toEqual(new Set([20, 35]))
  })
})
