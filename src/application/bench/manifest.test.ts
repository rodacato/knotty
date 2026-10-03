import { describe, expect, it } from 'vitest'
import { COMMIT, jobsOf, manifestOf } from './fixtures.test-util'
import { allowlistHeaders, assertNoSecrets, buildManifest, compatibility, Manifest, newJobs, parseManifest, summarizeJobs, updateJob } from './manifest'

describe('the manifest', () => {
  it('accepts a complete one', () => {
    expect(parseManifest(manifestOf()).runId).toBeTruthy()
    expect(buildManifest(manifestOf({ hashes: { ...manifestOf().hashes, prompts: 'one-hash', corpus: 'corpus-hash' } }))).toBeTruthy()
  })

  it.each([
    ['a short commit', { commit: '8475ce9' }],
    ['an uppercase commit', { commit: 'A'.repeat(40) }],
    ['a different version', { version: 2 }],
    ['no hashes', { hashes: undefined }],
    ['repeat 0', { config: { ...manifestOf().config, repeat: 0 } }],
    ['concurrency 0', { config: { ...manifestOf().config, concurrency: { default: 0, perHost: {} } } }],
    ['a host with credentials', { provider: { ...manifestOf().provider, host: 'https://user:pw@host' } }],
    ['a host with a query', { provider: { ...manifestOf().provider, host: 'host/v1?key=abc' } }],
    ['an unknown job status', { jobs: [{ jobId: 'x', caseId: 'bed', trial: 0, status: 'weird' }] }],
    ['a negative trial', { jobs: [{ jobId: 'x', caseId: 'bed', trial: -1, status: 'pending' }] }],
  ])('rejects %s', (_, over) => {
    expect(Manifest.safeParse({ ...manifestOf(), ...over }).success).toBe(false)
  })

  it('keeps the full commit and requires a hash for the grader', () => {
    expect(parseManifest(manifestOf()).commit).toBe(COMMIT)
    expect(Manifest.safeParse(manifestOf({ hashes: { ...manifestOf().hashes, graderVersion: '' } })).success).toBe(false)
  })

  it('refuses a credential anywhere in it', () => {
    expect(() => parseManifest(manifestOf({ label: 'run with sk-ant-api03-abcdefghijklmnop' }))).toThrow(/Secret/)
    expect(() => parseManifest(manifestOf({ provider: { ...manifestOf().provider, requestedModel: 'Bearer abcdefghijklmnop' } }))).toThrow(/Secret/)
  })

  it('a job that carries a header outside the allowlist is rejected', () => {
    const telemetry = { status: 200, ttfbMs: 5, totalMs: 10, responseModel: 'm', requestId: 'r', headersAllowlisted: { authorization: 'x' } }
    const base = manifestOf()
    expect(Manifest.safeParse({ ...base, jobs: [{ ...base.jobs[0], telemetry: [telemetry] }] }).success).toBe(false)
    expect(parseManifest({ ...base, jobs: [{ ...base.jobs[0], telemetry: [{ ...telemetry, headersAllowlisted: { 'x-request-id': 'abc' } }] }] }).jobs[0].telemetry).toHaveLength(1)
  })

  it('updateJob changes one job and validates again', () => {
    const m = jobsOf(manifestOf(), () => ({ status: 'pending' as const, outcome: undefined }))
    const next = updateJob(m, m.jobs[0].jobId, { status: 'running', startedAt: '2026-10-02T16:00:00Z' })
    expect(next.jobs.map((j) => j.status)).toEqual(['running', 'pending'])
    expect(() => updateJob(m, 'nope', { status: 'done' })).toThrow(/no job/)
  })

  it('newJobs plans every case and trial, pending, with different ids', () => {
    const jobs = newJobs('r1', ['a', 'b'], 3)
    expect(jobs).toHaveLength(6)
    expect(new Set(jobs.map((j) => j.jobId)).size).toBe(6)
    expect(jobs.every((j) => j.status === 'pending')).toBe(true)
  })
})

describe('assertNoSecrets', () => {
  it.each([
    ['an apiKey key', { apiKey: 'x' }],
    ['an Authorization key', { headers: { Authorization: 'x' } }],
    ['a cookie key', { Cookie: 'a=b' }],
    ['a nested password', { a: [{ b: { password: 'p' } }] }],
    ['a bearer value', { note: 'Authorization: Bearer abcdefghijkl' }],
    ['an sk- value', ['sk-abcdefghijklmnop1234']],
    ['a long base64 key', { v: 'QWxhZGRpbjpvcGVuIHNlc2FtZVFXRVJUWVVJT1BBU0RGR0hKS0w=' }],
    ['a private key', { v: '-----BEGIN RSA PRIVATE KEY-----' }],
  ])('rejects %s', (_, value) => {
    expect(() => assertNoSecrets(value)).toThrow(/Secret/)
  })

  it('lets legitimate values through: hashes, commits, token counts, ids', () => {
    expect(() =>
      assertNoSecrets({ commit: 'a'.repeat(40), sha: 'f'.repeat(64), outputTokens: 12, inputTokens: 3, runId: '20261002-154501007-abcdef12', model: 'claude-sonnet-4-5', task: 'sk-learn is not a key' }),
    ).not.toThrow()
  })
})

