import { describe, expect, it } from 'vitest'
import { testCatalog } from '../domain/furniture/fixtures/catalog.test-util'
import { buildPlan, MODULES, type FurniturePlan } from '../domain/furniture/modules/plan'
import type { LLMProvider } from '../ports/LLMProvider'
import { quickActions } from './quickActions'
import { createUseCases } from './useCases'

/** No expert at all: any call to it fails the test. */
const noExpert = new Proxy({ id: 'none', label: 'Nadie' } as LLMProvider, {
  get: (target, key) => (key in target ? target[key as keyof LLMProvider] : () => Promise.reject(new Error(`the expert was asked: ${String(key)}`))),
})
const useCases = createUseCases({ llm: () => noExpert, catalog: testCatalog, repository: { load: () => null, save: () => {}, clear: () => {} } })
const signal = () => new AbortController().signal

const variant = (kind: keyof typeof MODULES, name: string) => (MODULES[kind].benchVariants() as [string, FurniturePlan][]).find(([n]) => n === name)![1]
const opened = (plan: FurniturePlan) => useCases.fromExample(buildPlan(plan, testCatalog).design, plan)

const PIECES: [string, FurniturePlan][] = [
  ['a bookcase', variant('cabinet', 'librero')],
  ['a chest of drawers', variant('cabinet', 'cajonera')],
  ['a dining table', variant('table', 'comedor')],
  ['a desk', variant('table', 'escritorio')],
  ['a bed', variant('bed', 'individual, sin cabecera, sin cajones')],
  ['a shoe rack', variant('shoeRack', 'abierta')],
]

describe('what Knotty offers to do by itself', () => {
  it.each(PIECES)('offers %s a few requests, each to a different part of it', (_, plan) => {
    const actions = quickActions(opened(plan), testCatalog)
    expect(actions.length).toBeGreaterThanOrEqual(4)
    expect(actions.length).toBeLessThanOrEqual(6)
    expect(new Set(actions).size).toBe(actions.length)
  })

  it.each(PIECES)('carries out every request it offers %s without the expert: a new version, or a change that waits for the person', async (_, plan) => {
    const state = opened(plan)
    const failed: string[] = []
    for (const request of quickActions(state, testCatalog)) {
      const after = await useCases.adjust(state, request, signal())
      if (after.chat.at(-1)?.error || (after.current === state.current && !after.proposal)) failed.push(request)
    }
    expect(failed).toEqual([])
  })

  it('offers what the piece does not have yet, and stops offering it once it does', async () => {
    const state = opened(variant('cabinet', 'librero'))
    expect(quickActions(state, testCatalog)).toContain('Ponle puertas')
    const withDoors = await useCases.adjust(state, 'Ponle puertas', signal())
    expect(quickActions(withDoors, testCatalog)).not.toContain('Ponle puertas')
  })

  it('offers nothing for a design with no plan, or while a proposal waits', () => {
    const state = opened(variant('cabinet', 'librero'))
    expect(quickActions(useCases.fromExample(buildPlan(variant('cabinet', 'librero'), testCatalog).design), testCatalog)).toEqual([])
    expect(quickActions({ ...state, proposal: { design: state.versions[0].design } as typeof state.proposal }, testCatalog)).toEqual([])
  })
})
