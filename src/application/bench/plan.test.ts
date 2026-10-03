import { describe, expect, it } from 'vitest'
import { manifestOf } from './fixtures.test-util'
import type { JobRecord, Manifest } from './manifest'
import { pendingJobs } from './plan'

const withJobs = (statuses: [JobRecord['status'], JobRecord['outcome']?][]): Manifest => {
  const base = manifestOf({}, ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, statuses.length))
  return { ...base, jobs: base.jobs.map((j, i) => ({ ...j, status: statuses[i][0], outcome: statuses[i][1] })) }
}

const ids = (m: Manifest, mode: Parameters<typeof pendingJobs>[1]) => {
  const plan = pendingJobs(m, mode)
  if (!plan.ok) throw new Error(plan.reasons.join())
  return plan.jobs.map((j) => `${j.job.caseId}:${j.reason}`)
}

describe('pendingJobs', () => {
  const m = withJobs([['done', 'pass'], ['pending'], ['running'], ['failed', 'infrastructure'], ['done', 'regression'], ['done', 'known-failure']])

  it('resume runs only what never finished, and says why', () => {
    expect(ids(m, 'resume')).toEqual(['b:pending', 'c:interrupted'])
  })

  it('infrastructure failures are repeated only in retry-infra, on top of the unfinished', () => {
    expect(ids(m, 'retry-infra')).toEqual(['b:pending', 'c:interrupted', 'd:retry-infra'])
    expect(ids(m, 'resume')).not.toContain('d:retry-infra')
  })

  it('regressions and known failures are repeated only in the explicit retry-failed', () => {
    expect(ids(m, 'retry-failed')).toEqual(['b:pending', 'c:interrupted', 'e:retry-failed', 'f:retry-failed'])
    expect(ids(m, 'retry-infra')).not.toContain('e:retry-failed')
  })

  it('a finished passing job is never returned, in any mode', () => {
    for (const mode of ['resume', 'retry-infra', 'retry-failed'] as const) expect(ids(m, mode).some((x) => x.startsWith('a:'))).toBe(false)
  })

  it('cancelled jobs are unfinished work: resume picks them up as cancelled, not as a repeated failure', () => {
    expect(ids(withJobs([['cancelled'], ['done', 'pass']]), 'resume')).toEqual(['a:cancelled'])
  })

  it('a failed job that never got a classification counts as infrastructure', () => {
    const failed = withJobs([['failed']])
    expect(ids(failed, 'resume')).toEqual([])
    expect(ids(failed, 'retry-infra')).toEqual(['a:retry-infra'])
  })

  it('a finished run has nothing to resume', () => {
    expect(ids(withJobs([['done', 'pass'], ['done', 'pass']]), 'resume')).toEqual([])
  })

  describe('against the identity this process would run under', () => {
    const open = withJobs([['pending'], ['done', 'pass']])
    const same = (over: object = {}) => ({ ...open, ...over })

    it('accepts the same setup, whatever the concurrency or repeat', () => {
      const current = same({ config: { ...open.config, repeat: 9, concurrency: { default: 6, perHost: {} } } })
      expect(pendingJobs(open, 'resume', current).ok).toBe(true)
    })

    it.each([
      ['another grader', { hashes: { ...manifestOf().hashes, graderVersion: '9', cases: { a: 'h-a', b: 'h-b' } } }, /grader/],
      ['another prompt', { hashes: { ...manifestOf().hashes, prompts: { skeleton: 'NEW', cabinet: 'p2' }, cases: { a: 'h-a', b: 'h-b' } } }, /prompts/],
      ['another provider', { provider: { ...manifestOf().provider, spec: 'openai:x' } }, /provider/],
      ['another commit', { commit: 'b'.repeat(40) }, /commit/],
      ['another measured state', { state: { dirty: true, stateHash: 'zzz' } }, /state/],
      ['a case that changed', { hashes: { ...manifestOf().hashes, cases: { a: 'CHANGED', b: 'h-b' } } }, /case a changed/],
      ['a case that is gone', { hashes: { ...manifestOf().hashes, cases: { b: 'h-b' } } }, /no longer exists/],
    ])('refuses %s with the reason', (_, over, reason) => {
      const plan = pendingJobs(open, 'resume', same(over))
      expect(plan.ok).toBe(false)
      expect(!plan.ok && plan.reasons.join(' ')).toMatch(reason)
    })

    it('refuses to resume a dirty tree it cannot identify', () => {
      const dirty = { ...open, state: { dirty: true, stateHash: null } }
      expect(pendingJobs(dirty, 'resume', dirty).ok).toBe(false)
      expect(pendingJobs({ ...dirty, state: { dirty: true, stateHash: 'h' } }, 'resume', { ...dirty, state: { dirty: true, stateHash: 'h' } }).ok).toBe(true)
    })

    it('a changed case that has no job left to run does not block', () => {
      const current = same({ hashes: { ...manifestOf().hashes, cases: { a: 'h-a', b: 'CHANGED' } } })
      expect(pendingJobs(open, 'resume', current).ok).toBe(true)
    })
  })
})
