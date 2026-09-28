import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { MODULES } from '../../domain/furniture/modules/plan'
import type { BedPlan } from '../../domain/furniture/modules/bed'
import { DesignState } from '../../domain/session/state'
import type { DesignRepository } from '../../ports/DesignRepository'
import { createUseCases } from '.'

const memory = (): DesignRepository & { saved: () => DesignState | null } => {
  let state: DesignState | null = null
  return { load: () => state, save: (s) => void (state = s), clear: () => void (state = null), saved: () => state }
}

describe('«Ahorrar material» in a session', () => {
  const bed = MODULES.bed.benchVariants().find(([n]) => n === 'queen, cabecera lisa, cajones de los dos lados hacia el pie')![1]

  it('keeps the locks with the design, saved, and the search honors them', () => {
    const repository = memory()
    const c = createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository })
    const built = c.applyPlan(c.fromExample(exampleBookcase), bed)
    if (!built.ok) throw new Error(built.message)
    expect(c.findSavings(built.state, bed).options[0].changes).toEqual(['Cajones por lado de 3 a 2'])

    const locked = c.lockField(built.state, 'drawers.count', true)
    expect(repository.saved()?.locks).toEqual({ 'drawers.count': true })
    expect(locked.versions).toHaveLength(built.state.versions.length)
    const r = c.findSavings(locked, bed)
    expect(r.locked).toEqual(['colchón', 'cajones por lado'])
    expect(r.options.every((o) => (o.plan as BedPlan).drawers.count === 3)).toBe(true)
  })

  it('a session saved before locks existed opens with none', () => {
    const repository = memory()
    const c = createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository })
    const { locks: _, ...older } = c.fromExample(exampleBookcase)
    expect(DesignState.parse(older).locks).toEqual({})
  })
})
