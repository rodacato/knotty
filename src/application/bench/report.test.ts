import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { createBench } from './bench'
import { againstBaseline, caseLine, problemsOf, reportMarkdown, toBaseline, type ReportRow } from './report'

const bench = createBench({ llm: () => createSimulated(0), catalog: testCatalog })
const run = async (id: string, change: Partial<(typeof bench.cases)[number]> = {}): Promise<ReportRow> => {
  const { state: _state, ...r } = await bench.runCase({ ...bench.cases.find((c) => c.id === id)!, ...change }, new AbortController().signal)
  return { ...r, model: 'simulated', prompt: 'simulated@1' }
}
const meta = { label: 'prueba', commit: 'abc1234', date: '2026-09-26T19:31:00.000Z', checkout: null }

describe('the problems of a case, for its ✓ or ×', () => {
  it('a case that came out as expected has none', async () => {
    const bookcase = await run('bookcase')
    expect(problemsOf(bookcase)).toEqual([])
    expect(caseLine(bookcase)).toBe('piezas · 0 s · 2 intentos · puertas 0 · cajones 0 · viable')
  })

  it('names what differs: the structure, and a failure with its message', async () => {
    expect(problemsOf(await run('bookcase', { parts: { doors: 2 } }))).toEqual(['diseño inicial: puertas 0 (pidió 2)'])
    const failed = await run('plant-stand')
    expect(problemsOf(failed)).toEqual([expect.stringMatching(/^falló: /)])
    expect(caseLine(failed)).toMatch(/^falló en \d+ s$/)
  })
})

describe('a row saved before the grader had steps', () => {
  it('still loads and is judged by its own fields, now including its verdict and its failed requests', async () => {
    const { steps: _steps, reconstruction: _reconstruction, graderVersion: _version, ...legacy } = await run('bookcase')
    expect(problemsOf(legacy)).toEqual([])
    expect(problemsOf({ ...legacy, verdict: 'invalid' })).toEqual(['veredicto invalid'])
    expect(problemsOf({ ...legacy, verdict: 'needs-changes', criticals: 1, rules: ['R5_RACKING'] })).toEqual(['veredicto needs-changes', '1 crítico (R5_RACKING)'])
    expect(problemsOf({ ...legacy, reasonable: null })).toEqual(['sin evaluar las medidas'])
    expect(problemsOf({ ...legacy, adjustments: [{ request: 'Hazla más bonita', by: 'expert', calls: 1, outcome: 'error' }] })).toEqual(['pedidos con error: «Hazla más bonita»'])
    expect(caseLine(legacy)).toBe('piezas · 0 s · 2 intentos · puertas 0 · cajones 0 · viable')
  })
})

describe('the problems of a graded row', () => {
  it('count an invalid final design and a null structure that the steps cannot answer', async () => {
    const row = await run('bookcase')
    const last = row.steps!.at(-1)!
    const invalid = { ...row, verdict: 'invalid', steps: [...row.steps!.slice(0, -1), { ...last, design: { ...last.design, valid: false, verdict: 'invalid', problems: ['E_X'] } }] }
    expect(problemsOf(invalid)).toEqual(['«¿Cuánto cuesta?»: diseño inválido (E_X)'])
  })
})

describe('against a baseline', () => {
  it('each case against the same model and case, the baseline first, one figure when it did not change', async () => {
    const before = [await run('bookcase', { parts: { doors: 2 } })]
    const now = [await run('bookcase'), await run('bookcase'), await run('bed')]
    const lines = againstBaseline(now, toBaseline(before, meta))
    expect(lines[2]).toContain('«prueba», commit abc1234, 2026-09-26 19:31 UTC')
    expect(lines).toContainEqual(expect.stringMatching(/^\| simulated \| bookcase \| 1 → 2 \| 1\/1 → 2\/2 \| 1\/1 → 2\/2 \| 0\/1 → 2\/2 \| 0 \| — \| — \|$/))
    expect(lines).toContainEqual(expect.stringMatching(/^\| simulated \| bed \| sin base \|/))
  })
})

describe('the report', () => {
  it('says when it was written halfway, what is off about the checkout, and carries the baseline section only with a baseline', async () => {
    const rows = [await run('bookcase')]
    const halfway = reportMarkdown(rows, { ...meta, checkout: '2 commits detrás de origin/main' }, null, 3)
    expect(halfway).toContain('⚠ 2 commits detrás de origin/main')
    expect(halfway).toContain('En curso: 1 de 3 casos.')
    expect(halfway).not.toContain('## Contra la base')
    const done = reportMarkdown(rows, meta, toBaseline(rows, meta))
    expect(done).not.toContain('En curso')
    expect(done).toContain('## Contra la base (tabla informativa)')
    expect(reportMarkdown(rows, meta, null, 1, ['## Contra la base', 'verificada'])).toContain('## Contra la base\nverificada')
    expect(done).toContain('| Modelo | Llamada | Prompt | Llamadas | Entrada (mín.) |')
  })
})
