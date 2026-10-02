import { describe, expect, it } from 'vitest'
import data from '../../../public/catalog/catalog.json'
import { analyze } from '../checks/analysis'
import type { Design } from '../design/schema'
import { exampleBookcase } from '../furniture/fixtures/bookcase'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import saved from '../session/state-v1.fixture.json'
import { migrateState } from '../session/migrate'
import { currentDesign, DesignState } from '../session/state'
import { applySettings, Catalog, finishSkus, type FinishSku } from './catalog'
import { FINISH_IDS, FINISH_LOOK, FINISH_PRODUCT_IDS, FINISH_PRODUCTS, FINISHES, finishOf, NATURAL_PINE } from './finishes'
import { containersFor, estimateFinish, finishArea, finishLitres } from './finishPurchase'
import { estimatePurchase } from './purchase'

const geo = (d: Design) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(JSON.stringify(a.errors))
  return a.geo
}
const sku = (litres: number, price: number | null = null): FinishSku => ({ id: `pu-${litres}`, name: `Barniz ${litres} L`, product: 'polyurethane-1k', litres, sku: null, price })

describe('finish knowledge', () => {
  it('every product says where its values come from and has a sane coverage or none', () => {
    for (const id of FINISH_PRODUCT_IDS) {
      const p = FINISH_PRODUCTS[id]
      expect(p.name).not.toBe('')
      expect(p.source).toMatch(/^docs\/carpinteria\/acabados\.md §/)
      const { min, max } = p.coverage ?? { min: 1, max: 1 }
      expect(min).toBeGreaterThan(0)
      expect(max).toBeGreaterThanOrEqual(min)
    }
  })

  it('every finish has its name, advice and source; a missing number is said, never filled in', () => {
    for (const id of FINISH_IDS) {
      const f = FINISHES[id]
      expect(f.name).not.toBe('')
      expect(f.advice).not.toBe('')
      expect(f.source).toMatch(/^docs\/carpinteria\/acabados\.md §/)
      const unknown = f.layers.some((l) => l.coats === null || FINISH_PRODUCTS[l.product].coverage === null)
      expect(!unknown || f.missing.some((m) => /coverage|coats/.test(m))).toBe(true)
    }
  })

  it('takes the data sheets as the reference gives them (acabados.md §14.1)', () => {
    expect(FINISH_PRODUCTS['polyurethane-1k'].coverage).toEqual({ min: 8, max: 8, per: 'coat' })
    expect(FINISH_PRODUCTS['water-based-color-varnish'].coverage).toEqual({ min: 10, max: 15, per: 'coat' })
    expect(FINISH_PRODUCTS['wood-primer'].coverage).toEqual({ min: 6, max: 7, per: 'system' })
    expect(FINISH_PRODUCTS['nitro-lacquer'].coverage).toBeNull()
    expect(FINISHES.polyurethane.layers.map((l) => [l.role, l.coats])).toEqual([['sealer', 1], ['finish', 3]])
    expect(FINISHES.none.layers).toEqual([])
  })

  it('the catalog sells every product in containers, with no price yet (the reference has none)', () => {
    for (const id of FINISH_PRODUCT_IDS) {
      const skus = finishSkus(testCatalog, id)
      expect(skus.length).toBeGreaterThan(0)
      for (const s of skus) expect(s.price).toBeNull()
    }
  })
})

describe('how a finish looks', () => {
  const light = (hex: string) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0)

  it('every finish has a colour, a sheen and whether it shows the grain; no finish is the unfinished wood but none', () => {
    for (const id of FINISH_IDS) {
      const look = FINISH_LOOK[id]
      expect(look.color).toMatch(/^#[0-9A-F]{6}$/)
      expect(look.roughness).toBeGreaterThan(0)
      expect(look.roughness).toBeLessThanOrEqual(1)
    }
    expect(FINISH_LOOK.none.color).toBe(NATURAL_PINE)
    expect(FINISH_IDS.filter((id) => FINISH_LOOK[id].color === NATURAL_PINE)).toEqual(['none'])
  })

  it('oils and varnishes go darker and warmer than the bare wood, and only paint hides the grain', () => {
    for (const id of ['polyurethane', 'marine-varnish', 'danish-oil'] as const) expect(light(FINISH_LOOK[id].color)).toBeLessThan(light(NATURAL_PINE))
    expect(FINISH_IDS.filter((id) => !FINISH_LOOK[id].grain)).toEqual(['paint'])
  })

  it('a varnish shines more than an oil, and an oil more than the bare wood (acabados.md §16.1)', () => {
    expect(FINISH_LOOK.polyurethane.roughness).toBeLessThan(FINISH_LOOK['danish-oil'].roughness)
    expect(FINISH_LOOK['danish-oil'].roughness).toBeLessThan(FINISH_LOOK.none.roughness)
  })
})

