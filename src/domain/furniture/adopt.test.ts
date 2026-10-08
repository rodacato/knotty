import { describe, expect, it } from 'vitest'
import { changedPaths, prepareAdoption } from './adopt'
import { testCatalog } from './fixtures/catalog.test-util'
import { testReferences } from './fixtures/references.test-util'

const sideboard = testReferences.latest('KC-APA-01')
if (!sideboard) throw new Error('missing')
const { version, ...file } = sideboard
const current = { file: file as Record<string, unknown>, version }
const withPlan = (change: (plan: Record<string, unknown>) => Record<string, unknown>) => change(structuredClone(file.plan) as Record<string, unknown>)

describe('changedPaths', () => {
  it('is empty for equal values and names each path that moved, down to a cell', () => {
    expect(changedPaths({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toEqual([])
    expect(changedPaths({ a: [1, { b: 2 }], c: 1 }, { a: [1, { b: 3 }], c: 1 })).toEqual(['a.1.b'])
    expect(changedPaths({ a: [1] }, { a: [1, 2], d: 'x' })).toEqual(['a.1', 'd'])
  })
})

describe('prepareAdoption', () => {
  it('has nothing to adopt when the candidate is the plan already there', () => {
    const r = prepareAdoption(current, file.plan as Record<string, unknown>, 'KC-APA-01', testCatalog)
    expect(r).toMatchObject({ ok: true, version, changes: [], expectChanges: [] })
  })

  it('makes the next version of a reference from a bare plan, keeping what it does not say and telling what moved', () => {
    const plan = withPlan((p) => ({ ...p, dimensions: { width: 1800, height: 940, depth: 400 } }))
    const r = prepareAdoption(current, plan, 'KC-APA-01', testCatalog)
    if (!r.ok) throw new Error(r.reasons.join())
    expect(r.version).toBe(version + 1)
    expect(r.changes).toEqual(['plan.dimensions.width'])
    expect(r.ficha).toMatchObject({ code: 'KC-APA-01', name: file.name, support: 'adapted', difficulty: 3 })
    expect(r.expectChanges.length).toBeGreaterThan(0)
    expect((r.ficha.expect as { valid: boolean }).valid).toBe(true)
  })

  it('takes what a candidate ficha says over the current one', () => {
    const r = prepareAdoption(current, { plan: file.plan, difficulty: 4 }, 'KC-APA-01', testCatalog)
    expect(r).toMatchObject({ ok: true, version: version + 1, changes: ['difficulty'], ficha: { difficulty: 4 } })
  })

  it('refuses a plan the engine cannot build, and says why', () => {
    const plan = withPlan((p) => ({ ...p, dimensions: { width: 1500, height: 3000, depth: 400 } }))
    const r = prepareAdoption(current, plan, 'KC-APA-01', testCatalog)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reasons[0]).toMatch(/cannot build/)
  })

  it('refuses a plan the schema does not read', () => {
    const r = prepareAdoption(current, withPlan((p) => ({ ...p, base: 'wheels' })), 'KC-APA-01', testCatalog)
    expect(!r.ok && r.reasons.join()).toMatch(/plan/)
  })

  it('starts a new reference at version 1 when the candidate says everything, and asks for what a KC one must say', () => {
    const generic = { id: 'a-new-one', home: undefined, rooms: ['office'], name: 'Nuevo', notes: 'Algo nuevo.', plan: file.plan }
    expect(prepareAdoption(null, generic, 'GN-ZZZ-01', testCatalog)).toMatchObject({ ok: true, version: 1, changes: ['(new reference)'], ficha: { code: 'GN-ZZZ-01', format: 1 } })
    const checked = prepareAdoption(null, generic, 'KC-ZZZ-01', testCatalog)
    expect(!checked.ok && checked.reasons.join()).toMatch(/a KC reference says/)
    expect(prepareAdoption(null, file.plan as Record<string, unknown>, 'GN-ZZZ-01', testCatalog).ok).toBe(false)
    const { rooms: _, ...roomless } = generic
    expect(prepareAdoption(null, roomless, 'GN-ZZZ-01', testCatalog)).toMatchObject({ ok: false })
  })
})
