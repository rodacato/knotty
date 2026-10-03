import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createBench, type ModuleCheck } from '../../application/bench/bench'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { MODULES } from '../../domain/furniture/modules/plan'
import { groupVariants } from './variants'

const bench = createBench({ llm: () => createSimulated(0), catalog: testCatalog })

describe('the workshop variant list', () => {
  it('lists every variant of every module, each with a verdict', () => {
    const groups = groupVariants(bench)
    const expected = Object.values(MODULES).reduce((n, m) => n + m.benchVariants().length, 0)
    expect(expected).toBeGreaterThan(60)
    expect(groups.flatMap((g) => g.variants)).toHaveLength(expected)
    expect(groups.map((g) => g.module).sort()).toEqual(Object.keys(MODULES).sort())
    for (const g of groups) for (const v of g.variants) expect(v.plan.kind).toBe(g.module)
  })

  it('keeps an invalid variant in the list and marks it, and never calls a variant with warnings clean', () => {
    const [first, second, third] = bench.variants()
    const check = (v: typeof first, over: Partial<ModuleCheck>): ModuleCheck => ({ module: v.module, variant: v.variant, valid: true, findings: [], warnings: [], ...over })
    const stub = {
      variants: () => [first, second, third],
      runModules: () => [check(first, { valid: false, findings: ['E_OVERLAP'] }), check(second, { warnings: ['se tocan pero no tienen unión'] }), check(third, {})],
    }
    const rows = groupVariants(stub).flatMap((g) => g.variants)
    expect(rows.map((r) => r.verdict)).toEqual(['invalid', 'note', 'ok'])
    expect(rows[1].notes).toEqual(['se tocan pero no tienen unión'])
  })
})
