import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { createBench } from './bench'
import { againstBaseline, caseLine, problemsOf, reportMarkdown, terminalSummary, toBaseline, type ReportRow } from './report'

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
    expect(problemsOf(await run('bookcase', { parts: { doors: 2 } }))).toEqual(['estructura: puertas 0 (pidió 2)'])
    const failed = await run('plant-stand')
    expect(problemsOf(failed)).toEqual([expect.stringMatching(/^falló: /)])
    expect(caseLine(failed)).toMatch(/^falló en \d+ s$/)
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
    expect(done).toContain('## Contra la base')
    expect(done).toContain('| Modelo | Llamada | Prompt | Llamadas | Entrada (mín.) |')
  })
})

describe('the summary the terminal shows at the end', () => {
  it('the table by model, and the baseline section, or how to set one', async () => {
    const rows = [await run('bookcase')]
    const withBase = terminalSummary(rows, toBaseline(rows, meta))
    expect(withBase).toContain('| simulated | 1/1 |')
    expect(withBase).toContain('## Contra la base')
    expect(terminalSummary(rows, null)).toContain('Sin base: KNOTTY_SAVE_BASELINE=1 fija esta corrida.')
  })
})
