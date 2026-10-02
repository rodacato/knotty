import { describe, expect, it } from 'vitest'
import { classifyTrial, compareRuns, infrastructureCause, trialsOfRows, type GradedResult, type RunSet, type TrialRecord } from './classify'
import { expectation, manifestOf, resultOf, stepOf } from './fixtures.test-util'
import { KNOWN_FAILURES } from './knownFailures'
import { problemsOf } from './report'

const known = KNOWN_FAILURES

const plantStand = (over: Partial<GradedResult> = {}) =>
  resultOf({
    caseId: 'plant-stand',
    verdict: 'needs-changes',
    criticals: 1,
    rules: ['R5_RACKING'],
    steps: [stepOf('diseño inicial', [expectation('0:verdict', 'fail', 'veredicto needs-changes (esperado viable)'), expectation('0:dimensions', 'pass')], { design: { ...stepOf('x', []).design, verdict: 'needs-changes', criticals: 1, rules: ['R5_RACKING'] } })],
    ...over,
  })

const bedWith = (measures: string, over: Partial<GradedResult> = {}) =>
  resultOf({
    caseId: 'bed-drawers',
    measures,
    steps: [stepOf('diseño inicial', [expectation('0:dimensions', 'fail', `medidas ${measures} fuera de lo esperado`)], { design: { ...stepOf('x', []).design, measures } })],
    ...over,
  })

describe('classifyTrial', () => {
  it('a clean trial passes', () => {
    expect(classifyTrial(resultOf(), { known })).toBe('pass')
  })

  it('plant-stand with its declared rack failure is a known failure, and it still has problems', () => {
    expect(problemsOf(plantStand()).length).toBeGreaterThan(0)
    expect(classifyTrial(plantStand(), { known })).toBe('known-failure')
  })

  it('plant-stand with a different critical rule is a regression', () => {
    const r = plantStand({ rules: ['R5_RACKING', 'R2_SPAN'], criticals: 2 })
    expect(classifyTrial(r, { known })).toBe('regression')
  })

  it('plant-stand failing something it did not declare is a regression', () => {
    const r = plantStand()
    r.steps![0].expectations.push(expectation('0:parts:doors', 'fail', 'puertas 0 (pidió 2)'))
    expect(classifyTrial(r, { known })).toBe('regression')
  })

  it('a known failure of one case does not excuse the same failure in another', () => {
    expect(classifyTrial(plantStand({ caseId: 'desk' }), { known })).toBe('regression')
  })

  it('without declarations the plant-stand failure is a regression: declaring is what makes it known', () => {
    expect(classifyTrial(plantStand(), { known: [] })).toBe('regression')
  })

  it('bed-drawers longer than the range, within the declared overshoot, in either orientation, is known', () => {
    expect(classifyTrial(bedWith('1100 × 1010 × 2238'), { known })).toBe('known-failure')
    expect(classifyTrial(bedWith('1100 × 2218 × 1010'), { known })).toBe('known-failure')
  })

  it('bed-drawers beyond the declared overshoot, or wrong in another dimension, is a regression', () => {
    expect(classifyTrial(bedWith('1100 × 1010 × 2600'), { known })).toBe('regression')
    expect(classifyTrial(bedWith('1700 × 1010 × 2238'), { known })).toBe('regression')
    expect(classifyTrial(bedWith('1100 × 1300 × 2238'), { known })).toBe('regression')
  })

  it.each([
    ['the SDK timeout', 'El proveedor tardó demasiado en responder.'],
    ['the client 5 minute limit', 'El experto tardó más de 5 minutos en responder. Intenta de nuevo o con un modelo más rápido.'],
    ['a SheLLM cut', 'SheLLM cortó la petición a los 300 s: el modelo tardó más que su límite de tiempo.'],
    ['a 429', 'Límite de peticiones alcanzado; espera un momento.'],
    ['a connection failure', 'No se pudo conectar con SheLLM en http://x. Revisa que esté corriendo'],
    ['a cancellation', 'Cancelado.'],
    ['a 5xx', 'Error 502 del proveedor: bad gateway'],
  ])('%s is infrastructure', (_, error) => {
    expect(classifyTrial(resultOf({ ok: false, error: `${error}` }), { known })).toBe('infrastructure')
    expect(infrastructureCause(error)).not.toBeNull()
  })

  it('a step error told by the caller makes the trial infrastructure', () => {
    const r = resultOf({ steps: [stepOf('«x»', [expectation('1:outcome', 'fail', 'resultado error')], { outcome: 'error' })] })
    expect(classifyTrial(r, { known })).toBe('regression')
    expect(classifyTrial(r, { known, stepErrors: ['Límite de peticiones alcanzado; espera un momento.'] })).toBe('infrastructure')
    expect(classifyTrial(r, { known, error: 'Cancelado.' })).toBe('infrastructure')
  })

  it('errors that are not the provider\'s are regression candidates: an invalid design, a bad key', () => {
    expect(classifyTrial(resultOf({ ok: false, error: 'El diseño no cumple el esquema' }), { known })).toBe('regression')
    expect(classifyTrial(resultOf({ ok: false, error: 'La API key no es válida.' }), { known })).toBe('regression')
    expect(infrastructureCause(null)).toBeNull()
  })

  it('a clean result stays a pass even if an error text is passed', () => {
    expect(classifyTrial(resultOf(), { known, error: 'Cancelado.' })).toBe('pass')
  })
})

