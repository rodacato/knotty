import { describe, expect, it } from 'vitest'
import type { TrialRecord } from './classify'
import { expectation, manifestOf, resultOf, stepOf } from './fixtures.test-util'
import { KNOWN_FAILURES } from './knownFailures'
import type { Manifest } from './manifest'
import { baselineOf, canPromote } from './promote'

const cases = ['bed', 'desk']
const ok = (): Manifest => manifestOf({}, cases)
const passing = (m: Manifest): TrialRecord[] =>
  m.jobs.map((j) => ({ caseId: j.caseId, trial: j.trial, result: resultOf({ caseId: j.caseId, steps: [stepOf('s', [expectation('0:verdict', 'pass')])] }), classification: 'pass' }))
const rowsOf = (results: TrialRecord[]) => results.map((t) => ({ ...t.result, model: 'm', prompt: null }))
const promote = (over: Partial<Parameters<typeof canPromote>[0]> = {}) => {
  const manifest = over.manifest ?? ok()
  return canPromote({ manifest, results: passing(manifest), accept: true, ...over })
}
const refusal = (over: Parameters<typeof promote>[0]) => {
  const r = promote(over)
  return r.ok ? 'PROMOTED' : r.reasons.join(' | ')
}

describe('canPromote', () => {
  it('promotes a complete, clean, reproducible, accepted run', () => {
    expect(promote()).toEqual({ ok: true, reasons: [], notes: [] })
  })

  it('refuses without an explicit accept, whatever else is right', () => {
    expect(refusal({ accept: false })).toMatch(/not accepted/)
    expect(refusal({ accept: undefined as unknown as boolean })).toMatch(/not accepted/)
    expect(refusal({ accept: 'yes' as unknown as boolean })).toMatch(/not accepted/)
  })

  it.each([
    ['pending', 'pending', /pending/],
    ['running', 'running', /running/],
    ['cancelled', 'cancelled', /cancelled/],
    ['failed', 'failed', /failed/],
  ] as const)('refuses an incomplete run with a %s job', (_, status, reason) => {
    expect(refusal({ manifest: { ...ok(), jobs: ok().jobs.map((j, i) => (i ? j : { ...j, status, outcome: undefined })) } })).toMatch(reason)
  })

  it('refuses a run with no jobs', () => {
    expect(refusal({ manifest: { ...ok(), jobs: [] } })).toMatch(/no jobs/)
  })

  it('refuses a done job that has no result', () => {
    const m = ok()
    expect(refusal({ manifest: m, results: passing(m).slice(1) })).toMatch(/no result for bed/)
  })

  it('refuses an undeclared failure and names it', () => {
    const m = ok()
    const results = passing(m)
    results[1] = { ...results[1], result: resultOf({ caseId: 'desk', steps: [stepOf('s', [expectation('0:verdict', 'fail', 'veredicto needs-changes')])] }) }
    expect(refusal({ manifest: m, results })).toMatch(/desk trial 0: undeclared failure/)
  })

  it('does not trust the stored classification: a failure labelled pass is still refused', () => {
    const m = ok()
    const results = passing(m)
    results[0] = { ...results[0], classification: 'pass', result: resultOf({ caseId: 'bed', verdict: 'not-viable' }) }
    expect(refusal({ manifest: m, results })).toMatch(/bed trial 0: undeclared failure/)
  })

  it('refuses an unresolved infrastructure error', () => {
    const m = ok()
    const results = passing(m)
    results[0] = { ...results[0], result: resultOf({ caseId: 'bed', ok: false, error: 'Cancelado.' }) }
    expect(refusal({ manifest: m, results })).toMatch(/infrastructure/)
  })

  it('lets a declared known failure through, as a note, never hidden', () => {
    const m = manifestOf({}, ['plant-stand'])
    const results: TrialRecord[] = [
      { caseId: 'plant-stand', trial: 0, classification: 'known-failure', result: resultOf({ caseId: 'plant-stand', verdict: 'needs-changes', criticals: 1, rules: ['R5_RACKING'], steps: [stepOf('s', [expectation('0:verdict', 'fail', 'veredicto needs-changes (esperado viable)')])] }) },
    ]
    const r = canPromote({ manifest: m, results, accept: true })
    expect(r.ok).toBe(true)
    expect(r.notes).toEqual(['plant-stand trial 0: declared known failure, still failing'])
    expect(canPromote({ manifest: m, results, accept: true, known: [] }).ok).toBe(false)
    expect(KNOWN_FAILURES.some((k) => k.caseId === 'plant-stand')).toBe(true)
  })

  it('refuses a dirty tree without a state hash, and accepts one with it', () => {
    expect(refusal({ manifest: { ...ok(), state: { dirty: true, stateHash: null } } })).toMatch(/dirty tree/)
    expect(promote({ manifest: { ...ok(), state: { dirty: true, stateHash: 'abc123' } } }).ok).toBe(true)
  })

  it.each([
    ['grader version', { graderVersion: '' }, /grader version/],
    ['prompts', { prompts: '' }, /prompts/],
    ['one prompt', { prompts: { a: 'x', b: '' } }, /prompts/],
    ['schemas', { schemas: '' }, /schemas/],
    ['catalog', { catalog: '' }, /catalog/],
    ['a case', { cases: { bed: 'h' } }, /case desk/],
  ])('refuses a missing %s hash', (_, hashes, reason) => {
    expect(refusal({ manifest: { ...ok(), hashes: { ...ok().hashes, ...hashes } } })).toMatch(reason)
  })

  it('refuses a manifest that is not valid, like a short commit', () => {
    expect(refusal({ manifest: { ...ok(), commit: 'abc' } })).toMatch(/commit/)
  })

  describe('against the current baseline', () => {
    const manifest = ok()
    const results = passing(manifest)
    const base = () => baselineOf(manifest, rowsOf(results))
    const failingCandidate = (): TrialRecord[] => results.map((t) => (t.caseId === 'bed' ? { ...t, result: resultOf({ caseId: 'bed', steps: [stepOf('s', [expectation('0:verdict', 'fail', 'veredicto x')])] }) } : t))

    it('a candidate that matches it is promoted', () => {
      expect(promote({ manifest, baseline: base() }).ok).toBe(true)
    })

    it('a regression against it refuses, even though the failure is also undeclared', () => {
      expect(refusal({ manifest, results: failingCandidate(), baseline: base() })).toMatch(/regression against the baseline: bed/)
    })

    it('a baseline measured under another grader is not compared and says so', () => {
      const other = { ...base(), identity: { ...base().identity!, hashes: { ...manifest.hashes, graderVersion: '1' } } }
      const r = promote({ manifest, baseline: other })
      expect(r.ok).toBe(true)
      expect(r.notes.join(' ')).toMatch(/not compared.*grader/)
    })

    it('a legacy baseline without identity is compared by case and says it is unverified', () => {
      const { identity: _identity, ...legacy } = base()
      const r = promote({ manifest, baseline: legacy })
      expect(r.ok).toBe(true)
      expect(r.notes.join(' ')).toMatch(/no identity/)
      expect(refusal({ manifest, results: failingCandidate(), baseline: legacy })).toMatch(/regression/)
    })
  })

  it('never writes anything: the verdict is a plain value and the inputs are untouched', () => {
    const m = ok()
    const before = JSON.stringify(m)
    promote({ manifest: m })
    expect(JSON.stringify(m)).toBe(before)
  })
})

describe('baselineOf', () => {
  it('carries the manifest identity without the jobs, and the rows as given', () => {
    const m = manifestOf({ label: 'prompts@16' }, cases)
    const rows = rowsOf(passing(m))
    const b = baselineOf(m, rows)
    expect(b).toMatchObject({ label: 'prompts@16', commit: m.commit, date: m.createdAt, checkout: null, rows })
    expect(b.identity).toEqual(expect.objectContaining({ hashes: m.hashes, config: m.config, provider: m.provider, runId: m.runId }))
    expect(b.identity).not.toHaveProperty('jobs')
  })

  it('records a dirty state in the checkout note', () => {
    expect(baselineOf({ ...ok(), state: { dirty: true, stateHash: 'abc' } }, []).checkout).toMatch(/abc/)
  })

  it('refuses to build a document that carries a credential', () => {
    expect(() => baselineOf({ ...ok(), label: 'Bearer abcdefghijklmnop' }, [])).toThrow(/Secret/)
  })
})
