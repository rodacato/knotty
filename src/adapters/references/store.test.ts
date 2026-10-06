import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exampleDesign, exampleOf } from '../../domain/furniture/examples'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { createBundledReferences, createReferenceStore } from './store'

const store = createBundledReferences()

describe('reference store', () => {
  it('has every ficha shipped, and gives the latest of one by its code', () => {
    expect(store.all().length).toBeGreaterThan(0)
    for (const r of store.all()) expect(store.latest(r.code)).toBe(r)
    expect(store.latest('KC-APA-01')).toMatchObject({ code: 'KC-APA-01', version: 6, plan: { kind: 'cabinet', base: 'legs' } })
  })

  it('holds one reference for each ficha file in its folder, so the fichas drawer lists a new one with nothing else to change', () => {
    const files = readdirSync(dirname(fileURLToPath(import.meta.url))).filter((f) => f.endsWith('.json'))
    expect(store.all().map((r) => `${r.code.toLowerCase()}.v${r.version}.json`).sort()).toEqual(files.sort())
  })

  it('answers null for a code it does not have', () => {
    expect(store.latest('KC-ZZZ-99')).toBeNull()
  })

  it('puts every reference with a plan on the home screen, the ones with a place there first and in its order', () => {
    const placed = store.all().filter((r) => r.home)
    expect(placed.map((r) => r.home?.order)).toEqual(placed.map((_, i) => i + 1))
    expect(store.home().map((b) => b.code)).toEqual([...placed, ...store.all().filter((r) => !r.home && r.plan)].map((r) => r.code))
  })

  it('a reference that is a design, not a plan, stays off the home screen and opens as its own design', () => {
    const benchtop = store.latest('GN-TAL-02')!
    expect(benchtop.plan).toBeUndefined()
    expect(store.home().map((b) => b.code)).not.toContain('GN-TAL-02')
    const { design, plan } = exampleDesign(exampleOf(benchtop), testCatalog)
    expect(plan).toBeNull()
    expect(design).toMatchObject({ name: 'Banco de sobremesa', kind: 'benchtop', notes: benchtop.notes })
    expect(design.pieces.filter((p) => p.material === 'MDF18').map((p) => p.id)).toEqual(['top-left', 'top-right'])
  })

  it('fails on a bad file instead of shipping it', () => {
    expect(() => createReferenceStore({ './aparador.json': {} })).toThrow(/aparador\.json: the name is/)
  })
})
