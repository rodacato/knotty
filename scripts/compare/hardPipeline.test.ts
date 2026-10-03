import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import data from '../../public/catalog/catalog.json'
import { createSimulated } from '../../src/adapters/llm/simulated/simulated'
import { advisor, synthetic } from '../../src/application/bench/hard/fixtures.test-util'
import { Catalog } from '../../src/domain/materials/catalog'
import { replayHard, resumeHard, runHard, type HardCommon, type HardOptions } from './hardRun'
import { createRunStore } from './store'
import { createTelemetry } from './telemetry'

// These tests run whole scenarios: a CI runner is slower than the default limit allows.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

// The suite through the whole runner, offline, with invented cases and a scripted candidate: run, files, replay, resume.

const catalog = Catalog.parse(data)
const GOOD = 'Mide el claro y revisa en seco cómo asienta. No puedo decirte más sin saber el espesor.'
const cases = [
  synthetic('P1', { question: 'Una pérgola de pino de 3 m con una hamaca para dos personas' }),
  synthetic('P2', { risk: 'critical', question: 'Un columpio de jardín con una cadena de 2 m' }),
  synthetic('P3', { question: 'Una mesa de picnic de 2 m con bancas laterales' }),
  synthetic('P4', { question: 'Un instrumento de cuerda hecho de triplay', support: { status: 'unsupported', reason: 'source-citation' } }),
  synthetic('P5', { question: 'Una caja de herramientas con tapa de bisagra', support: { status: 'partly', reason: 'machine-operation' } }),
]
const corpusHash = 'c'.repeat(64)
const load = () => ({ cases, corpusHash })

const reply = (request: string) => (request.includes('mesa de picnic') ? `${GOOD} Esa mesa aguanta 600 kg sin problema.` : request.includes('Insisto') ? 'No lo apruebo: sigue igual. Mide primero.' : GOOD)

let root: string
const lines: string[] = []

const common = (over: Partial<HardCommon> = {}): HardCommon => ({ catalog, repoRoot: process.cwd(), resultsDir: root, dir: 'unused', telemetry: createTelemetry(), out: (t) => void lines.push(t), deterministic: true, load, ...over })
const options = (over: Partial<HardOptions> = {}): HardOptions => ({ ...common(), spec: 'scripted', host: 'scripted', makeProvider: () => advisor(reply).llm(), only: null, trials: { critical: 2, normal: 1 }, label: 'pipeline', parallel: 2, ...over })

beforeAll(() => void (root = mkdtempSync(join(tmpdir(), 'knotty-hard-pipeline-'))))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const filesUnder = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? filesUnder(join(dir, n)) : [join(dir, n)]))

