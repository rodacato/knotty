import { describe, expect, it } from 'vitest'
import { concurrencyTable, parseLevels, statsOf, type JobDetail, type LevelInput } from './concurrency'
import { manifestOf } from './fixtures.test-util'
import type { JobRecord } from './manifest'

const at = (s: number) => new Date(Date.UTC(2026, 9, 2, 12, 0, s)).toISOString()
const job = (caseId: string, start: number, end: number, over: Partial<JobRecord> = {}): JobRecord => ({ jobId: `j-${caseId}`, caseId, trial: 0, status: 'done', outcome: 'pass', startedAt: at(start), endedAt: at(end), queuedMs: 0, ...over })
const detail = (over: Partial<JobDetail> = {}): JobDetail => ({ row: { error: null, corrections: [], inputTokens: 100, outputTokens: 10 }, stepErrors: [], requests: [], ...over })
const level = (n: number, jobs: JobRecord[], details: Record<string, JobDetail> = {}): LevelInput => ({ level: n, manifest: { ...manifestOf(), jobs }, details })

describe('parseLevels', () => {
  it('takes levels up to 4 as they come', () => {
    expect(parseLevels('2,4', false)).toEqual({ ok: true, levels: [2, 4] })
  })

  it('refuses 5 and 6 without the acknowledgement, and accepts them with it', () => {
    expect(parseLevels('2,6', false)).toMatchObject({ ok: false, error: expect.stringMatching(/--allow-6/) })
    expect(parseLevels('2,4,6', true)).toEqual({ ok: true, levels: [2, 4, 6] })
  })

  it('refuses above 6 even with the acknowledgement, and anything that is not a list of levels', () => {
    expect(parseLevels('8', true).ok).toBe(false)
    for (const bad of ['', 'a', '0', '2,2', '1.5', '-1']) expect(parseLevels(bad, true).ok).toBe(false)
  })
})

describe('statsOf', () => {
  it('measures wall time and the scenario durations from the manifest timestamps', () => {
    const s = statsOf(level(2, [job('a', 0, 10), job('b', 0, 30), job('c', 10, 20, { status: 'cancelled', outcome: undefined })]))
    expect(s).toMatchObject({ wallMs: 30_000, meanMs: 20_000, medianMs: 20_000, p95Ms: 30_000, done: 2, jobs: 3 })
  })

  it('counts the kind of each infrastructure error, including a 429 the job survived', () => {
    const jobs = [job('a', 0, 5, { outcome: 'infrastructure' }), job('b', 0, 5, { outcome: 'infrastructure' }), job('c', 0, 5), job('d', 0, 5, { outcome: 'infrastructure' })]
    const s = statsOf(
      level(4, jobs, {
        'j-a': detail({ row: { error: 'El proveedor tardó demasiado en responder.', corrections: [], inputTokens: 0, outputTokens: 0 } }),
        'j-b': detail({ stepErrors: ['Límite de peticiones alcanzado; espera un momento.'] }),
        'j-c': detail({ requests: [{ status: 429, responseModel: 'claude-x', headersAllowlisted: { 'retry-after': '3' } }] }),
      }),
    )
    expect(s.infrastructure).toEqual({ 'provider timeout': 1, 'rate limit (429)': 1, 'HTTP 429 en una petición': 1, 'sin mensaje del proveedor': 1 })
    expect(s.models).toEqual(['claude-x'])
    expect(s.headers).toEqual(['retry-after'])
  })

  it('sums corrections and tokens and reads the queue wait', () => {
    const jobs = [job('a', 0, 5, { queuedMs: 0 }), job('b', 0, 5, { queuedMs: 4000 })]
    const s = statsOf(level(2, jobs, { 'j-a': detail({ row: { error: null, corrections: ['E_A', 'E_B'], inputTokens: 10, outputTokens: 1 } }), 'j-b': detail() }))
    expect(s).toMatchObject({ corrections: 2, inputTokens: 110, outputTokens: 11, queueMeanMs: 2000, queueMaxMs: 4000 })
  })

  it('has no figures for a level that ran nothing', () => {
    expect(statsOf(level(2, []))).toMatchObject({ wallMs: null, meanMs: null, p95Ms: null, jobs: 0 })
  })
})

describe('concurrencyTable', () => {
  it('puts one column per level, in the order asked', () => {
    const table = concurrencyTable([level(2, [job('a', 0, 20)]), level(4, [job('a', 0, 12)])])
    expect(table[0]).toBe('| | 2 a la vez | 4 a la vez |')
    expect(table).toContain('| Tiempo total | 20 s | 12 s |')
    expect(table).toContain('| Errores de infraestructura | 0 | 0 |')
    expect(table).toContain('| Cabeceras vistas | ninguna | ninguna |')
  })
})
