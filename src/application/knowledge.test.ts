import { describe, expect, it } from 'vitest'
import { exampleBookcase } from '../domain/furniture/fixtures/bookcase'
import { exampleSideboard } from '../domain/furniture/fixtures/references.test-util'
import { createUseCases } from './useCases'
import { testCatalog } from '../domain/furniture/fixtures/catalog.test-util'
import { createSimulated } from '../adapters/llm/simulated/simulated'
import { knowledgeFor, knowledgeForNew } from './knowledge'

const c = createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: { load: () => null, save: () => {}, clear: () => {} } })

describe('knowledgeFor', () => {
  it('takes the guide from a design built with its module', () => {
    expect(knowledgeFor(c.openExample(exampleSideboard), 2, 'plan-adjust')).toEqual({ core: 'short', guide: 'sideboard', guideSize: 'full', tools: 2, advice: { use: 'sideboard', operations: ['adjust', 'chat'] } })
  })

  it('a design without a plan takes the guide of its use from the module that use maps to', () => {
    expect(knowledgeFor(c.fromExample(exampleBookcase), 1, 'piece').guide).toBe('bookcase')
  })

  it('lowers the tools by what the person said', () => {
    const state = c.openExample(exampleSideboard)
    const said = { ...state, requirements: [{ id: 'tools', text: 'Solo tengo taladro', type: 'tool' as const, axis: null, min: null, max: null }] }
    expect(knowledgeFor(said, 3, 'review').tools).toBe(1)
  })
})

describe('knowledgeForNew', () => {
  it.each([
    ['bookcase', 'bookcase'],
    ['bench', null],
    [null, null],
  ] as const)('a %s with no design yet gets guide %s', (use, guide) => {
    expect(knowledgeForNew(use, 1, 'skeleton').guide).toBe(guide)
  })
})