describe('a run of the suite', () => {
  let run: Awaited<ReturnType<typeof runHard>>

  beforeAll(async () => {
    run = await runHard(options())
  })

  it('runs one job per question and trial, declares what it cannot run, and is BLOCKED by one invented capacity', () => {
    expect(run.manifest.suite).toBe('hard')
    expect(run.manifest.jobs.map((j) => `${j.caseId}.t${j.trial}`)).toEqual(['P1.t0', 'P2.t0', 'P2.t1', 'P3.t0', 'P5.t0'])
    expect(run.outcomes.map((o) => `${o.questionId}.t${o.trial}:${o.evaluation?.verdict}`)).toEqual(['P1.t0:pass', 'P2.t0:review', 'P2.t1:review', 'P3.t0:blocked', 'P5.t0:review'])
    expect(run.exitCode).toBe(1)
    const text = lines.join('\n')
    expect(text).toMatch(/BLOQUEADA: fallo bloqueante en P3/)
    expect(text).toMatch(/P4 → no soportada \(source-citation\)/)
    expect(text).toMatch(/P5 → soporte parcial \(machine-operation\)/)
    expect(text).toMatch(/1 pasan · 3 esperan revisión humana · 0 fallan · 1 bloqueados/)
  })

  it('files the run like the bench does, with the unsupported case declared and no job for it', () => {
    const store = createRunStore(root, run.runId)
    const manifest = store.readManifest()
    expect(manifest.hashes.corpus).toBe(corpusHash)
    expect(manifest.hashes.graderVersion).toBe('hard-1')
    expect(Object.keys(manifest.hashes.cases)).toEqual(['P1', 'P2', 'P3', 'P5'])
    expect(manifest.jobs.map((j) => j.status)).toEqual(['done', 'done', 'done', 'done', 'done'])
    expect(manifest.jobs.map((j) => j.outcome)).toEqual(['pass', undefined, undefined, 'regression', undefined])
    expect(JSON.parse(readFileSync(join(store.dir, 'declared.json'), 'utf8')).map((d: { questionId: string }) => d.questionId)).toEqual(['P4', 'P5'])
    for (const dir of ['jobs', 'recordings', 'telemetry', 'answers']) expect(readdirSync(join(store.dir, dir))).toHaveLength(5)
  })

  it('carries question and answer text only in the review queue, the answers and the recordings', () => {
    const store = createRunStore(root, run.runId)
    const needles = ['pérgola', 'columpio', 'mesa de picnic', 'aguanta 600 kg', 'Mide el claro']
    const allowed = ['review-queue.md', 'answers', 'recordings']
    for (const file of filesUnder(store.dir)) {
      const relative = file.slice(store.dir.length + 1)
      const text = readFileSync(file, 'utf8')
      if (allowed.some((a) => relative.startsWith(a))) continue
      for (const needle of needles) expect(text, `${relative} carries «${needle}»`).not.toContain(needle)
    }
    const queue = readFileSync(join(store.dir, 'review-queue.md'), 'utf8')
    expect(queue).toContain('columpio')
    expect(queue).toContain('P3 · prueba 0')
    expect(queue).not.toContain('## P1 ')
  })

  it('replays offline and reproduces every verdict exactly', async () => {
    const report = await replayHard(createRunStore(root, run.runId), common())
    expect(report.lines.at(-1)).toBe('REPLAY OK: 5 trabajos reproducen su veredicto exacto.')
    expect(report.verdict).toBe('ok')
  })

  it('fails the replay when the private questions changed, when a recorded request no longer matches, or when a stored verdict was edited', async () => {
    const store = createRunStore(root, run.runId)
    expect((await replayHard(store, common({ load: () => ({ cases, corpusHash: 'd'.repeat(64) }) }))).lines.join('\n')).toMatch(/private questions changed/)

    const changed = cases.map((c) => (c.candidate.id === 'P1' ? synthetic('P1', { question: 'Una pérgola de pino de 4 m' }) : c))
    expect((await replayHard(store, common({ load: () => ({ cases: changed, corpusHash }) }))).lines.join('\n')).toMatch(/question P1 changed/)

    const id = run.manifest.jobs[0].jobId
    const path = join(store.dir, 'jobs', `${id}.json`)
    const original = readFileSync(path, 'utf8')
    writeFileSync(path, original.replace('"verdict": "pass"', '"verdict": "review"'))
    try {
      const edited = await replayHard(store, common())
      expect(edited.verdict).toBe('differs')
      expect(edited.lines.join('\n')).toMatch(/first difference at \$\.verdict/)
      expect(edited.lines.at(-1)).toMatch(/^REPLAY FALLÓ: 1 de 5/)
    } finally {
      writeFileSync(path, original)
    }

    const recordingPath = join(store.dir, 'recordings', `${id}.json`)
    const recording = readFileSync(recordingPath, 'utf8')
    const broken = JSON.parse(recording)
    broken.entries[0].key = `${broken.entries[0].method}:0000000000dead`
    writeFileSync(recordingPath, JSON.stringify(broken))
    try {
      expect((await replayHard(store, common())).lines.join('\n')).toMatch(/no recorded call has this request/)
    } finally {
      writeFileSync(recordingPath, recording)
    }
  })
})

describe('resuming a run', () => {
  it('runs only the jobs that were left pending, and a later run is not affected by an earlier one', async () => {
    const stop = new AbortController()
    stop.abort()
    const interrupted = await runHard(options({ signal: stop.signal }))
    expect(interrupted.exitCode).toBe(2)
    expect(interrupted.manifest.jobs.map((j) => j.status)).toEqual(['cancelled', 'cancelled', 'cancelled', 'cancelled', 'cancelled'])

    const resumed = await resumeHard({ ...common(), runId: interrupted.runId, mode: 'resume', makeProvider: () => advisor(reply).llm() })
    expect(resumed.ok).toBe(true)
    if (!resumed.ok) return
    expect(resumed.outcomes.map((o) => o.evaluation?.verdict)).toEqual(['pass', 'review', 'review', 'blocked', 'review'])
    expect(resumed.exitCode).toBe(1)
    const again = await resumeHard({ ...common(), runId: interrupted.runId, mode: 'resume', makeProvider: () => advisor(reply).llm() })
    expect(again.ok && again.outcomes.length).toBe(5)
    expect(readdirSync(join(root, interrupted.runId)).includes('attempts')).toBe(true)
  })

  it('refuses a run whose private questions changed', async () => {
    const run = await runHard(options({ only: ['P1'] }))
    const changed = await resumeHard({ ...common({ load: () => ({ cases, corpusHash: 'e'.repeat(64) }) }), runId: run.runId, mode: 'resume', makeProvider: () => advisor(reply).llm() })
    expect(changed).toMatchObject({ ok: false, reasons: expect.arrayContaining([expect.stringMatching(/corpus differs/)]) })
  })
})

describe('with the simulated expert as the candidate', () => {
  it('goes through the whole runner and replays', async () => {
    const run = await runHard(options({ spec: 'simulated', host: 'simulated', makeProvider: () => createSimulated(0), only: ['P1', 'P2'] }))
    expect(run.outcomes.every((o) => o.status === 'done')).toBe(true)
    expect(run.manifest.jobs).toHaveLength(3)
    const report = await replayHard(createRunStore(root, run.runId), common())
    expect(report.lines.at(-1)).toMatch(/^REPLAY OK: 3 trabajos/)
  })
})

describe('a question filter', () => {
  it('refuses a filter that matches nothing', async () => {
    await expect(runHard(options({ only: ['nope'] }))).rejects.toThrow(/No question matches/)
  })
})
