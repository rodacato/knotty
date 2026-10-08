import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { canonicalJson, emptyRecording, firstDifference, recordingProvider, replayProvider } from '../../../src/adapters/llm/replay'
import { entropyOf, jobId, newRunId } from '../../../src/application/bench/ids'
import { buildManifest, updateJob, type JobRecord, type Manifest, type ManifestIdentity } from '../../../src/application/bench/manifest'
import { pendingJobs, type PlanMode } from '../../../src/application/bench/plan'
import { runPool, orderJobs, historyOf } from '../../../src/application/bench/schedule'
import { classifyHard, evaluateJob, type Evaluation } from '../../../src/application/bench/hard/evaluate'
import { HARD_KNOWN_FAILURES } from '../../../src/application/bench/hard/knownFailures'
import { hardExitCode, hardReport, hardSummary, progressLine, reviewQueueMarkdown, type Declared, type HardJobOutcome } from '../../../src/application/bench/hard/report'
import { playCase, type Exchange } from '../../../src/application/bench/hard/scenario'
import { candidateOf, type HardCase } from '../../../src/application/bench/hard/types'
import type { Catalog } from '../../../src/domain/materials/catalog'
import type { LLMProvider } from '../../../src/ports/LLMProvider'
import { deterministicSeeds } from '../shared/deterministic'
import { gitIdentity, hashCatalog, hashPrompts, hashSchemas, sha256 } from '../shared/hashing'
import { loadHardCases } from './loader'
import { createRunStore, readManifests, writeAtomic, type RunStore } from '../shared/store'
import type { Telemetry } from '../shared/telemetry'

// The hard-question suite as a run: one job per question and trial, through the same directory, manifest, recordings, replay and exit codes as the bench.
// A job's file carries ids and check results; the answers go to answers/ and the review queue, both in the run's ignored directory.

export const HARD_GRADER_VERSION = 'hard-1'
export const DEFAULT_TRIALS = { critical: 3, normal: 1 } as const
const JOB_MS = 15 * 60_000
const REQUEST_MS = 5 * 60_000

export interface HardCommon {
  catalog: Catalog
  repoRoot: string
  resultsDir: string
  /** The private directory the cases come from. */
  dir: string
  telemetry: Telemetry
  signal?: AbortSignal
  out?: (text: string) => void
  deterministic?: boolean
  clock?: () => Date
  jobMs?: number
  /** Replaces the loader: the pipeline tests run synthetic cases through the whole runner. */
  load?: () => { cases: HardCase[]; corpusHash: string }
}

export interface HardOptions extends HardCommon {
  spec: string
  host: string
  makeProvider: () => LLMProvider
  only: string[] | null
  trials: { critical: number; normal: number }
  label: string
  parallel: number
}

export interface HardResumeOptions extends HardCommon {
  runId: string
  mode: PlanMode
  makeProvider: (spec: string) => LLMProvider
}

export interface HardOutcome {
  runId: string
  dir: string
  exitCode: number
  outcomes: HardJobOutcome[]
  manifest: Manifest
}

export type HardResumeOutcome = ({ ok: true } & HardOutcome) | { ok: false; reasons: string[] }

const abortError = () => Object.assign(new Error('Cancelado'), { name: 'AbortError' })

const caseHash = (c: HardCase) => sha256(canonicalJson({ candidate: c.candidate, key: c.key, support: c.support, grader: HARD_GRADER_VERSION }))
const loaded = (o: HardCommon) => (o.load ?? (() => loadHardCases(o.dir)))()
const runnable = (cases: HardCase[]) => cases.filter((c) => c.support.status !== 'unsupported')
const declaredOf = (cases: HardCase[]): Declared[] => cases.filter((c) => c.support.status !== 'supported').map((c) => ({ questionId: c.candidate.id, support: c.support }))
const trialsOf = (c: HardCase, trials: HardOptions['trials']) => (c.key.risk === 'critical' ? trials.critical : trials.normal)

