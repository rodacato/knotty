import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { exampleBookcase } from '../../domain/fixtures/bookcase'
import { testCatalog } from '../../domain/fixtures/catalog.test-util'
import { DEFAULT_CONSTRUCTION } from '../../domain/modules/cabinet'
import { currentDesign, type DesignState } from '../../domain/session/state'
import type { DesignRepository } from '../../ports/DesignRepository'
import { buildContext } from '../context'
import { createUseCases, currentPlan, reviewSignature } from '.'

const memory = (): DesignRepository => {
  let state: DesignState | null = null
  return { load: () => state, save: (s) => void (state = s), clear: () => void (state = null) }
}
let id = 0
const setup = () => createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: memory(), now: () => '2026-09-25T10:00:00Z', newId: () => `f${++id}` })
const cabinet = (height: number) => ({
  kind: 'cabinet' as const,
  name: 'Cajonera',
  dimensions: { width: 500, height, depth: 450 },
  material: 'T18',
  base: 'kick' as const,
  wallMounted: true,
  construction: DEFAULT_CONSTRUCTION,
  columns: [{ width: 1, cells: [0, 1, 2].map(() => ({ height: 1, content: 'drawer' as const, shelves: null, doors: null })) }],
})

describe('choosing the finish', () => {
  it('is a version of its own with the same pieces, said in the chat', () => {
    const c = setup()
    const initial = c.fromExample(exampleBookcase)
    const state = c.chooseFinish(initial, 'polyurethane')
    expect(state.versions).toHaveLength(initial.versions.length + 1)
    expect(currentDesign(state)).toEqual({ ...currentDesign(initial), finish: 'polyurethane' })
    expect(state.versions.at(-1)?.summary).toBe('Acabado: barniz de poliuretano')
    expect(state.chat.at(-1)?.text).toBe('Elegí el acabado: barniz de poliuretano.')
    expect(c.chooseFinish(state, 'polyurethane')).toBe(state)
  })

  it('keeps the plan alive, and a design rebuilt from the plan keeps the finish', () => {
    const c = setup()
    const built = c.applyPlan(c.fromExample(exampleBookcase), cabinet(900))
    if (!built.ok) throw new Error(built.message)
    const finished = c.chooseFinish(built.state, 'paint')
    expect(currentPlan(finished)).toMatchObject({ diverged: false })
    const taller = c.applyPlan(finished, cabinet(1000))
    if (!taller.ok) throw new Error(taller.message)
    expect(currentDesign(taller.state).finish).toBe('paint')
  })

  it('does not ask for a new purchase review, and the expert reads it in one line', () => {
    const c = setup()
    const initial = c.fromExample(exampleBookcase)
    const state = c.chooseFinish(initial, 'danish-oil')
    expect(reviewSignature(state, testCatalog)).toBe(reviewSignature(initial, testCatalog))
    const context = buildContext(state, testCatalog)
    expect(context).toContain('Finish the person chose (Knotty keeps it and buys it): Aceite danés.')
    expect(context).not.toContain('"finish"')
    expect(buildContext(initial, testCatalog)).not.toContain('Finish the person chose')
  })
})
