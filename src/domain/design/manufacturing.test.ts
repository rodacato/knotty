import { describe, expect, it } from 'vitest'
import { ASSUMPTIONS } from '../assumptions'
import { analyze } from '../checks/analysis'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import { cabinetModule, buildCabinet } from '../furniture/modules/cabinet'
import { manufacturingProblems, slidingFits } from './manufacturing'

const plan = cabinetModule.benchVariants().find(([name]) => name === 'aparador con dos corredizas')![1]
const resolved = (design: ReturnType<typeof buildCabinet>['design']) => {
  const analysis = analyze(design, testCatalog)
  if (!analysis.valid) throw new Error(JSON.stringify(analysis.errors))
  return analysis.geo
}

describe('manufacturing fit, including saved geometry', () => {
  it('both sliding leaves mount with extra lift and a web between their actual grooves', () => {
    const { design } = buildCabinet(plan, testCatalog)
    const fits = slidingFits(design, resolved(design))
    expect(fits).toHaveLength(2)
    for (const fit of fits) {
      expect(fit.margin).toBeGreaterThanOrEqual(ASSUMPTIONS.sliding.liftClearance)
      expect(fit.upper).toBe(9)
      expect(fit.lower).toBe(4.5)
      expect(fit.web).toBe(6)
    }
    expect(manufacturingProblems(design, resolved(design))).toEqual([])
  })

  it('detects an older full-height leaf even though the overall furniture dimensions close', () => {
    const { design } = buildCabinet(plan, testCatalog)
    const geo = resolved(design)
    for (const fit of slidingFits(design, geo)) geo.boxes.get(fit.id)!.y1 += 2
    expect(manufacturingProblems(design, geo).filter((p) => p.detail.includes('montarla'))).toHaveLength(2)
  })

  it.each(['bottom', 'top'])('rejects a thin web and overlapping grooves in %s', (id) => {
    for (const extraWidth of [5, 7]) {
      const { design } = buildCabinet(plan, testCatalog)
      const board = design.pieces.find((p) => p.id === id)!
      board.cuts![0].z.length += extraWidth
      const geo = resolved(design)
      expect(slidingFits(design, geo).map((fit) => fit.web)).toEqual([6 - extraWidth, 6 - extraWidth])
      expect(manufacturingProblems(design, geo).filter((p) => p.detail.includes('ranuras'))).toHaveLength(2)
    }
  })

  it('removable shelves keep play and still have four support pins; fixed shelves meet the sides', () => {
    const bookcase = cabinetModule.benchVariants().find(([name]) => name === 'librero')![1]
    for (const shelves of ['movable', 'fixed'] as const) {
      const { design } = buildCabinet({ ...bookcase, construction: { ...bookcase.construction, shelves } }, testCatalog)
      const geo = resolved(design)
      const shelf = design.pieces.find((p) => p.role === 'shelf')!
      const box = geo.boxes.get(shelf.id)!
      const wall = geo.boxes.get('side-left')!
      expect(box.x0 - wall.x1).toBe(shelves === 'movable' ? 2 : 0)
      expect(design.joints.filter((j) => j.type === 'shelf-pin' && (j.a === shelf.id || j.b === shelf.id))).toHaveLength(shelves === 'movable' ? 2 : 0)
      expect(manufacturingProblems(design, geo)).toEqual([])
    }
  })
})
