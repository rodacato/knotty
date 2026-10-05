import { describe, expect, it } from 'vitest'
import { analyze } from '../checks/analysis'
import { estimatePurchase } from '../estimate/purchase'
import { testCatalog } from './fixtures/catalog.test-util'
import { testReferences } from './fixtures/references.test-util'
import { leafCells, type CabinetPlan } from './modules/cabinet'
import { countLimits, quickCounts, setCount } from './modules/cabinetCounts'
import { buildPlan, MODULES } from './modules/plan'
import { checkBuilt, fitToSpace, isQuick, measureLimits, spaceOverflow, summarizePlan } from './quick'
import { valueFields } from './modules/fields'

const cabinets = testReferences.all().flatMap((r) => (r.plan.kind === 'cabinet' ? [[r.code, r.plan] as [string, CabinetPlan]] : []))
const others = testReferences.all().flatMap((r) => (r.plan.kind !== 'cabinet' ? [[r.code, r.plan] as const] : []))

describe('what a module says is quick', () => {
  it('only the cabinet declares it, and its quick fields are fields of its form', () => {
    expect(Object.values(MODULES).filter((m) => m.quick).map((m) => m.kind)).toEqual(['cabinet'])
    const keys = valueFields(MODULES.cabinet.fields).map((f) => f.key)
    for (const key of MODULES.cabinet.quick!.fields) expect(keys).toContain(key)
  })

  it('the shipped bases of other modules stay as they are', () => {
    for (const [, plan] of others) {
      expect(isQuick(plan)).toBe(false)
      const fit = fitToSpace(plan, { width: 500, height: 500, depth: 500 }, testCatalog)
      expect(fit.plan).toBe(plan)
      expect(fit.insideLimits).toBe(true)
    }
  })
})

describe.each(cabinets)('the counts of %s', (_, plan) => {
  it('are read from its cells', () => {
    const cells = leafCells(plan.columns)
    expect(quickCounts(plan)).toEqual({ drawer: cells.filter((c) => c.content === 'drawer').length, door: cells.filter((c) => c.content === 'door').length, open: cells.filter((c) => c.content === 'open').length })
  })

  it('setting the count it has changes nothing', () => {
    const result = setCount(plan, 'drawer', quickCounts(plan).drawer, testCatalog)
    expect(result).toMatchObject({ ok: true, plan })
  })

  it.each(['drawer', 'door', 'open'] as const)('one more or one less %s gives a valid design or says why not', (kind) => {
    const now = quickCounts(plan)[kind]
    for (const target of [now + 1, Math.max(0, now - 1)]) {
      const result = setCount(plan, kind, target, testCatalog)
      const built = checkBuilt(result.plan, testCatalog)
      expect(quickCounts(result.plan)[kind] === target).toBe(result.ok)
      expect(result.ok || result.message.length > 0).toBe(true)
      expect(built.problems).toEqual([])
      expect(analyze(built.design, testCatalog).valid).toBe(true)
    }
  })

  it('the limits bracket the count, and the maximum is reachable while one more is not', () => {
    const limits = countLimits(plan, testCatalog)
    for (const kind of ['drawer', 'door', 'open'] as const) {
      const now = quickCounts(plan)[kind]
      expect(limits[kind].min).toBeLessThanOrEqual(now)
      expect(limits[kind].max).toBeGreaterThanOrEqual(now)
      expect(setCount(plan, kind, limits[kind].max, testCatalog).ok).toBe(true)
      expect(setCount(plan, kind, limits[kind].max + 1, testCatalog).ok).toBe(false)
    }
  })
})

describe('changing counts', () => {
  const sideboard = cabinets.find(([code]) => code === 'KC-APA-01')![1]

  it('adds a drawer by splitting a cell and keeps the other counts', () => {
    const result = setCount(sideboard, 'drawer', 4, testCatalog)
    expect(result.ok).toBe(true)
    expect(quickCounts(result.plan)).toEqual({ ...quickCounts(sideboard), drawer: 4, open: quickCounts(sideboard).open })
    expect(result.plan.columns.flatMap((c) => c.cells).length).toBe(sideboard.columns.flatMap((c) => c.cells).length + 1)
  })

  it('removing the last cell of a column takes the column out, never the last cell of the piece', () => {
    const single: CabinetPlan = { ...sideboard, columns: [{ width: 1, cells: [{ height: 1, content: 'open', shelves: 2, doors: null }] }] }
    expect(countLimits(single, testCatalog).open.min).toBe(1)
    expect(setCount(single, 'open', 0, testCatalog)).toMatchObject({ ok: false, message: 'Tiene que quedar al menos un hueco.' })
    const two: CabinetPlan = { ...single, columns: [...single.columns, { width: 1, cells: [{ height: 1, content: 'door', shelves: 0, doors: 1 }] }] }
    const result = setCount(two, 'door', 0, testCatalog)
    expect(result.ok && result.plan.columns.length).toBe(1)
  })

  it('reports why when a drawer has no room', () => {
    const shallow: CabinetPlan = { ...sideboard, dimensions: { ...sideboard.dimensions, depth: 150 } }
    const result = setCount(shallow, 'drawer', 6, testCatalog)
    expect(result.ok).toBe(false)
  })
})

