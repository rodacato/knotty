import { describe, expect, it } from 'vitest'
import { createBundledReferences, createReferenceStore } from './store'

const store = createBundledReferences()

describe('reference store', () => {
  it('has every ficha shipped, and gives the latest of one by its code', () => {
    expect(store.all().length).toBeGreaterThan(0)
    for (const r of store.all()) expect(store.latest(r.code)).toBe(r)
    expect(store.latest('KC-APA-01')).toMatchObject({ code: 'KC-APA-01', version: 3, plan: { kind: 'cabinet', base: 'legs' } })
  })

  it('answers null for a code it does not have', () => {
    expect(store.latest('KC-ZZZ-99')).toBeNull()
  })

  it('puts on the home screen only the references that have a place there, in its order', () => {
    const home = store.home()
    const placed = store.all().filter((r) => r.home)
    expect(home.map((b) => b.code)).toEqual(placed.map((r) => r.code))
    expect(placed.map((r) => r.home?.order)).toEqual(placed.map((_, i) => i + 1))
  })

  it('fails on a bad file instead of shipping it', () => {
    expect(() => createReferenceStore({ './aparador.json': {} })).toThrow(/aparador\.json: the name is/)
  })
})
