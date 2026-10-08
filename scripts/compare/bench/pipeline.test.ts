import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import data from '../../../public/catalog/catalog.json'
import { createSimulated } from '../../../src/adapters/llm/simulated/simulated'
import type { ReportRow } from '../../../src/application/bench/report'
import { Catalog } from '../../../src/domain/materials/catalog'
import { runCompare, type CompareOutcome } from './run'
import { replayRun } from './replayRun'
import { createRunStore, listRuns } from '../shared/store'
import { exitCodeOf, runSummary, type JobOutcome } from './summary'
import { createTelemetry } from '../shared/telemetry'

// These tests run whole scenarios: a CI runner is slower than the default limit allows.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

const catalog = Catalog.parse(data)
let root: string
const lines: string[] = []

const compare = (over: Partial<Parameters<typeof runCompare>[0]> = {}) =>
  runCompare({
    spec: 'simulated',
    host: 'simulated',
    makeProvider: () => createSimulated(0),
    catalog,
    repoRoot: process.cwd(),
    resultsDir: root,
    cases: ['bookcase', 'coffee-table'],
    repeat: 2,
    label: 'pipeline test',
    parallel: 2,
    baseline: null,
    telemetry: createTelemetry(),
    out: (text) => void lines.push(text),
    ...over,
  })

