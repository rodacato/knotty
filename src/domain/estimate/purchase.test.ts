import { describe, expect, it } from 'vitest'
import { analyze } from '../checks/analysis'
import type { Design } from '../design/schema'
import { exampleWallCabinet } from '../furniture/fixtures/wallCabinet'
import { exampleNightstand } from '../furniture/fixtures/nightstand'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../furniture/fixtures/bookcase'
import { layOut } from './layout'
import { estimatePurchase, edgeBandingMeters } from './purchase'
import { hardwarePerJoint } from '../design/hardwareCount'
import { extent, makePiece, mm, startAt } from '../design/builders'
import { resolveGeometry } from '../design/resolve'
import { buildPlan } from '../furniture/modules/plan'
import type { TablePlan } from '../furniture/modules/table'
import { materialById, usableSheet } from '../materials/catalog'

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

describe('a board at the edge of the usable sheet: the validation and the layout tell the same story', () => {
  const usable = usableSheet(testCatalog, materialById(testCatalog, 'T18')!)
  const { clearance } = testCatalog.layout
  /** What the validation refuses for its size, what the layout leaves out, and the sheets the purchase charges against the ones laid out. */
  const story = (d: Design) => {
    const a = analyze(d, testCatalog)
    if (!a.geo) throw new Error(JSON.stringify(a))
    const layout = layOut(d, a.geo, testCatalog)
    return {
      valid: a.valid,
      tooBig: a.valid ? [] : a.errors.filter((e) => e.code === 'E_TOO_BIG_FOR_SHEET').map((e) => e.data?.piece).sort(),
      unplaced: layout.flatMap((m) => m.unplaced.map((p) => p.id)).sort(),
      placed: layout.flatMap((m) => m.sheets.flatMap((h) => h.placed)),
      charged: estimatePurchase(d, a.geo, testCatalog).sheets.reduce((n, h) => n + h.sheets, 0),
      laidOut: layout.reduce((n, m) => n + m.sheets.length, 0),
    }
  }
  const desk: TablePlan = { kind: 'table', use: 'desk', name: 'Escritorio', material: 'T18', dimensions: { width: 1370, height: 760, depth: 630 }, overhang: 0, shelf: false, pedestal: { side: 'none', drawers: 0 }, legs: 'panel' }
  const deskOf = (depth: number) => buildPlan({ ...desk, dimensions: { ...desk.dimensions, depth } }, testCatalog).design
  const bookcaseOf = (height: number): Design => ({ ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, height } })

  it.each([
    ['exactly the usable width', 0],
    ['1 mm under', 1],
    ['the play under', clearance],
    ['past the play', clearance + 1],
  ])('a top across the sheet, %s, is valid and placed whole, and no sheet is charged for it apart', (_, under) => {
    const depth = usable.width - under
    const told = story(deskOf(depth))
    expect(told).toMatchObject({ valid: true, tooBig: [], unplaced: [] })
    expect(told.charged).toBe(told.laidOut)
    const top = told.placed.find((c) => c.id === 'top')!
    expect([top.w, top.h]).toEqual([desk.dimensions.width, depth])
    expect(top.y + top.h).toBeLessThanOrEqual(usable.width)
  })

  it.each([
    ['exactly the usable length', 0],
    ['1 mm under', 1],
    ['the play under', clearance],
  ])('a side along the sheet, %s, is placed whole', (_, under) => {
    const height = usable.length - under
    const told = story(bookcaseOf(height))
    expect(told.tooBig).not.toContain('side-left')
    expect(told.unplaced).toEqual(told.tooBig)
    const side = told.placed.find((c) => c.id === 'side-left')!
    expect(side.w).toBe(height)
    expect(side.x + side.w).toBeLessThanOrEqual(usable.length)
  })

  it('1 mm over the usable sheet is refused and not placed, either way of the sheet: never valid and left out', () => {
    const deep = story(deskOf(usable.width + 1))
    expect(deep.valid).toBe(false)
    expect(deep.tooBig).toContain('top')
    expect(deep.unplaced).toEqual(deep.tooBig)
    const tall = story(bookcaseOf(usable.length + 1))
    expect(tall.valid).toBe(false)
    expect(tall.tooBig).toEqual(expect.arrayContaining(['side-left', 'side-right']))
    expect(tall.unplaced).toEqual(tall.tooBig)
  })

  it('inside the sheet the play is still taken: two boards that only fill the width without it go on two sheets', () => {
    const half = (usable.width - testCatalog.layout.kerf) / 2
    const boards = (width: number): Design => ({
      ...exampleBookcase,
      joints: [],
      pieces: [0, 1].map((i) => makePiece({ id: `board-${i}`, name: `Tabla ${i}`, role: 'shelf', material: 'T18', normal: 'y', grain: 'length', x: extent(mm(0), mm(1300)), y: startAt(mm(100 * i)), z: extent(mm(0), mm(width)) })),
    })
    const sheetsOf = (d: Design) => {
      const r = resolveGeometry(d, testCatalog)
      if (!r.ok) throw new Error(JSON.stringify(r.errors))
      return layOut(d, r.value, testCatalog).map((m) => [m.sheets.length, m.unplaced.length])
    }
    expect(sheetsOf(boards(half))).toEqual([[2, 0]])
    expect(sheetsOf(boards(half - clearance))).toEqual([[1, 0]])
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
    expect(edgeBandingMeters(exampleBookcase, geo(exampleBookcase))).toBeCloseTo(((1800 * 2 + 514 * 6) / 1000) * 1.1, 1)
  })

  it('buys the edge banding by its role, not whatever else is sold by the metre', () => {
    const rope = { id: 'drawer-rope', name: 'Cordón', role: 'handle' as const, unit: 'meter' as const, perPack: null, length: null, sideClearance: null, mount: null, sku: null, price: 5 }
    const catalog = { ...testCatalog, hardware: [rope, ...testCatalog.hardware] }
    const r = estimatePurchase(exampleBookcase, geo(exampleBookcase), catalog)
    const tape = r.hardware.filter((h) => h.hardware.unit === 'meter')
    expect(tape.map((h) => [h.hardware.id, h.count])).toEqual([['edge-banding-19', Math.ceil(r.edgeBanding)]])
  })

  it('a pocket screw with no price yet is listed and named as missing a price', () => {
    const d = { ...exampleBookcase, joints: exampleBookcase.joints.map((u) => (u.type === 'pocket-screw' ? { ...u, hardware: [{ hardwareId: 'pocket-screw-1', count: 2 }] } : u)) }
    const r = estimatePurchase(d, geo(d), testCatalog)
    expect(r.hardware.find((h) => h.hardware.id === 'pocket-screw-1')).toMatchObject({ count: 4, packs: 1, cost: null })
    expect(r.cost.missingPrices).toContain('Tornillo de bolsillo de 25 mm (1") rosca gruesa')
  })

  it('builds the list with packs and total cost', () => {
    const r = estimatePurchase(exampleWallCabinet, geo(exampleWallCabinet), testCatalog)
    const hinges = r.hardware.find((h) => h.hardware.id === 'cup-hinge-35-full')!
    expect(hinges).toMatchObject({ count: 4, packs: 2 })
    expect(r.hardware.some((h) => h.hardware.id === 'white-glue')).toBe(true)
    expect(r.cost.missingPrices).toEqual([])
    expect(r.cost.total).toBe(r.sheets.reduce((s, h) => s + h.cost!, 0) + r.hardware.reduce((s, h) => s + h.cost!, 0))
  })

  it('lists the anti-tip kit for furniture that stands anchored, not for one that hangs or stands free', () => {
    const kits = (d: Design) => estimatePurchase(d, geo(d), testCatalog).hardware.find((h) => h.hardware.role === 'anti-tip')?.count ?? 0
    expect(kits(exampleBookcase)).toBe(1)
    expect(kits(exampleNightstand)).toBe(0)
    expect(kits(exampleWallCabinet)).toBe(0)
  })

  it('says which prices are missing', () => {
    const unpriced = { ...testCatalog, materials: testCatalog.materials.map((m) => ({ ...m, price: null })) }
    const r = estimatePurchase(exampleBookcase, geo(exampleBookcase), unpriced)
    expect(r.cost.missingPrices).toContain('Triplay de pino 18 mm')
  })
})
