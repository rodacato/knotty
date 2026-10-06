import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { settlePlan } from '../../domain/furniture/modules/plan'
import type { TablePlan } from '../../domain/furniture/modules/table'
import { createUseCases, currentPlan } from './index'

const dining: TablePlan = {
  kind: 'table', use: 'dining', name: 'Mesa de comedor', material: 'T18',
  dimensions: { width: 1500, height: 750, depth: 900 }, overhang: 50,
  shelf: false, pedestal: { side: 'none', drawers: 0 }, legs: 'panel',
}
const desk: TablePlan = { ...dining, use: 'desk', name: 'Escritorio', dimensions: { width: 1300, height: 750, depth: 600 }, overhang: 0 }

function saved(legacy: TablePlan) {
  let id = 0
  const useCases = createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: { load: () => null, save: () => {}, clear: () => {} }, now: () => '2026-10-05T18:00:00Z', newId: () => `legacy-${++id}` })
  const state = useCases.openExample({ name: dining.name, plan: dining, notes: 'Mueble inventado para regresión.' })
  // What an older expert could save: the plan says something the built furniture does not have.
  const versions = state.versions.map((v, i) => (i === state.versions.length - 1 ? { ...v, plan: legacy } : v))
  return { useCases, state: { ...state, versions } }
}

describe('a plan saved before the table rules', () => {
  it('is read as what was built: no pedestal on a dining table, no shelf on a desk', () => {
    expect(settlePlan({ ...dining, pedestal: { side: 'left', drawers: 2 } })).toEqual(dining)
    expect(settlePlan({ ...desk, shelf: true })).toEqual(desk)
    expect(settlePlan({ ...desk, pedestal: { side: 'left', drawers: 0 } })).toEqual(desk)
  })

  it('stays the same object when it has nothing to settle, and a desk keeps its pedestal', () => {
    expect(settlePlan(dining)).toBe(dining)
    const withPedestal = { ...desk, pedestal: { side: 'right' as const, drawers: 3 } }
    expect(settlePlan(withPedestal)).toBe(withPedestal)
  })

  it('can still be edited: the person is not stuck on a field the form hides', () => {
    const { useCases, state } = saved({ ...dining, pedestal: { side: 'left', drawers: 2 } })
    expect(currentPlan(state).plan).toEqual(dining)
    const plan = currentPlan(state).plan as TablePlan
    const edited = useCases.applyPlan(state, { ...plan, dimensions: { ...plan.dimensions, width: 1600 } })
    if (!edited.ok) throw new Error(edited.message)
    expect(currentPlan(edited.state).plan).toMatchObject({ dimensions: { width: 1600 }, pedestal: { side: 'none', drawers: 0 } })
  })

  it('does not hide a plan that is wrong on its own: a pedestal with five drawers is still rejected', () => {
    const { useCases, state } = saved(desk)
    expect(useCases.previewPlan(state, { ...desk, pedestal: { side: 'left', drawers: 5 } }).ok).toBe(false)
  })
})