const run = (trials: TrialRecord[], manifest = manifestOf()): RunSet => ({ manifest, trials })
const trial = (caseId: string, n: number, steps: ReturnType<typeof stepOf>[] | null, classification: TrialRecord['classification'] = 'pass', over: Partial<GradedResult> = {}): TrialRecord => {
  const result = resultOf({ caseId, steps: steps ?? [], ...over })
  return { caseId, trial: n, result, classification }
}
const good = () => [stepOf('s', [expectation('0:verdict', 'pass')])]
const bad = () => [stepOf('s', [expectation('0:verdict', 'fail', 'veredicto x')])]

function compared(base: RunSet, candidate: RunSet, tolerance?: number) {
  const r = compareRuns(base, candidate, { tolerance })
  if (!r.compatible) throw new Error(r.reasons.join())
  return r
}
const statusOf = (r: ReturnType<typeof compared>, caseId: string, id = '0:verdict') => r.cases.find((c) => c.caseId === caseId)!.requirements.find((q) => q.id === id)?.status

describe('compareRuns', () => {
  it('the same results are the same', () => {
    const r = compared(run([trial('bed', 0, good())]), run([trial('bed', 0, good())]))
    expect(r.cases[0]).toMatchObject({ caseId: 'bed', status: 'same' })
  })

  it('one more failed trial than the base is a regression with the default tolerance of zero', () => {
    const base = run([trial('bed', 0, good()), trial('bed', 1, good())])
    const cand = run([trial('bed', 0, good()), trial('bed', 1, bad(), 'regression', { verdict: 'x' })])
    const r = compared(base, cand)
    expect(statusOf(r, 'bed')).toBe('regression')
    expect(r.cases[0].status).toBe('regression')
    expect(r.cases[0].requirements.find((q) => q.id === '0:verdict')).toMatchObject({ base: { passed: 2, counted: 2 }, candidate: { passed: 1, counted: 2 } })
  })

  it('an explicit tolerance turns that into a variation, and a second extra failure is again a regression', () => {
    const base = run([trial('bed', 0, good()), trial('bed', 1, good()), trial('bed', 2, good())])
    const one = run([trial('bed', 0, good()), trial('bed', 1, good()), trial('bed', 2, bad(), 'regression')])
    const two = run([trial('bed', 0, good()), trial('bed', 1, bad(), 'regression'), trial('bed', 2, bad(), 'regression')])
    expect(statusOf(compared(base, one, 1), 'bed')).toBe('variation')
    expect(statusOf(compared(base, two, 1), 'bed')).toBe('regression')
  })

  it('fewer failures than the base is an improvement', () => {
    const base = run([trial('bed', 0, bad(), 'regression')])
    expect(statusOf(compared(base, run([trial('bed', 0, good())])), 'bed')).toBe('improvement')
  })

  it('a failure that is declared known stays visible as known, not as a regression', () => {
    const base = run([trial('bed', 0, good())])
    const cand = run([trial('bed', 0, bad(), 'known-failure')])
    expect(statusOf(compared(base, cand), 'bed')).toBe('known')
  })

  it('compares by rate when the repeat counts differ', () => {
    const base = run([trial('bed', 0, good()), trial('bed', 1, bad(), 'regression')])
    const same = run([trial('bed', 0, good()), trial('bed', 1, bad(), 'regression'), trial('bed', 2, good()), trial('bed', 3, bad(), 'regression')])
    expect(statusOf(compared(base, same), 'bed')).toBe('same')
  })

  it('infrastructure trials are out of the pass rate and listed apart', () => {
    const base = run([trial('bed', 0, good())])
    const cand = run([trial('bed', 0, good()), trial('bed', 1, null, 'infrastructure', { ok: false, error: 'Cancelado.' })])
    const r = compared(base, cand)
    expect(r.cases[0].status).toBe('same')
    expect(r.cases[0].requirements.find((q) => q.id === 'case')!.candidate).toEqual({ passed: 1, counted: 1 })
    expect(r.infrastructure).toEqual([{ side: 'candidate', caseId: 'bed', trial: 1, error: 'Cancelado.' }])
  })

  it('a case that only had infrastructure errors is unmeasured, never a regression', () => {
    const r = compared(run([trial('bed', 0, good())]), run([trial('bed', 0, null, 'infrastructure', { ok: false, error: 'Cancelado.' })]))
    expect(r.cases[0].status).toBe('unmeasured')
  })

  it('new and retired cases are explicit', () => {
    const base = run([trial('bed', 0, good()), trial('old', 0, good())], manifestOf({}, ['bed', 'old']))
    const cand = run([trial('bed', 0, good()), trial('fresh', 0, good())], manifestOf({}, ['bed', 'fresh']))
    const r = compared(base, cand)
    expect(Object.fromEntries(r.cases.map((c) => [c.caseId, c.status]))).toEqual({ bed: 'same', fresh: 'new', old: 'retired' })
    expect(r.caseDiffs).toEqual({ added: ['fresh'], retired: ['old'], changed: [] })
  })

  it('a case whose definition changed is incompatible on its own while the others compare', () => {
    const base = run([trial('bed', 0, good()), trial('desk', 0, good())])
    const cand = run([trial('bed', 0, good()), trial('desk', 0, good())], manifestOf({ hashes: { ...manifestOf().hashes, cases: { bed: 'h-bed', desk: 'NEW' } } }))
    const r = compared(base, cand)
    expect(Object.fromEntries(r.cases.map((c) => [c.caseId, c.status]))).toEqual({ bed: 'same', desk: 'incompatible' })
  })

  it('refuses to compare a different grader version, with the reason, and a re-graded run keeps its provenance', () => {
    const other = manifestOf({ hashes: { ...manifestOf().hashes, graderVersion: '3' }, regradedFrom: { runId: 'old-run', graderVersion: '2' } })
    expect(other.regradedFrom).toEqual({ runId: 'old-run', graderVersion: '2' })
    const r = compareRuns(run([trial('bed', 0, good())]), run([trial('bed', 0, good())], other))
    expect(r).toEqual({ compatible: false, reasons: [expect.stringMatching(/grader/)] })
  })

  it('an unknown mandatory expectation counts as not passed; an optional unknown is ignored', () => {
    const unknown = [stepOf('s', [expectation('0:a', 'unknown', 'sin dato', true), expectation('0:b', 'unknown', 'declared', false)])]
    const r = compared(run([trial('bed', 0, good())]), run([trial('bed', 0, unknown, 'regression')]))
    expect(statusOf(r, 'bed', '0:a')).toBe('new')
    expect(r.cases[0].requirements.some((q) => q.id === '0:b')).toBe(false)
  })

  it('a requirement the candidate no longer has is retired', () => {
    const r = compared(run([trial('bed', 0, good())]), run([trial('bed', 0, [stepOf('s', [expectation('0:other', 'pass')])])]))
    expect(statusOf(r, 'bed', '0:verdict')).toBe('retired')
  })
})

describe('trialsOfRows', () => {
  it('numbers repeated rows of a case and classifies each', () => {
    const rows = [plantStand(), plantStand(), resultOf()].map((r) => ({ ...r, model: 'm', prompt: null }))
    const trials = trialsOfRows(rows, known)
    expect(trials.map((t) => [t.caseId, t.trial, t.classification])).toEqual([
      ['plant-stand', 0, 'known-failure'],
      ['plant-stand', 1, 'known-failure'],
      ['bed', 0, 'pass'],
    ])
  })
})
