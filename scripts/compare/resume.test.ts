import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSimulated } from '../../src/adapters/llm/simulated/simulated'
import { loadBaseline } from './baselineFile'
import { resumeCompare, type ResumeOptions } from './run'
import { compareOptions, RATE_LIMIT, scripted, simulatedRun, tempDir } from './runs.test-util'
import { createRunStore } from './store'

// These tests run whole scenarios: a CI runner is slower than the default limit allows.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

const dir = tempDir()
afterAll(() => dir.remove())

const resume = (runId: string, mode: ResumeOptions['mode'], lines: string[] = [], over: Partial<ResumeOptions> = {}) => {
  const { spec: _spec, host: _host, cases: _cases, repeat: _repeat, label: _label, parallel: _parallel, makeProvider: _make, ...common } = compareOptions(dir.path, lines)
  return resumeCompare({ ...common, runId, mode, makeProvider: () => createSimulated(0), ...over })
}

const edit = (runId: string, change: (manifest: Record<string, any>) => void) => {
  const path = join(dir.path, runId, 'manifest.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  change(manifest)
  writeFileSync(path, JSON.stringify(manifest))
}

describe('resuming a run that was cut short', () => {
  const lines: string[] = []
  let runId: string
  let firstJob: string
  let firstRecording: string
  let exitCode: number

  beforeAll(async () => {
    const stop = new AbortController()
    const run = await simulatedRun(dir.path, lines, { cases: ['bookcase', 'coffee-table'], repeat: 3, out: (text) => {
      lines.push(text)
      if (/^ {2}✓/.test(text)) stop.abort()
    }, signal: stop.signal })
    runId = run.runId
    exitCode = run.exitCode
    firstJob = run.manifest.jobs.find((j) => j.status === 'done')!.jobId
    firstRecording = readFileSync(join(dir.path, runId, 'recordings', `${firstJob}.json`), 'utf8')
  })

  it('left one job done and the others cancelled, and exited 2', () => {
    expect(exitCode).toBe(2)
    const manifest = createRunStore(dir.path, runId).readManifest()
    expect(manifest.jobs.map((j) => j.status).sort()).toEqual(['cancelled', 'cancelled', 'cancelled', 'cancelled', 'cancelled', 'done'])
  })

  it('runs only the unfinished jobs, leaves the finished one untouched, and ends complete', async () => {
    const out: string[] = []
    const result = await resume(runId, 'resume', out)
    expect(result).toMatchObject({ ok: true, exitCode: 0 })
    expect(out.filter((l) => /^ {2}[✓×!-] /.test(l))).toHaveLength(5)
    const store = createRunStore(dir.path, runId)
    expect(store.readManifest().jobs.every((j) => j.status === 'done')).toBe(true)
    expect(readFileSync(join(store.dir, 'recordings', `${firstJob}.json`), 'utf8')).toBe(firstRecording)
    expect(store.listAttempts().map((a) => a.jobId)).not.toContain(firstJob)
  })

  it('has nothing to resume once everything is done, and says so with the same exit code', async () => {
    const out: string[] = []
    expect(await resume(runId, 'resume', out)).toMatchObject({ ok: true, exitCode: 0 })
    expect(out.join('\n')).toMatch(/Resumen: 6 pasan/)
    expect(out.join('\n')).toMatch(/\(0 por correr\)/)
  })
})

describe('a crash that left a job running', () => {
  it('keeps the interrupted attempt before running the job again', async () => {
    const { runId, manifest } = await simulatedRun(dir.path)
    const victim = manifest.jobs[0].jobId
    edit(runId, (m) => void Object.assign(m.jobs[0], { status: 'running', outcome: undefined, endedAt: undefined }))
    const result = await resume(runId, 'resume')
    expect(result).toMatchObject({ ok: true, exitCode: 0 })
    const store = createRunStore(dir.path, runId)
    expect(store.listAttempts()).toEqual([expect.objectContaining({ jobId: victim, attempt: 1, ended: 'running' })])
    expect(store.readManifest().jobs.map((j) => j.status)).toEqual(['done', 'done'])
  })
})

describe('an infrastructure failure', () => {
  let runId: string
  let first: Awaited<ReturnType<typeof simulatedRun>>
  let broken = true

  beforeAll(async () => {
    const run = await simulatedRun(dir.path, [], { makeProvider: scripted(() => (broken ? RATE_LIMIT : null)), cases: ['bookcase'] })
    runId = run.runId
    first = run
  })

  it('is classified as infrastructure and makes the run exit 2', () => {
    expect(first.exitCode).toBe(2)
    expect(first.manifest.jobs[0]).toMatchObject({ status: 'done', outcome: 'infrastructure' })
  })

  it('is not repeated by a plain resume', async () => {
    const out: string[] = []
    broken = false
    expect(await resume(runId, 'resume', out)).toMatchObject({ ok: true, exitCode: 2 })
    expect(createRunStore(dir.path, runId).listAttempts()).toEqual([])
    expect(out.join('\n')).toMatch(/1 de infraestructura/)
  })

  it('is repeated by --retry-infra, and the failed attempt stays on disk and in the report', async () => {
    const result = await resume(runId, 'retry-infra')
    expect(result).toMatchObject({ ok: true, exitCode: 0 })
    const store = createRunStore(dir.path, runId)
    const [attempt] = store.listAttempts()
    expect(attempt).toMatchObject({ attempt: 1, ended: 'infrastructure', file: expect.stringMatching(/^attempts\/.+\.1\.json$/) })
    const saved = JSON.parse(readFileSync(join(store.dir, attempt.file), 'utf8'))
    expect(saved.result.classification).toBe('infrastructure')
    expect(saved.result.row.error).toMatch(/Límite de peticiones/)
    expect(saved.recording).not.toBeNull()
    expect(saved.telemetry).toEqual([])
    expect(store.readManifest().jobs[0].outcome).toBe('pass')
    expect(readFileSync(join(store.dir, 'report.md'), 'utf8')).toMatch(/## Intentos anteriores[\s\S]*infrastructure/)
    expect(readdirSync(join(store.dir, 'attempts'))).toHaveLength(1)
  })

  it('keeps every attempt when it has to be repeated again', async () => {
    const store = createRunStore(dir.path, runId)
    broken = true
    await resume(runId, 'retry-failed')
    expect(store.listAttempts()).toHaveLength(1)
    edit(runId, (m) => void Object.assign(m.jobs[0], { outcome: 'regression' }))
    broken = false
    await resume(runId, 'retry-failed')
    expect(store.listAttempts().map((a) => [a.attempt, a.ended])).toEqual([[1, 'infrastructure'], [2, 'regression']])
  })
})

describe('regressions and known failures', () => {
  it('are repeated only when asked, and the earlier failing attempt is kept', async () => {
    const run = await simulatedRun(dir.path, [], { cases: ['plant-stand'] })
    expect(run.exitCode).toBe(1)
    expect(await resume(run.runId, 'resume')).toMatchObject({ ok: true, exitCode: 1 })
    const store = createRunStore(dir.path, run.runId)
    expect(store.listAttempts()).toEqual([])
    expect(await resume(run.runId, 'retry-failed')).toMatchObject({ ok: true, exitCode: 1 })
    expect(store.listAttempts().map((a) => a.ended)).toEqual(['regression'])
  })
})

describe('a run that cannot be shown to be the same measurement', () => {
  it.each([
    ['another commit', (m: Record<string, any>) => void (m.commit = 'b'.repeat(40)), /commit bbbbbbb vs /],
    ['another catalog', (m: Record<string, any>) => void (m.hashes.catalog = 'other'), /catalog differs/],
    ['another grader', (m: Record<string, any>) => void (m.hashes.graderVersion = '999'), /grader version 999 vs /],
    ['other prompts', (m: Record<string, any>) => void (m.hashes.prompts = { 'system.md': 'x' }), /prompts differ/],
    ['a case that changed', (m: Record<string, any>) => void (m.hashes.cases.bookcase = 'changed'), /case bookcase changed/],
  ])('is refused for %s, with the reasons, and nothing on disk changes', async (_, change, reason) => {
    const stop = new AbortController()
    stop.abort()
    const { runId } = await simulatedRun(dir.path, [], { signal: stop.signal })
    edit(runId, change)
    const before = readFileSync(join(dir.path, runId, 'manifest.json'), 'utf8')
    const result = await resume(runId, 'resume')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.reasons.join(' | ')).toMatch(reason)
    expect(readFileSync(join(dir.path, runId, 'manifest.json'), 'utf8')).toBe(before)
    expect(createRunStore(dir.path, runId).listAttempts()).toEqual([])
  })
})

describe('the comparison with the baseline', () => {
  it('makes the run exit 1 when a requirement got worse than the verified baseline, and says which', async () => {
    const base = await simulatedRun(dir.path, [], { cases: ['bookcase'], repeat: 6 })
    const baseline = loadBaseline(base.runId, { resultsDir: dir.path })
    const out: string[] = []
    const run = await simulatedRun(dir.path, out, { cases: ['bookcase'], repeat: 6, baseline, makeProvider: scripted(() => 'boom') })
    expect(run.exitCode).toBe(1)
    const report = readFileSync(join(run.dir, 'report.md'), 'utf8')
    expect(report).toMatch(/Comparación verificada/)
    expect(report).toMatch(/\| bookcase \| REGRESIÓN \|/)
    expect(out.join('\n')).toMatch(/Regresiones: bookcase caso completo/)
  })

  it('compares the legacy tracked baseline by case and says it is unverified', async () => {
    const out: string[] = []
    await simulatedRun(dir.path, out, { cases: ['bookcase'], baseline: loadBaseline(undefined, { resultsDir: dir.path }) })
    expect(out.join('\n')).toMatch(/SIN VERIFICAR/)
  })

  it('does not compare against a baseline of another expert, and keeps going', async () => {
    const base = await simulatedRun(dir.path, [], { cases: ['bookcase'], spec: 'simulated:other' })
    const out: string[] = []
    const run = await simulatedRun(dir.path, out, { cases: ['bookcase'], baseline: loadBaseline(base.runId, { resultsDir: dir.path }) })
    expect(run.exitCode).toBe(0)
    expect(out.join('\n')).toMatch(/No se compara: .*provider simulated:other vs simulated/)
  })

  it('refuses a baseline that is not there', () => {
    expect(() => loadBaseline('20260101-000000000-aaaaaaaa', { resultsDir: dir.path })).toThrow(/no existe la corrida/)
    expect(() => loadBaseline(join(dir.path, 'nope.json'), { resultsDir: dir.path })).toThrow(/no existe/)
    expect(loadBaseline('none', { resultsDir: dir.path })).toBeNull()
  })
})