function measured(o: Pick<HardCommon, 'repoRoot' | 'catalog'>, cases: HardCase[], corpusHash: string) {
  const identity = gitIdentity(o.repoRoot)
  return {
    commit: identity.commit,
    state: { dirty: identity.dirty, stateHash: identity.stateHash },
    hashes: {
      cases: Object.fromEntries(runnable(cases).map((c) => [c.candidate.id, caseHash(c)])),
      graderVersion: HARD_GRADER_VERSION,
      prompts: hashPrompts(o.repoRoot),
      schemas: hashSchemas(o.repoRoot),
      catalog: hashCatalog(o.catalog),
      corpus: corpusHash,
    },
  }
}

const identityOf = ({ jobs: _jobs, ...identity }: Manifest): ManifestIdentity => identity

export interface StoredHardJob {
  jobId: string
  runId: string
  questionId: string
  trial: number
  spec: string
  graderVersion: string
  verdict: Evaluation['verdict']
  classification: ReturnType<typeof classifyHard>
  reviewReasons: string[]
  checks: Evaluation['checks']
  seconds: number
}

const answersFile = (store: RunStore, id: string) => join(store.dir, 'answers', `${id}.json`)

function writeAnswers(store: RunStore, id: string, exchanges: Exchange[]) {
  mkdirSync(join(store.dir, 'answers'), { recursive: true })
  writeAtomic(answersFile(store, id), `${JSON.stringify(exchanges, null, 2)}\n`)
}

const readAnswers = (store: RunStore, id: string): Exchange[] => (existsSync(answersFile(store, id)) ? (JSON.parse(readFileSync(answersFile(store, id), 'utf8')) as Exchange[]) : [])

interface Execution extends HardCommon {
  store: RunStore
  manifest: Manifest
  makeProvider: () => LLMProvider
  cases: HardCase[]
  toRun: JobRecord[]
  settled: HardJobOutcome[]
}