describe('litres and containers', () => {
  it('the reference worked example: 6 m², 3 coats of Polyform 3000 → 2.8 L (acabados.md §14.1)', () => {
    // 6 × 3 ÷ (8 × 0.8) = 18 ÷ 6.4 = 2.8125
    expect(finishLitres(6, 3, { min: 8, per: 'coat' })).toBeCloseTo(2.8125, 4)
    // A coverage for the whole system counts once: 6 ÷ (6 × 0.8) = 1.25
    expect(finishLitres(6, 2, { min: 6, per: 'system' })).toBeCloseTo(1.25, 4)
  })

  it('the bookcase: area of both faces, the back once, plus the banded edges; polyurethane with its sealer', () => {
    // Sides 1800 × 294 × 2 faces × 2 = 2 116 800; kick 514 × 70 × 2 = 71 960; bottom, top and 4 shelves 514 × 294 × 2 × 6 = 1 813 392;
    // back 550 × 1800 × 1 face = 990 000; front edges × 18: sides 1800 × 2, six boards 514 × 6 → 120 312. Total 5 112 464 mm² = 5.112 m².
    const g = geo(exampleBookcase)
    expect(finishArea(exampleBookcase, g)).toBeCloseTo(5.112464, 5)
    // 1 sealer + 3 coats: 5.112464 × 4 ÷ (8 × 0.8) = 3.1953 L → one 4 L container (four of 1 L are as much and more containers).
    const f = estimateFinish({ ...exampleBookcase, finish: 'polyurethane' }, g, testCatalog)!
    expect(f.lines).toMatchObject([{ product: 'polyurethane-1k', coats: 4, litres: 3.2 }])
    expect(f.lines[0].containers.map((c) => [c.sku.litres, c.count])).toEqual([[4, 1]])
    expect(f.sandpaper).toEqual([120, 180, 220, 320])
  })

  it('rounds up to the containers: least left over, then fewest; the cheapest once every size has a price', () => {
    const counts = (r: ReturnType<typeof containersFor>) => r.map((c) => [c.sku.litres, c.count])
    expect(counts(containersFor(2.81, [sku(1), sku(4)]))).toEqual([[1, 3]])
    expect(counts(containersFor(3.37, [sku(1), sku(4)]))).toEqual([[4, 1]])
    expect(counts(containersFor(4.2, [sku(1), sku(4)]))).toEqual([[4, 1], [1, 1]])
    expect(counts(containersFor(0.3, [sku(1), sku(4)]))).toEqual([[1, 1]])
    expect(counts(containersFor(2.81, [sku(1, 300), sku(4, 800)]))).toEqual([[4, 1]])
    expect(containersFor(2, [])).toEqual([])
  })

  it('a hardwax oil has no coverage in the reference: it is listed with its coats, no litres and no invented number', () => {
    expect(FINISH_PRODUCTS['hardwax-oil'].coverage).toBeNull()
    expect(FINISHES['hardwax-oil'].missing).toEqual(expect.arrayContaining([expect.stringMatching(/coverage/)]))
    const f = estimateFinish({ ...exampleBookcase, finish: 'hardwax-oil' }, geo(exampleBookcase), testCatalog)!
    expect(f.lines.map((l) => [l.product, l.coats, l.litres, l.containers.length])).toEqual([['hardwax-oil', 2, null, 0]])
    expect(finishSkus(testCatalog, 'hardwax-oil').map((x) => x.litres)).toEqual([0.75, 1.3])
  })

  it('a finish the reference cannot measure is listed without litres, and is not a missing price', () => {
    const f = estimateFinish({ ...exampleBookcase, finish: 'lacquer' }, geo(exampleBookcase), testCatalog)!
    expect(f.lines.map((l) => [l.product, l.litres, l.containers.length])).toEqual([['nitro-sealer', null, 0], ['nitro-lacquer', null, 0]])
  })
})

describe('the finish in the shopping list', () => {
  it('without a finish the list is as before', () => {
    const r = estimatePurchase(exampleBookcase, geo(exampleBookcase), testCatalog)
    expect(r.finish).toBeNull()
    expect(r.cost.missingPrices).not.toContain('Barniz de poliuretano Polyform 3000 4 L')
  })

  it('the containers go in the missing prices until the person sets them, and then in the total', () => {
    const d: Design = { ...exampleBookcase, finish: 'polyurethane' }
    const g = geo(d)
    const before = estimatePurchase(d, g, testCatalog)
    expect(before.cost.missingPrices).toContain('Barniz de poliuretano Polyform 3000 4 L')
    const priced = applySettings(testCatalog, { prices: { 'polyurethane-1k-4l': 950 }, layout: null })
    expect(finishSkus(priced, 'polyurethane-1k').find((s) => s.litres === 4)?.price).toBe(950)
    const after = estimatePurchase(d, g, priced)
    expect(after.cost.missingPrices).not.toContain('Barniz de poliuretano Polyform 3000 4 L')
    expect(after.finish?.lines[0].cost).toBe(950)
    expect(after.cost.total).toBe(before.cost.total + 950)
  })
})

describe('what was saved before finishes', () => {
  it('a saved session has no finish and reads as none', () => {
    const state = DesignState.parse(migrateState(saved))
    for (const v of state.versions) expect(v.design.finish).toBeUndefined()
    expect(finishOf(currentDesign(state))).toBe('none')
  })

  it('a chosen finish survives saving and loading', () => {
    const state = DesignState.parse(migrateState(saved))
    const withFinish = { ...state, versions: state.versions.map((v) => ({ ...v, design: { ...v.design, finish: 'paint' as const } })) }
    expect(currentDesign(DesignState.parse(JSON.parse(JSON.stringify(withFinish)))).finish).toBe('paint')
  })

  it('a cached catalog without finishes still loads, with none', () => {
    const { finishes: _, ...old } = data
    expect(Catalog.parse(old).finishes).toEqual([])
  })
})
