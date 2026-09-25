import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import type { Design } from '../design/schema'
import { exampleWallCabinet } from '../fixtures/wallCabinet'
import { exampleNightstand } from '../fixtures/nightstand'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { layOut } from './layout'
import { hardwarePerJoint, estimatePurchase, edgeBandingMeters } from './purchase'

const geo = (d: Design) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(JSON.stringify(a.errors))
  return a.geo
}

describe('sheet layout', () => {
  it.each([exampleBookcase, exampleNightstand, exampleWallCabinet])('places everything without overlaps, inside the usable sheet and along the grain: $name', (d) => {
    const g = geo(d)
    for (const m of layOut(d, g, testCatalog)) {
      expect(m.unplaced).toEqual([])
      const pieces = d.pieces.filter((p) => p.material === m.material)
      expect(m.sheets.flatMap((h) => h.placed).map((c) => c.id).sort()).toEqual(pieces.map((p) => p.id).sort())
      for (const h of m.sheets) {
        for (const c of h.placed) {
          expect(c.x + c.w).toBeLessThanOrEqual(m.usable.length)
          expect(c.y + c.h).toBeLessThanOrEqual(m.usable.width)
          const p = pieces.find((x) => x.id === c.id)!
          expect(p.grain !== 'length' || c.w >= c.h, `${c.id} runs across the grain`).toBe(true)
        }
        for (const [i, a] of h.placed.entries())
          for (const b of h.placed.slice(i + 1)) {
            const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
            expect(apart, `${a.id} y ${b.id} se enciman`).toBe(true)
          }
        expect(h.waste).toBeGreaterThan(0)
        expect(h.waste).toBeLessThan(1)
      }
    }
  })

  it('the 60 cm bookcase takes one 18 mm sheet and one back sheet', () => {
    const r = estimatePurchase(exampleBookcase, geo(exampleBookcase), testCatalog)
    expect(r.sheets.map((h) => [h.material.id, h.sheets])).toEqual([
      ['T18', 1],
      ['TR6', 1],
    ])
  })

  it('wider takes more sheets', () => {
    const wide = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 1100 } }
    const sheetCount = estimatePurchase(wide, geo(wide), testCatalog).sheets.find((h) => h.material.id === 'T18')!.sheets
    expect(sheetCount).toBe(2)
  })

  it('a piece larger than the sheet is left unplaced and counts as a sheet of its own', () => {
    const g = geo(exampleBookcase)
    const hugeSheet = { ...testCatalog, materials: testCatalog.materials.map((m) => (m.id === 'TR6' ? { ...m, sheet: { length: 1500, width: 1220 } } : m)) }
    const tr6 = layOut(exampleBookcase, g, hugeSheet).find((m) => m.material === 'TR6')!
    expect(tr6.unplaced.map((p) => p.id)).toEqual(['back'])
  })
})

describe('hardware and purchase', () => {
  it('works out screws and nails by spacing along the joint', () => {
    const g = geo(exampleBookcase)
    const joint = (id: string) => exampleBookcase.joints.find((u) => u.id === id)!
    expect(hardwarePerJoint(joint('j-bottom-left'), g)).toBe(2)
    expect(hardwarePerJoint(joint('j-back-side-left'), g)).toBe(13)
  })

  it('adds up edge banding for the marked edges, with waste', () => {
    expect(edgeBandingMeters(exampleBookcase, geo(exampleBookcase))).toBeCloseTo(((1800 * 2 + 564 * 6) / 1000) * 1.1, 1)
  })

  it('builds the list with packs and total cost', () => {
    const r = estimatePurchase(exampleWallCabinet, geo(exampleWallCabinet), testCatalog)
    const hinges = r.hardware.find((h) => h.hardware.id === 'cup-hinge-35-full')!
    expect(hinges).toMatchObject({ count: 4, packs: 2 })
    expect(r.hardware.some((h) => h.hardware.id === 'white-glue')).toBe(true)
    expect(r.cost.missingPrices).toEqual([])
    expect(r.cost.total).toBe(r.sheets.reduce((s, h) => s + h.cost!, 0) + r.hardware.reduce((s, h) => s + h.cost!, 0))
  })

  it('says which prices are missing', () => {
    const unpriced = { ...testCatalog, materials: testCatalog.materials.map((m) => ({ ...m, price: null })) }
    const r = estimatePurchase(exampleBookcase, geo(exampleBookcase), unpriced)
    expect(r.cost.missingPrices).toContain('Triplay de pino 18 mm')
  })
})