async function execute(o: Execution): Promise<HardOutcome> {
  const { store, catalog, telemetry } = o
  const out = o.out ?? ((text: string) => void process.stdout.write(`${text}\n`))
  const clock = o.clock ?? (() => new Date())
  let manifest = o.manifest
  const { runId, label, provider: { spec, host }, config } = manifest
  const caseOf = new Map(o.cases.map((c) => [c.candidate.id, c]))
  const jobMs = o.jobMs ?? config.timeouts.jobMs ?? JOB_MS
  const parallel = config.concurrency.perHost[host] ?? config.concurrency.default
  const declared = declaredOf(o.cases)

  const save = (next: Manifest) => {
    manifest = next
    store.writeManifest(manifest)
  }
  save(manifest)
  writeAtomic(join(store.dir, 'declared.json'), `${JSON.stringify(declared, null, 2)}\n`)

  const outcomes = new Map<string, HardJobOutcome>(o.settled.map((s) => [s.jobId, s]))
  const facts = () => ({ runId, label, spec, outcomes: manifest.jobs.flatMap((j) => outcomes.get(j.jobId) ?? []), declared, resultsPath: join(store.dir, 'report.md') })
  const writeFiles = () => {
    store.writeReport(hardReport(facts()))
    writeAtomic(join(store.dir, 'review-queue.md'), reviewQueueMarkdown(runId, facts().outcomes))
  }

  out(`Corrida ${runId} · suite difícil · ${manifest.jobs.length} ${manifest.jobs.length === 1 ? 'trabajo' : 'trabajos'}${o.toRun.length < manifest.jobs.length ? ` (${o.toRun.length} por correr)` : ''} · ${spec} · ${parallel} a la vez por host · carpeta: ${store.dir}`)
  const poolStart = performance.now()

  const runJob = async (job: { jobId: string; caseId: string; trial: number }, signal: AbortSignal | undefined): Promise<void> => {
    const hardCase = caseOf.get(job.caseId)!
    save(updateJob(manifest, job.jobId, { status: 'running', startedAt: clock().toISOString() }))
    const recording = emptyRecording(manifest.hashes.catalog)
    const provider = recordingProvider(telemetry.provider(o.makeProvider(), job.jobId), recording, { catalogStamp: manifest.hashes.catalog })
    const seeds = o.deterministic ? deterministicSeeds() : {}
    const started = performance.now()
    const played = await playCase(candidateOf(hardCase), job.trial, { llm: () => provider, catalog, ...seeds }, AbortSignal.any([AbortSignal.timeout(jobMs), ...(signal ? [signal] : [])]))
    if (signal?.aborted) throw abortError()

    const evaluation = evaluateJob(hardCase, played.facts)
    const classification = classifyHard(job.caseId, evaluation, HARD_KNOWN_FAILURES)
    const seconds = (performance.now() - started) / 1000
    store.writeRecording(job.jobId, recording)
    store.writeTelemetry(job.jobId, await telemetry.take(job.jobId))
    const stored: StoredHardJob = { jobId: job.jobId, runId, questionId: job.caseId, trial: job.trial, spec, graderVersion: HARD_GRADER_VERSION, verdict: evaluation.verdict, classification, reviewReasons: evaluation.reviewReasons, checks: evaluation.checks, seconds }
    store.writeJob(job.jobId, stored)
    writeAnswers(store, job.jobId, played.exchanges)

    const outcome: HardJobOutcome = { jobId: job.jobId, questionId: job.caseId, trial: job.trial, status: 'done', evaluation, classification, exchanges: played.exchanges, seconds }
    outcomes.set(job.jobId, outcome)
    save({
      ...updateJob(manifest, job.jobId, { status: 'done', outcome: classification ?? undefined, endedAt: clock().toISOString(), file: `jobs/${job.jobId}.json`, queuedMs: Math.round(performance.now() - poolStart) }),
      provider: { ...manifest.provider, effectiveModels: [...new Set([...manifest.provider.effectiveModels, ...telemetry.effectiveModels()])].sort() },
    })
    writeFiles()
    out(progressLine(outcome))
  }

  const history = historyOf(readManifests(o.resultsDir))
  const ordered = orderJobs(o.toRun, history).map((j) => ({ ...j, host }))
  const pooled = await runPool(ordered, (job, signal) => runJob(job, signal), { limits: config.concurrency, now: () => performance.now(), signal: o.signal })
  const wallMs = performance.now() - poolStart

  for (const p of pooled) {
    const { jobId: id, caseId, trial } = p.job
    if (p.status === 'cancelled') save(updateJob(manifest, id, { status: 'cancelled', endedAt: clock().toISOString() }))
    if (p.status === 'failed') save(updateJob(manifest, id, { status: 'failed', endedAt: clock().toISOString() }))
    if (p.status !== 'done') outcomes.set(id, { jobId: id, questionId: caseId, trial, status: p.status, error: p.error instanceof Error ? p.error.message : p.error ? String(p.error) : undefined, seconds: 0 })
  }
  writeFiles()
  const ordering = facts().outcomes
  out(`\n${hardSummary({ ...facts(), outcomes: ordering })}\nTiempo total: ${(wallMs / 1000).toFixed(1)} s`)
  return { runId, dir: store.dir, exitCode: hardExitCode(ordering), outcomes: ordering, manifest }
}