describe('fitting a base to a space', () => {
  const sideboard = cabinets.find(([code]) => code === 'KC-APA-01')![1]

  it('takes an approximate space in whole cm, never above it', () => {
    const fit = fitToSpace(sideboard, { width: 1503, depth: 380 }, testCatalog)
    expect(fit.measures).toEqual({ width: 1500, depth: 380, height: sideboard.dimensions.height })
    expect(fit.axes.width.status).toBe('rounded-down')
    expect(fit.axes.depth.status).toBe('as-asked')
    expect(fit.axes.height.status).toBe('kept')
    expect(fit.insideLimits && fit.fitsSpace).toBe(true)
    expect(fit.problems).toEqual([])
  })

  it('holds a measure at its limit and says it did not fit the space', () => {
    const limits = measureLimits(sideboard, testCatalog)
    const tooShallow = fitToSpace(sideboard, { depth: limits.depth.min - 50 }, testCatalog)
    expect(tooShallow.axes.depth).toMatchObject({ status: 'raised', proposed: limits.depth.min })
    expect(tooShallow.insideLimits).toBe(false)
    expect(tooShallow.fitsSpace).toBe(false)
    expect(tooShallow.problems).toEqual([])
    const huge = fitToSpace(sideboard, { width: 99999 }, testCatalog)
    expect(huge.axes.width).toMatchObject({ status: 'lowered', proposed: limits.width.max })
    expect(huge.fitsSpace).toBe(true)
  })

  it.each(cabinets)('%s holds at both ends of every measure and fails just past them', (_, plan) => {
    const limits = measureLimits(plan, testCatalog)
    const dims = buildPlan(plan, testCatalog).design.dimensions
    for (const axis of ['width', 'depth', 'height'] as const) {
      const { min, max } = limits[axis]
      expect(min).toBeLessThanOrEqual(dims[axis])
      expect(max).toBeGreaterThanOrEqual(dims[axis])
      for (const value of [min, max]) expect(checkBuilt({ ...plan, dimensions: { ...dims, [axis]: value } }, testCatalog).problems).toEqual([])
    }
  })
})

describe('the summary of a plan', () => {
  it.each(testReferences.all().map((r) => [r.code, r] as const))('%s has the numbers of the purchase estimate', (_, reference) => {
    const { design } = buildPlan(reference.plan, testCatalog)
    const analysis = analyze(design, testCatalog)
    if (!analysis.valid) throw new Error('reference is not valid')
    const purchase = estimatePurchase(design, analysis.geo, testCatalog)
    const summary = summarizePlan(reference.plan, testCatalog)
    expect(summary).toEqual({
      ok: true,
      sheets: purchase.sheets.map((s) => ({ material: s.material.id, name: s.material.name, thickness: s.material.thickness, sheets: s.sheets })),
      totalSheets: purchase.sheets.reduce((n, s) => n + s.sheets, 0),
      cost: purchase.cost.total,
      missingPrices: purchase.cost.missingPrices,
    })
  })

  it('changes when a count changes, and says why when the plan is not valid', () => {
    const [, plan] = cabinets[0]
    const more = setCount(plan, 'drawer', quickCounts(plan).drawer + 1, testCatalog)
    const before = summarizePlan(plan, testCatalog)
    const after = summarizePlan(more.plan, testCatalog)
    expect(before.ok && after.ok && after.cost !== before.cost).toBe(true)
    const broken = { ...plan, dimensions: { ...plan.dimensions, width: 10 } }
    expect(summarizePlan(broken, testCatalog).ok).toBe(false)
  })
})

describe('spaceOverflow', () => {
  const piece = { width: 900, height: 1800, depth: 350 }

  it('names each axis that passes the space', () => {
    expect(spaceOverflow(piece, { width: 800, height: 2000, depth: 300 })).toEqual([
      { axis: 'width', size: 900, room: 800 },
      { axis: 'depth', size: 350, room: 300 },
    ])
  })

  it('counts a measure equal to the space as fitting', () => {
    expect(spaceOverflow(piece, { width: 900, height: 1800 })).toEqual([])
  })

  it('never flags a side the person left empty', () => {
    expect(spaceOverflow(piece, { height: 2000 })).toEqual([])
    expect(spaceOverflow(piece, {})).toEqual([])
  })
})
