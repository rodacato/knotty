import { describe, expect, it } from 'vitest'
import { standingAgainst, type Candidate } from './against'
import { classifyTrial, type GradedResult, type TrialRecord } from './classify'
import { expectation, manifestOf, resultOf, stepOf } from './fixtures.test-util'
import { KNOWN_FAILURES } from './knownFailures'
import { baselineOf } from './promote'
import { toBaseline, type ReportRow } from './report'

const good = (caseId: string) => resultOf({ caseId, steps: [stepOf('s', [expectation('0:verdict', 'pass')])] })
const bad = (caseId: string) => resultOf({ caseId, verdict: 'needs-changes', steps: [stepOf('s', [expectation('0:verdict', 'fail', 'veredicto needs-changes')])] })
const row = (r: GradedResult): ReportRow => ({ ...r, model: 'shellm:claude', prompt: null })
const trial = (r: GradedResult, n = 0, classification?: TrialRecord['classification']): TrialRecord => ({ caseId: r.caseId, trial: n, result: r, classification: classification ?? classifyTrial(r, { known: KNOWN_FAILURES }) })
const many = (r: GradedResult, n: number) => Array.from({ length: n }, () => r)
const meta = { label: 'base', commit: 'abc1234', date: '2026-09-26T19:31:00.000Z', checkout: null }
const candidate = (trials: TrialRecord[], over = {}): Candidate => {
  const { jobs: _jobs, ...identity } = manifestOf(over)
  return { manifest: identity, trials }
}
const promoted = (results: GradedResult[], over = {}) => baselineOf(manifestOf(over), results.map(row))
const stand = (baseline: Parameters<typeof standingAgainst>[0], c: Candidate, benchCases?: string[]) => standingAgainst(baseline, c, { known: KNOWN_FAILURES, benchCases })