describe('header allowlist', () => {
  it('drops credentials and anything unknown, keeps the telemetry', () => {
    expect(allowlistHeaders({ Authorization: 'Bearer x', Cookie: 'c', 'Set-Cookie': 's', 'X-Api-Key': 'k', 'X-Request-Id': 'r1', 'Retry-After': '5', 'X-Foo': 'y', 'x-shellm-queue-ms': '40' })).toEqual({
      'x-request-id': 'r1',
      'retry-after': '5',
      'x-shellm-queue-ms': '40',
    })
  })
})

describe('summarizeJobs', () => {
  it('counts planned, finished, failed and cancelled', () => {
    const base = manifestOf({}, ['a', 'b', 'c', 'd', 'e'])
    const statuses = ['done', 'failed', 'cancelled', 'pending', 'running'] as const
    const m = { ...base, jobs: base.jobs.map((j, i) => ({ ...j, status: statuses[i] })) }
    expect(summarizeJobs(m)).toEqual({ planned: 5, pending: 1, running: 1, finished: 1, failed: 1, cancelled: 1 })
  })
})

describe('compatibility', () => {
  const a = manifestOf()
  const identity = (over: object) => ({ ...a, ...over })

  it('the same identity is compatible, however the concurrency, repeat or commit differ', () => {
    const b = identity({ commit: 'b'.repeat(40), config: { ...a.config, repeat: 5, concurrency: { default: 6, perHost: { h: 4 } } } })
    expect(compatibility(a, b)).toEqual({ compatible: true, reasons: [], varies: [], cases: { added: [], retired: [], changed: [] } })
  })

  it('a different grader version is incompatible', () => {
    const r = compatibility(a, identity({ hashes: { ...a.hashes, graderVersion: '3' } }))
    expect(r.compatible).toBe(false)
    expect(r.reasons[0]).toMatch(/grader/)
  })

  it('names which prompt changed; a single prompt hash changes as a whole', () => {
    const r = compatibility(a, identity({ hashes: { ...a.hashes, prompts: { skeleton: 'p1', cabinet: 'NEW' } } }))
    expect(r.reasons).toEqual(['prompts differ: cabinet'])
    expect(compatibility(identity({ hashes: { ...a.hashes, prompts: 'x' } }), identity({ hashes: { ...a.hashes, prompts: 'y' } })).compatible).toBe(false)
  })

  it.each([
    ['schemas', { schemas: 's2' }],
    ['catalog', { catalog: 'c2' }],
    ['corpus', { corpus: 'k' }],
  ])('a different %s hash is incompatible', (_, hashes) => {
    expect(compatibility(a, identity({ hashes: { ...a.hashes, ...hashes } })).compatible).toBe(false)
  })

  it('compares runs whose prompts or schemas differ, and says what varies; resuming still refuses them', () => {
    const b = identity({ hashes: { ...a.hashes, prompts: { skeleton: 'p1', cabinet: 'NEW' }, schemas: 's2' } })
    expect(compatibility(a, b, 'compare')).toMatchObject({ compatible: true, reasons: [], varies: ['prompts differ: cabinet', 'schemas differ'] })
    expect(compatibility(a, b, 'resume').compatible).toBe(false)
  })

  it('compares nothing across another grader, catalog, corpus or provider, whatever the mode', () => {
    for (const other of [identity({ hashes: { ...a.hashes, graderVersion: '9' } }), identity({ hashes: { ...a.hashes, catalog: 'c2' } }), identity({ hashes: { ...a.hashes, corpus: 'k' } }), identity({ provider: { ...a.provider, spec: 'openai:gpt' } })]) {
      expect(compatibility(a, other, 'compare').compatible).toBe(false)
    }
  })

  it('a different provider spec is incompatible', () => {
    expect(compatibility(a, identity({ provider: { ...a.provider, spec: 'openai:gpt' } })).compatible).toBe(false)
  })

  it('lists added, retired and changed cases; only the global differences make the runs incompatible', () => {
    const b = identity({ hashes: { ...a.hashes, cases: { bed: 'h-bed', desk: 'CHANGED', sofa: 'h-sofa' } } })
    expect(compatibility(a, b)).toEqual({ compatible: true, reasons: [], varies: [], cases: { added: ['sofa'], retired: [], changed: ['desk'] } })
    expect(compatibility(b, a).cases).toEqual({ added: [], retired: ['sofa'], changed: ['desk'] })
  })
})