beforeAll(() => void (root = mkdtempSync(join(tmpdir(), 'knotty-pipeline-'))))
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('a full run with the simulated expert, then its replay', () => {
  let run: CompareOutcome

  beforeAll(async () => {
    run = await compare()
  })

  it('finishes every job, passes, and exits 0', () => {
    expect(run.exitCode).toBe(0)
    expect(run.outcomes.map((o) => `${o.caseId}.t${o.trial}:${o.classification}`)).toEqual(['bookcase.t0:pass', 'bookcase.t1:pass', 'coffee-table.t0:pass', 'coffee-table.t1:pass'])
    expect(run.manifest.jobs.map((j) => j.status)).toEqual(['done', 'done', 'done', 'done'])
    expect(lines.join('\n')).toMatch(/Resumen: 4 pasan · 0 fallas conocidas \(siguen fallando\) · 0 regresiones · 0 de infraestructura · 0 sin terminar/)
  })

  it('leaves the whole run on disk, readable, with the identity of what was measured', () => {
    const store = createRunStore(root, run.runId)
    const manifest = store.readManifest()
    expect(manifest.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(manifest.hashes.catalog).toMatch(/^[0-9a-f]{64}$/)
    expect(Object.keys(manifest.hashes.cases)).toEqual(['bookcase', 'coffee-table'])
    expect(manifest.config).toMatchObject({ repeat: 2, concurrency: { default: 2, perHost: { simulated: 2 } } })
    for (const dir of ['jobs', 'recordings', 'telemetry', 'designs']) expect(readdirSync(join(store.dir, dir))).toHaveLength(4)
    expect(readFileSync(join(store.dir, 'report.md'), 'utf8')).toContain('bookcase')
    expect(readdirSync(store.dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
    const job = store.readJob(manifest.jobs[0].jobId) as { row: ReportRow; classification: string; graderVersion: string }
    expect(job).toMatchObject({ classification: 'pass', graderVersion: manifest.hashes.graderVersion })
    expect(job.row.steps?.length).toBeGreaterThan(0)
    expect(listRuns(root)).toContain(run.runId)
  })

  it('replays offline and reproduces every verdict exactly', async () => {
    const report = await replayRun(createRunStore(root, run.runId), { catalog, regrade: false })
    expect(report.verdict).toBe('ok')
    expect(report.lines.at(-1)).toMatch(/^REPLAY OK: 4 trabajos/)
    expect(report.jobs.every((j) => !j.problems.length && !j.difference)).toBe(true)
  })

  it('refuses a recording whose request was changed', async () => {
    const store = createRunStore(root, run.runId)
    const id = run.manifest.jobs[0].jobId
    const path = join(store.dir, 'recordings', `${id}.json`)
    const original = readFileSync(path, 'utf8')
    const recording = JSON.parse(original)
    recording.entries[0].key = `${recording.entries[0].method}:0000000000dead`
    writeFileSync(path, JSON.stringify(recording))
    try {
      const report = await replayRun(store, { catalog, regrade: false })
      expect(report.verdict).toBe('differs')
      const broken = report.jobs.find((j) => j.jobId === id)!
      expect(broken.problems.join(' ')).toMatch(/no recorded call has this request/)
      expect(report.lines.at(-1)).toMatch(/^REPLAY FALLÓ/)
      expect(report.lines.join('\n')).not.toContain('REPLAY OK')
    } finally {
      writeFileSync(path, original)
    }
  })

  it('shows, never hides, a recorded answer that no longer gives the stored verdict', async () => {
    const store = createRunStore(root, run.runId)
    const id = run.manifest.jobs[0].jobId
    const path = join(store.dir, 'jobs', `${id}.json`)
    const original = readFileSync(path, 'utf8')
    const stored = JSON.parse(original)
    stored.row.verdict = 'needs-changes'
    writeFileSync(path, JSON.stringify(stored))
    try {
      const strict = await replayRun(store, { catalog, regrade: false })
      expect(strict.verdict).toBe('differs')
      expect(strict.jobs.find((j) => j.jobId === id)!.difference).toMatch(/^verdict: stored "needs-changes", replayed "viable"/)

      const regrade = await replayRun(store, { catalog, regrade: true })
      expect(regrade.verdict).toBe('ok')
      expect(regrade.lines.join('\n')).toMatch(/regradedFrom: .*calificador 2 → 2/)
      expect(regrade.lines.at(-1)).toMatch(/^REGRADE LISTO: 1 de 4/)
    } finally {
      writeFileSync(path, original)
    }
  })

  it('refuses a replay against a different catalog', async () => {
    const other = { ...catalog, materials: catalog.materials.slice(1) } as Catalog
    const report = await replayRun(createRunStore(root, run.runId), { catalog: other, regrade: false })
    expect(report.verdict).toBe('differs')
    expect(report.jobs[0].problems[0]).toMatch(/catalog changed/)
  })
})

describe('an interrupted run', () => {
  it('saves a manifest with the unlaunched jobs cancelled and exits non-zero', async () => {
    const stop = new AbortController()
    stop.abort()
    const run = await compare({ signal: stop.signal, repeat: 1 })
    expect(run.exitCode).toBe(2)
    const manifest = createRunStore(root, run.runId).readManifest()
    expect(manifest.jobs.map((j) => j.status)).toEqual(['cancelled', 'cancelled'])
    expect(lines.join('\n')).toMatch(/2 sin terminar/)
  })
})

describe('classification and exit code', () => {
  const row = (caseId: string, over: Partial<ReportRow> = {}) =>
    ({ caseId, ok: true, error: null, seconds: 1, calls: 1, outputTokens: null, inputTokens: null, callLog: [], path: 'plan', pieces: 1, joints: 0, measures: '1 × 1 × 1', reasonable: true, structure: null, criticals: 0, rules: [], corrections: [], repairs: 0, verdict: 'viable', adjustments: [], model: 'm', prompt: null, steps: [], ...over }) as ReportRow
  const outcome = (over: Partial<JobOutcome>): JobOutcome => ({ jobId: 'j', caseId: 'bed', trial: 0, status: 'done', classification: 'pass', row: row('bed'), seconds: 1, queuedMs: 0, ...over })

  it('does not fail the exit for a known failure alone, and still prints it as failing', () => {
    const known = outcome({ classification: 'known-failure', row: row('plant-stand', { verdict: 'needs-changes', criticals: 1, rules: ['R5_RACKING'] }) })
    expect(exitCodeOf([outcome({}), known])).toBe(0)
    const text = runSummary({ runId: 'r', label: 'l', spec: 's', outcomes: [outcome({}), known], wallMs: 1000, resultsPath: 'p' })
    expect(text).toContain('1 pasan · 1 fallas conocidas (siguen fallando)')
    expect(text).toContain('falla conocida (sigue fallando)')
    expect(text).toContain('R5_RACKING')
  })

  it('fails the exit for a regression (1) and for an incomplete or infrastructure run (2), the regression first', () => {
    expect(exitCodeOf([outcome({ classification: 'regression' })])).toBe(1)
    expect(exitCodeOf([outcome({ status: 'cancelled', classification: undefined, row: undefined })])).toBe(2)
    expect(exitCodeOf([outcome({ status: 'failed', classification: undefined, row: undefined })])).toBe(2)
    expect(exitCodeOf([outcome({ classification: 'infrastructure' })])).toBe(2)
    expect(exitCodeOf([outcome({ classification: 'infrastructure' }), outcome({ classification: 'regression' })])).toBe(1)
  })
})