describe('against a baseline with an identity', () => {
  it('is verified, and an unchanged run reads as equal with no regression', () => {
    const s = stand(promoted([good('bed'), good('desk')]), candidate([trial(good('bed')), trial(good('desk'))]))
    expect(s).toMatchObject({ kind: 'verified', regression: false })
    expect(s.lines.join('\n')).toMatch(/Comparación verificada/)
    expect(s.lines).toContain('| bed | igual | — |')
  })

  it('compares a run whose prompts changed and prints what varies', () => {
    const changed = { hashes: { ...manifestOf().hashes, prompts: { skeleton: 'NEW' } } }
    const s = stand(promoted([good('bed')]), candidate([trial(good('bed'))], changed))
    expect(s).toMatchObject({ kind: 'verified', regression: false })
    expect(s.lines.join('\n')).toMatch(/Lo que varía[^\n]*prompts differ/)
  })

  it('names the requirement that got worse and flags the regression', () => {
    const s = stand(promoted(many(good('bed'), 6)), candidate(many(bad('bed'), 6).map((r, n) => trial(r, n))))
    expect(s.regression).toBe(true)
    expect(s.lines.join('\n')).toMatch(/Regresiones: bed caso completo, bed 0:verdict/)
    expect(s.lines.join('\n')).toMatch(/\| bed \| REGRESIÓN \| .*0:verdict: REGRESIÓN \(6\/6 → 0\/6\)/)
  })

  it('does not call a regression what a sample of three cannot tell from variation, and says so', () => {
    const s = stand(promoted(many(good('bed'), 3)), candidate(many(bad('bed'), 3).map((r, n) => trial(r, n))))
    expect(s.regression).toBe(false)
    expect(s.lines.join('\n')).toMatch(/Sin poder distinguirlos de la variación: bed[^\n]*menos de 4 repeticiones/)
  })

  it('reads the noise from the cases whose prompts did not change, and keeps them apart from the affected ones', () => {
    const calls = (promptId: string) => [{ step: 'skeleton' as const, promptId, seconds: 1, input: 1, output: 1 }]
    const withPrompt = (r: GradedResult, promptId: string): GradedResult => ({ ...r, callLog: calls(promptId) })
    const base = promoted([withPrompt(good('bed'), 'p1'), withPrompt(good('desk'), 'p1')])
    const s = stand(base, candidate([trial(withPrompt(good('bed'), 'p1')), trial(withPrompt(good('desk'), 'p2'))]))
    expect(s.comparison?.compatible && s.comparison.cases.map((c) => [c.caseId, c.exposure])).toEqual([['bed', 'control'], ['desk', 'affected']])
    expect(s.lines.join('\n')).toMatch(/Ruido medido con 1 casos de control[^\n]*0 cambiaron/)
  })

  it('lists an infrastructure failure apart and keeps it out of the rates', () => {
    const down = resultOf({ caseId: 'bed', ok: false, error: 'Límite de peticiones alcanzado; espera un momento.' })
    const s = stand(promoted([good('bed')]), candidate([trial(good('bed'), 0), trial(down, 1)]))
    expect(s.regression).toBe(false)
    expect(s.lines.join('\n')).toMatch(/Infraestructura \(fuera de las tasas\): esta corrida bed t1/)
  })

  it('shows a known failure as still failing and does not call it a regression', () => {
    const stand5 = resultOf({ caseId: 'plant-stand', verdict: 'needs-changes', criticals: 1, rules: ['R5_RACKING'], steps: [stepOf('s', [expectation('0:verdict', 'fail', 'veredicto needs-changes (esperado viable)')], { design: { ...stepOf('x', []).design, verdict: 'needs-changes', criticals: 1, rules: ['R5_RACKING'] } })] })
    const s = stand(promoted([stand5], { hashes: { ...manifestOf().hashes, cases: { 'plant-stand': 'h' } } }), candidate([trial(stand5)], { hashes: { ...manifestOf().hashes, cases: { 'plant-stand': 'h' } } }))
    expect(s.regression).toBe(false)
    expect(s.lines.join('\n')).toMatch(/falla conocida \(sigue fallando\)/)
  })

  it('does not call a case the run left out «retirado» while the bench still has it', () => {
    const base = promoted([good('bed'), good('desk')])
    const only = candidate([trial(good('bed'))], { hashes: { ...manifestOf().hashes, cases: { bed: 'h-bed' } } })
    expect(stand(base, only, ['bed', 'desk']).lines).toContain('| desk | no corrido en esta corrida | — |')
    expect(stand(base, only).lines).toContain('| desk | retirado | — |')
  })

  it('does not compare when the versions differ, and says why', () => {
    const s = stand(promoted([good('bed')]), candidate([trial(good('bed'))], { hashes: { ...manifestOf().hashes, graderVersion: '3' } }))
    expect(s).toMatchObject({ kind: 'incompatible', comparison: null, regression: false })
    expect(s.reasons.join(' ')).toMatch(/grader version 2 vs 3/)
    expect(s.lines.join('\n')).toMatch(/No se compara/)
  })
})

describe('against a legacy baseline with no identity', () => {
  it('compares by case and says it is unverified', () => {
    const s = stand(toBaseline(many(good('bed'), 6).map(row), meta), candidate(many(bad('bed'), 6).map((r, n) => trial(r, n))))
    expect(s.kind).toBe('unverified')
    expect(s.regression).toBe(true)
    expect(s.lines.join('\n')).toMatch(/SIN VERIFICAR/)
  })

  it('compares only the case as a whole: the steps of today are not news against a base that never had them', () => {
    const { steps: _steps, ...legacy } = good('bed')
    const s = stand(toBaseline([row(legacy)], meta), candidate([trial(good('bed'))]))
    expect(s.lines).toContain('| bed | igual | — |')
    expect(s.lines.join('\n')).not.toMatch(/nuevo/)
  })

  it('never reads an unchanged case as a regression', () => {
    expect(stand(toBaseline([row(good('bed'))], meta), candidate([trial(good('bed'))]))).toMatchObject({ kind: 'unverified', regression: false })
  })
})
