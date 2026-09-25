import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import type { Design } from '../diseno/schema'
import { exampleWallCabinet } from '../fixtures/wallCabinet'
import { exampleNightstand } from '../fixtures/nightstand'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import type { Catalog } from '../materiales/catalog'
import { estimatePurchase } from '../materiales/purchase'
import { worst, reviewViability } from './viability'

function revisar(diseno: Design, c: Catalog = testCatalog) {
  const a = analyze(diseno, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return reviewViability({ design: diseno, geo: a.geo, catalog: c, purchase: estimatePurchase(diseno, a.geo, c), findings: a.findings, unmet: [] })
}
const estado = (v: ReturnType<typeof revisar>, id: string) => v.checks.find((c) => c.id === id)!

describe('reviewViability', () => {
  it.each([exampleBookcase, exampleNightstand, exampleWallCabinet])('the examples add up and fit the sheet: $nombre', (diseno) => {
    const v = revisar(diseno)
    expect(estado(v, 'measures').status).toBe('ok')
    expect(estado(v, 'sheet').status).toBe('ok')
    expect(v.verdict).not.toBe('not-viable')
  })

  it('with more trim, a long piece stops fitting and the design is not viable', async () => {
    const alto = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, height: 2400 } }
    const holgado = revisar(alto)
    expect(estado(holgado, 'sheet').status).toBe('ok')
    const v = revisar(alto, { ...testCatalog, acomodo: { ...testCatalog.acomodo, refilado: 50 } })
    expect(estado(v, 'sheet')).toMatchObject({ status: 'fail', impossible: true })
    expect(estado(v, 'sheet').detail).toContain('2340')
    expect(v.verdict).toBe('not-viable')
  })

  it('when the pieces do not add up to the furniture measures, it is not viable', () => {
    const a = analyze(exampleBookcase, testCatalog)
    if (!a.valid) throw new Error()
    const dice = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 650 } }
    const v = reviewViability({ design: dice, geo: a.geo, catalog: testCatalog, purchase: estimatePurchase(exampleBookcase, a.geo, testCatalog), findings: [], unmet: [] })
    expect(estado(v, 'measures')).toMatchObject({ status: 'fail', impossible: true, request: 'Haz que las piezas cierren exacto en 1800 × 650 × 300 mm' })
    expect(v.verdict).toBe('not-viable')
  })

  it('the carpenter can harden the verdict but not soften it', () => {
    expect(worst('viable', 'needs-changes')).toBe('needs-changes')
    expect(worst('not-viable', 'viable')).toBe('not-viable')
  })
})