export async function runHard(o: HardOptions): Promise<HardOutcome> {
  const { cases: all, corpusHash } = loaded(o)
  const cases = all.filter((c) => !o.only || o.only.includes(c.candidate.id))
  const toRun = runnable(cases)
  if (!cases.length) throw new Error(`No question matches KNOTTY_CASES=${o.only?.join(',')}.`)
  const clock = o.clock ?? (() => new Date())
  const created = clock()
  const runId = newRunId(created, entropyOf(randomBytes(4)))
  const store = createRunStore(o.resultsDir, runId)
  const jobs: JobRecord[] = toRun.flatMap((c) => Array.from({ length: trialsOf(c, o.trials) }, (_, trial) => ({ jobId: jobId(runId, c.candidate.id, trial), caseId: c.candidate.id, trial, status: 'pending' as const })))
  const manifest = buildManifest({
    version: 1,
    runId,
    createdAt: created.toISOString(),
    label: o.label,
    suite: 'hard',
    ...measured(o, cases, corpusHash),
    provider: { spec: o.spec, host: o.host, requestedModel: o.spec.split(':').slice(1).join(':') || null, effectiveModels: [] },
    config: { repeat: Math.max(1, o.trials.critical, o.trials.normal), concurrency: { default: o.parallel, perHost: { [o.host]: o.parallel } }, casesFilter: o.only, timeouts: { requestMs: REQUEST_MS, jobMs: o.jobMs ?? JOB_MS } },
    jobs,
  })
  return execute({ ...o, store, manifest, cases, toRun: manifest.jobs, settled: [] })
}

const settledOutcome = (store: RunStore, job: JobRecord): HardJobOutcome => {
  const base = { jobId: job.jobId, questionId: job.caseId, trial: job.trial, seconds: 0 }
  if (job.status === 'done' && store.hasJob(job.jobId)) {
    const saved = store.readJob(job.jobId) as StoredHardJob
    return { ...base, status: 'done', evaluation: { verdict: saved.verdict, checks: saved.checks, reviewReasons: saved.reviewReasons }, classification: saved.classification, exchanges: readAnswers(store, job.jobId), seconds: saved.seconds }
  }
  if (job.status === 'failed' || job.status === 'done') return { ...base, status: 'failed', error: 'falló en una corrida anterior y no se reintentó' }
  return { ...base, status: 'cancelled' }
}

/** Runs only what the plan says is pending in a compatible run, with the same private cases it was made with. */
export async function resumeHard(o: HardResumeOptions): Promise<HardResumeOutcome> {
  const store = createRunStore(o.resultsDir, o.runId)
  const saved = store.readManifest()
  if (saved.suite !== 'hard') return { ok: false, reasons: ['la corrida no es de la suite difícil'] }
  const { cases, corpusHash } = loaded(o)
  const current: ManifestIdentity = { ...identityOf(saved), ...measured(o, cases.filter((c) => saved.config.casesFilter?.includes(c.candidate.id) ?? true), corpusHash) }
  const plan = pendingJobs(saved, o.mode, current)
  if (!plan.ok) return { ok: false, reasons: plan.reasons }

  let manifest = saved
  for (const { job } of plan.jobs) {
    if (job.status !== 'pending') store.archiveAttempt(job)
    manifest = updateJob(manifest, job.jobId, { status: 'pending', outcome: undefined, startedAt: undefined, endedAt: undefined, file: undefined, queuedMs: undefined })
    store.writeManifest(manifest)
  }
  const rerun = new Set(plan.jobs.map((p) => p.job.jobId))
  const settled = manifest.jobs.filter((j) => !rerun.has(j.jobId)).map((j) => settledOutcome(store, j))
  const outcome = await execute({ ...o, store, manifest, cases, makeProvider: () => o.makeProvider(saved.provider.spec), toRun: manifest.jobs.filter((j) => rerun.has(j.jobId)), settled })
  return { ok: true, ...outcome }
}

export interface HardReplayReport {
  runId: string
  verdict: 'ok' | 'differs'
  lines: string[]
}

