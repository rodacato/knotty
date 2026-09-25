import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
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
  return reviewViability({ design: design, geo: a.geo, catalog: c, purchase: estimatePurchase(design, a.geo, c), findings: a.findings, unmet: [] })
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
    const a = analyze(exampleBookcase, testCatalog)
    if (!a.valid) throw new Error()
    const stated = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 650 } }
    const v = reviewViability({ design: stated, geo: a.geo, catalog: testCatalog, purchase: estimatePurchase(exampleBookcase, a.geo, testCatalog), findings: [], unmet: [] })
    expect(checkOf(v, 'measures')).toMatchObject({ status: 'fail', impossible: true, request: 'Haz que las piezas cierren exacto en 1800 × 650 × 300 mm' })
    expect(v.verdict).toBe('not-viable')
  })

  it('the carpenter can harden the verdict but not soften it', () => {
    expect(worst('viable', 'needs-changes')).toBe('needs-changes')
    expect(worst('not-viable', 'viable')).toBe('not-viable')
  })
})
