import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import type { Design } from '../diseno/schema'
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
  it.each([exampleBookcase, exampleNightstand, exampleWallCabinet])('places everything without overlaps, inside the usable sheet and along the grain: $nombre', (d) => {
    const g = geo(d)
    for (const m of layOut(d, g, testCatalog)) {
      expect(m.unplaced).toEqual([])
      const piezas = d.pieces.filter((p) => p.material === m.material)
      expect(m.sheets.flatMap((h) => h.placed).map((c) => c.id).sort()).toEqual(piezas.map((p) => p.id).sort())
      for (const h of m.sheets) {
        for (const c of h.placed) {
          expect(c.x + c.w).toBeLessThanOrEqual(m.usable.length)
          expect(c.y + c.h).toBeLessThanOrEqual(m.usable.width)
          const p = piezas.find((x) => x.id === c.id)!
          if (p.grain === 'length') expect(c.w).toBeGreaterThanOrEqual(c.h)
        }
        for (const [i, a] of h.placed.entries())
          for (const b of h.placed.slice(i + 1)) {
            const separadas = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
            expect(separadas, `${a.id} y ${b.id} se enciman`).toBe(true)
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
    const ancho = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 1100 } }
    const hojas = estimatePurchase(ancho, geo(ancho), testCatalog).sheets.find((h) => h.material.id === 'T18')!.sheets
    expect(hojas).toBe(2)
  })

  it('a piece larger than the sheet is left unplaced and counts as a sheet of its own', () => {
    const g = geo(exampleBookcase)
    const enorme = { ...testCatalog, materials: testCatalog.materials.map((m) => (m.id === 'TR6' ? { ...m, sheet: { length: 1500, width: 1220 } } : m)) }
    const tr6 = layOut(exampleBookcase, g, enorme).find((m) => m.material === 'TR6')!
    expect(tr6.unplaced.map((p) => p.id)).toEqual(['trasera'])
  })
})

describe('hardware and purchase', () => {
  it('works out screws and nails by spacing along the joint', () => {
    const g = geo(exampleBookcase)
    const joint = (id: string) => exampleBookcase.joints.find((u) => u.id === id)!
    expect(hardwarePerJoint(joint('u-piso-izq'), g)).toBe(2)
    expect(hardwarePerJoint(joint('u-trasera-lat-izq'), g)).toBe(13)
  })

  it('adds up edge banding for the marked edges, with waste', () => {
    expect(edgeBandingMeters(exampleBookcase, geo(exampleBookcase))).toBeCloseTo(((1800 * 2 + 564 * 6) / 1000) * 1.1, 1)
  })

  it('builds the list with packs and total cost', () => {
    const r = estimatePurchase(exampleWallCabinet, geo(exampleWallCabinet), testCatalog)
    const bisagras = r.hardware.find((h) => h.hardware.id === 'cup-hinge-35-full')!
    expect(bisagras).toMatchObject({ count: 4, packs: 2 })
    expect(r.hardware.some((h) => h.hardware.id === 'white-glue')).toBe(true)
    expect(r.cost.missingPrices).toEqual([])
    expect(r.cost.total).toBe(r.sheets.reduce((s, h) => s + h.cost!, 0) + r.hardware.reduce((s, h) => s + h.cost!, 0))
  })

  it('says which prices are missing', () => {
    const sinPrecio = { ...testCatalog, materials: testCatalog.materials.map((m) => ({ ...m, price: null })) }
    const r = estimatePurchase(exampleBookcase, geo(exampleBookcase), sinPrecio)
    expect(r.cost.missingPrices).toContain('Triplay de pino 18 mm')
  })
})
