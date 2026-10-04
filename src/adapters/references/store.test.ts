import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FEATURED_MAX } from '../../domain/furniture/references'
import { createBundledReferences, createReferenceStore } from './store'

const store = createBundledReferences()

describe('reference store', () => {
  it('has every ficha shipped, and gives the latest of one by its code', () => {
    expect(store.all().length).toBeGreaterThan(0)
    for (const r of store.all()) expect(store.latest(r.code)).toBe(r)
    expect(store.latest('KC-APA-01')).toMatchObject({ code: 'KC-APA-01', version: 5, plan: { kind: 'cabinet', base: 'legs' } })
  })

  it('holds one reference for each ficha file in its folder, so the fichas drawer lists a new one with nothing else to change', () => {
    const files = readdirSync(dirname(fileURLToPath(import.meta.url))).filter((f) => f.endsWith('.json'))
    expect(store.all().map((r) => `${r.code.toLowerCase()}.v${r.version}.json`).sort()).toEqual(files.sort())
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

  it('features at most one cell less than the home grid, which keeps the last for designing your own', () => {
    const featured = store.home().filter((b) => b.featured)
    expect(featured.length).toBeGreaterThan(0)
    expect(featured.length).toBeLessThanOrEqual(FEATURED_MAX)
  })

  it('puts the featured ones first, so a category lists them before the others', () => {
    const flags = store.home().map((b) => b.featured)
    expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)))
  })

  it('fails on a bad file instead of shipping it', () => {
    expect(() => createReferenceStore({ './aparador.json': {} })).toThrow(/aparador\.json: the name is/)
  })
})
