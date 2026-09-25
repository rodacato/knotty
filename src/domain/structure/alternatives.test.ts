import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { exampleBookcase } from '../fixtures/bookcase'
import { testCatalog } from '../fixtures/catalog.test-util'
import { ALTERNATIVES } from './alternatives'

describe('alternatives', () => {
  // The compiler checks the rest: a rule can only offer a declared key (`Alternative.key` is `AlternativeKey`),
  // and `operationsFor` switches over every build key and nothing else (it ends in `never`).

  it('the longest span of a sagging board is data of the finding, not a way out', () => {
    const wide = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 1100 } }
    const analysis = analyze(wide, testCatalog)
    if (!analysis.valid) throw new Error(analysis.errors[0].message)
    const sag = analysis.findings.find((h) => h.code === 'R1_SAG')!
    expect(sag.data.maxSpan).toBeGreaterThan(0)
    expect(sag.data.maxSpan).toBeLessThan(sag.data.span as number)
    expect(sag.alternatives.every((a) => a.key in ALTERNATIVES)).toBe(true)
  })
})
