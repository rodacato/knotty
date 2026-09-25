import { describe, expect, it } from 'vitest'
import data from '../../../public/catalog/catalog.json'
import saved from '../session/state-v1.fixture.json'
import { migrateState } from '../session/migrate'
import { DesignState } from '../session/state'
import { testCatalog } from '../fixtures/catalog.test-util'
import { ASSUMPTIONS } from '../structure/assumptions'
import { applySettings, backBoard, BOARD_USES, boardsFor, Catalog, materialById, thinnestBoard } from './catalog'
import { boardLook, GRADE_IDS, GRADES, stiffness } from './grades'

describe('board use and grade', () => {
  it('every catalog board has a known use and a grade in the table', () => {
    for (const m of testCatalog.materials) {
      expect(BOARD_USES).toContain(m.use)
      expect(GRADES[m.grade]).toBeDefined()
    }
  })

  it('every grade has what the rules and the 3D ask of it, with its source', () => {
    for (const id of GRADE_IDS) {
      const g = GRADES[id]
      expect(g.name).not.toBe('')
      expect(g.source).toMatch(/^docs\/carpinteria\//)
      expect(g.stiffness.source).toMatch(/^docs\/carpinteria\//)
      // The last row takes every thickness: no board is left without a value.
      expect(g.stiffness.rows.at(-1)?.upTo).toBe(Infinity)
      expect(g.look.at(-1)?.upTo).toBe(Infinity)
      for (const r of g.stiffness.rows) expect(r.parallel).toBeGreaterThanOrEqual(r.perpendicular)
      for (const r of g.stiffness.rows) expect(r.perpendicular).toBeGreaterThan(0)
      // Plywood always has an odd number of plies.
      for (const r of g.look) expect(r.plies % 2).toBe(1)
    }
  })

  it('pine plywood keeps the stiffness the checks have used so far, in every thickness', () => {
    for (const m of testCatalog.materials) expect(stiffness(m.grade, m.thickness)).toEqual({ parallel: 6000, perpendicular: 3500 })
  })

  it('draws each shipped board as before: carcass boards with 7 plies, backs paler with 3', () => {
    for (const m of testCatalog.materials) expect(boardLook(m.grade, m.thickness)).toEqual(m.use === 'back' ? { tone: 'pale-pine', plies: 3 } : { tone: 'pine', plies: 7 })
  })
})

describe('boards by use', () => {
  it('the back is TR6 in the shipped catalog, and so is the drawer bottom a thin one grows to', () => {
    expect(backBoard(testCatalog).id).toBe('TR6')
    expect(thinnestBoard(testCatalog, 'back', ASSUMPTIONS.drawers.minBottom)?.id).toBe('TR6')
  })

  it('the carcass boards are the ones the plan sheets and the expert choose from, in catalog order', () => {
    expect(boardsFor(testCatalog, 'carcass').map((m) => m.id)).toEqual(['T12', 'T15', 'T18'])
    expect(boardsFor(testCatalog, 'back').map((m) => m.id)).toEqual(['TR3', 'TR6'])
    expect(thinnestBoard(testCatalog, 'carcass', 13)?.id).toBe('T15')
    expect(thinnestBoard(testCatalog, 'carcass', 19)).toBeUndefined()
  })

  it('a catalog without a board for each use does not load', () => {
    expect(Catalog.safeParse({ ...data, materials: data.materials.filter((m) => m.use !== 'back') }).success).toBe(false)
    expect(Catalog.safeParse({ ...data, materials: data.materials.filter((m) => m.use !== 'carcass') }).success).toBe(false)
  })

  it('a board of an unknown grade does not load', () => {
    expect(Catalog.safeParse({ ...data, materials: data.materials.map((m) => ({ ...m, grade: 'baltic-birch' })) }).success).toBe(false)
  })
})

describe('what was saved before the split', () => {
  it('a catalog with the old `type` (a cached catalog.json) loads the same', () => {
    const legacy = {
      ...data,
      materials: data.materials.map((board) => {
        const { use, grade: _, ...m } = board
        return { ...m, type: use === 'carcass' ? 'plywood' : 'back' }
      }),
    }
    expect(Catalog.parse(legacy)).toEqual(testCatalog)
  })

  it('prices saved by id still apply to boards and backs', () => {
    const c = applySettings(testCatalog, { prices: { T18: 990, TR6: 400 }, layout: null })
    expect(materialById(c, 'T18')).toMatchObject({ use: 'carcass', grade: 'pine-plywood', price: 990 })
    expect(materialById(c, 'TR6')).toMatchObject({ use: 'back', grade: 'pine-plywood', price: 400 })
  })

  it('every board a saved session names is still in the catalog', () => {
    const state = DesignState.parse(migrateState(saved))
    const used = new Set(state.versions.flatMap((v) => v.design.pieces.map((p) => p.material)))
    expect([...used].filter((id) => !materialById(testCatalog, id))).toEqual([])
    expect(used).toContain('TR6')
  })
})