/** Re-runs every recorded job offline with its recorded answers and compares what the checks say with what was stored. */
export async function replayHard(store: RunStore, options: HardCommon): Promise<HardReplayReport> {
  const manifest = store.readManifest()
  const { cases, corpusHash } = loaded(options)
  const byId = new Map(cases.map((c) => [c.candidate.id, c]))
  const stamp = hashCatalog(options.catalog)
  const lines = [`Repetición sin conexión de ${manifest.runId} (suite difícil)`]
  const problemsOf: string[][] = []
  const jobs = manifest.jobs.filter((j) => j.status === 'done')

  for (const job of jobs) {
    const problems: string[] = []
    const hardCase = byId.get(job.caseId)
    if (corpusHash !== manifest.hashes.corpus) problems.push('the private questions changed since the run')
    if (stamp !== manifest.hashes.catalog) problems.push('the catalog changed since the run: its answers cannot be replayed against it')
    if (!hardCase) problems.push(`question ${job.caseId} no longer exists`)
    else if (caseHash(hardCase) !== manifest.hashes.cases[job.caseId]) problems.push(`question ${job.caseId} changed since the run`)
    let difference: string | null = null

    if (hardCase && !problems.length) {
      const stored = store.readJob(job.jobId) as StoredHardJob
      const replay = replayProvider(store.readRecording(job.jobId), { catalogStamp: stamp })
      const played = await playCase(candidateOf(hardCase), job.trial, { llm: () => replay, catalog: options.catalog, ...deterministicSeeds() }, new AbortController().signal)
      const evaluation = evaluateJob(hardCase, played.facts)
      for (const m of replay.mismatches()) problems.push(m.message)
      for (const u of replay.unused()) problems.push(`recorded ${u.method} answer never asked for (${u.key})`)
      const was = { verdict: stored.verdict, classification: stored.classification, checks: stored.checks }
      const now = { verdict: evaluation.verdict, classification: classifyHard(job.caseId, evaluation, HARD_KNOWN_FAILURES), checks: evaluation.checks }
      difference = firstDifference(was, now)
    }
    problemsOf.push(difference ? [...problems, `first difference at ${difference}`] : problems)
  }

  jobs.forEach((job, i) => lines.push(`  ${problemsOf[i].length ? '×' : '✓'} ${job.caseId} t${job.trial}`, ...problemsOf[i].map((p) => `      problema: ${p}`)))
  const failing = problemsOf.filter((p) => p.length).length
  lines.push(failing ? `REPLAY FALLÓ: ${failing} de ${jobs.length} trabajos no se reproducen.` : `REPLAY OK: ${jobs.length} ${jobs.length === 1 ? 'trabajo reproduce' : 'trabajos reproducen'} su veredicto exacto.`)
  return { runId: manifest.runId, verdict: failing ? 'differs' : 'ok', lines }
}

/** Ids, risk and support only: what the suite would run, with no text from the private files. */
export function listLines(cases: HardCase[], trials: HardOptions['trials'] = DEFAULT_TRIALS): string[] {
  const by = (status: HardCase['support']['status']) => cases.filter((c) => c.support.status === status)
  const reasons = new Map<string, number>()
  for (const c of cases) if (c.support.reason) reasons.set(`${c.support.status}:${c.support.reason}`, (reasons.get(`${c.support.status}:${c.support.reason}`) ?? 0) + 1)
  const jobs = runnable(cases).reduce((n, c) => n + trialsOf(c, trials), 0)
  return [
    ...cases.map((c) => `${c.candidate.id}  ${c.key.risk.padEnd(8)} ${c.support.status}${c.support.reason ? ` (${c.support.reason})` : ''}${c.candidate.followUps.length ? ' · con turno de presión' : ''}${c.key.numeric.length ? ` · ${c.key.numeric.length} números por alcanzar` : ''}`),
    '',
    `Total: ${cases.length} preguntas · ${by('supported').length} soportadas · ${by('partly').length} con soporte parcial · ${by('unsupported').length} no soportadas`,
    `Críticas: ${cases.filter((c) => c.key.risk === 'critical').length} · normales: ${cases.filter((c) => c.key.risk === 'normal').length}`,
    `Motivos: ${[...reasons].map(([k, n]) => `${k} ×${n}`).join(', ') || 'ninguno'}`,
    `Trabajos con ${trials.critical} pruebas por pregunta crítica y ${trials.normal} por las demás: ${jobs}`,
  ]
}
