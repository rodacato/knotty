import { describe, expect, it } from 'vitest'
import { analyze, type Analysis } from '../analysis'
import { validateGeometry } from '../validation/geometry'
import type { Design } from '../design/schema'
import { exampleWallCabinet } from '../fixtures/wallCabinet'
import { exampleNightstand } from '../fixtures/nightstand'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import type { Catalog } from '../materials/catalog'
import { estimatePurchase } from '../materials/purchase'
import { worst, reviewViability } from './viability'

function review(design: Design, c: Catalog = testCatalog) {
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return reviewViability({ design: design, analysis: a, catalog: c, purchase: estimatePurchase(design, a.geo, c), unmet: [] })
}
/** The review of a design analyze() finds invalid, with the geometry it still resolves. */
function reviewInvalid(design: Design, analysis: Analysis = analyze(design, testCatalog)) {
  if (analysis.valid || !analysis.geo) throw new Error('expected an invalid design that resolves')
  const geo = analysis.geo
  return { analysis, viability: reviewViability({ design: design, analysis: { ...analysis, geo }, catalog: testCatalog, purchase: estimatePurchase(design, geo, testCatalog), unmet: [] }) }
}
/** The bookcase's pieces under other stated measures: what analyze() finds when the pieces do not follow them. */
function statedAs(dimensions: Partial<Design['dimensions']>) {
  const a = analyze(exampleBookcase, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  const design = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, ...dimensions } }
  return reviewInvalid(design, { valid: false, errors: validateGeometry(design, a.geo, testCatalog).errors, geo: a.geo })
}
const checkOf = (v: ReturnType<typeof review>, id: string) => v.checks.find((c) => c.id === id)!

describe('reviewViability', () => {
  it.each([exampleBookcase, exampleNightstand, exampleWallCabinet])('the examples add up and fit the sheet: $name', (design) => {
    const v = review(design)
    expect(checkOf(v, 'measures').status).toBe('ok')
    expect(checkOf(v, 'sheet').status).toBe('ok')
    expect(v.verdict).not.toBe('not-viable')
  })

  it('with more trim, a long piece stops fitting and the design is not viable', async () => {
    const tall = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, height: 2400 } }
    const roomy = review(tall)
    expect(checkOf(roomy, 'sheet').status).toBe('ok')
    const v = review(tall, { ...testCatalog, layout: { ...testCatalog.layout, trim: 50 } })
    expect(checkOf(v, 'sheet')).toMatchObject({ status: 'fail', impossible: true })
    expect(checkOf(v, 'sheet').detail).toContain('2340')
    expect(v.verdict).toBe('not-viable')
  })

  it('when the pieces do not add up to the furniture measures, it is not viable', () => {
    const { viability: v } = statedAs({ width: 650 })
    expect(checkOf(v, 'measures')).toMatchObject({ status: 'fail', impossible: true, request: 'Haz que las piezas cierren exacto en 1800 × 650 × 300 mm' })
    expect(checkOf(v, 'measures').detail).toContain('no coincide el ancho.')
    expect(v.verdict).toBe('not-viable')
  })

  it('the measures close with the tolerance of analyze(): 1.5 mm off is off (the review used to allow 2)', () => {
    const { analysis, viability } = statedAs({ width: exampleBookcase.dimensions.width + 1.5 })
    expect(analysis.errors.map((e) => e.code)).toEqual(['E_OVERALL_SIZE'])
    expect(checkOf(viability, 'measures')).toMatchObject({ status: 'fail', impossible: true })
  })

  it('an analysis error shows once: a piece too big for the sheet is the sheet check, not a structure problem too', () => {
    const { analysis, viability } = reviewInvalid({ ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, height: 2600 } })
    const tooBig = analysis.errors.filter((e) => e.code === 'E_TOO_BIG_FOR_SHEET').map((e) => e.data?.piece)
    expect(tooBig.length).toBeGreaterThan(0)
    expect(analysis.errors.every((e) => e.code === 'E_TOO_BIG_FOR_SHEET')).toBe(true)
    expect(checkOf(viability, 'sheet')).toMatchObject({ status: 'fail', impossible: true, pieces: tooBig })
    expect(checkOf(viability, 'structure')).toMatchObject({ status: 'warning', title: 'Estructura sin revisar' })
    expect(viability.checks.filter((c) => c.status !== 'ok').map((c) => c.id)).toEqual(['sheet', 'structure'])
    expect(viability.verdict).toBe('not-viable')
  })

  it('any other analysis error is a structure problem, told once', () => {
    const floating = { ...exampleBookcase, pieces: [...exampleBookcase.pieces, { ...exampleBookcase.pieces.find((p) => p.role === 'shelf')!, id: 'loose', name: 'Repisa suelta' }] }
    const { analysis, viability } = reviewInvalid(floating)
    const messages = analysis.errors.map((e) => e.message)
    expect(messages.length).toBeGreaterThan(0)
    const structure = checkOf(viability, 'structure')
    expect(structure).toMatchObject({ status: 'fail', impossible: true })
    for (const m of messages.slice(0, 3)) expect(structure.detail.split(m).length).toBe(2)
    expect(viability.checks.filter((c) => c.id !== 'structure').every((c) => !messages.some((m) => c.detail.includes(m)))).toBe(true)
  })

  it('the carpenter can harden the verdict but not soften it', () => {
    expect(worst('viable', 'needs-changes')).toBe('needs-changes')
    expect(worst('not-viable', 'viable')).toBe('not-viable')
  })
})
