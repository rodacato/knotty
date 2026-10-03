import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createBench } from '../../application/bench/bench'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { callLines, caseSteps } from './caseDetail'

const bench = createBench({ llm: () => createSimulated(0), catalog: testCatalog })

describe('a case result read as steps', () => {
  it('tells what was asked, what the expert did and what the grader checked', async () => {
    const c = bench.cases.find((x) => x.id === 'bookcase-adjust-wider')!
    const r = await bench.runCase(c, new AbortController().signal)
    const steps = caseSteps(r)
    expect(steps.length).toBe(1 + c.adjust!.length)
    expect(steps[0].request).toBeNull()
    expect(steps.slice(1).map((s) => s.request)).toEqual(c.adjust)
    for (const s of steps) {
      expect(s.outcome).toMatch(/\S/)
      expect(s.design).toMatch(/mm|inválido/)
    }
    expect(steps.some((s) => s.checks.length > 0)).toBe(true)
    expect(steps.flatMap((s) => s.checks).every((k) => ['pass', 'fail', 'unknown'].includes(k.status) && k.text.length > 0)).toBe(true)
  })

  it('lists every call of the case with what it was for', async () => {
    const r = await bench.runCase(bench.cases.find((x) => x.id === 'bookcase')!, new AbortController().signal)
    const lines = callLines(r)
    expect(lines).toHaveLength(r.callLog.length)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines[0]).toMatch(/ s/)
  })

  it('has no steps for a result saved before the grader had them', () => {
    expect(caseSteps({ steps: undefined } as never)).toEqual([])
  })
})
