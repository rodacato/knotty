import { randomBytes } from 'node:crypto'
import { emptyRecording, canonicalJson, recordingProvider } from '../../src/adapters/llm/replay'
import { standingAgainst } from '../../src/application/bench/against'
import { createBench } from '../../src/application/bench/bench'
import type { BenchCase } from '../../src/application/bench/cases'
import { classifyTrial, type TrialRecord } from '../../src/application/bench/classify'
import { GRADER_VERSION } from '../../src/application/bench/grading'
import { entropyOf, newRunId } from '../../src/application/bench/ids'
import { KNOWN_FAILURES } from '../../src/application/bench/knownFailures'
import { buildManifest, newJobs, updateJob, type JobRecord, type Manifest, type ManifestIdentity } from '../../src/application/bench/manifest'
import { pendingJobs, type PlanMode } from '../../src/application/bench/plan'
import type { PromotedBaseline } from '../../src/application/bench/promote'
import { reportMarkdown, type Baseline, type ReportRow, type RunMeta } from '../../src/application/bench/report'
import { historyOf, orderJobs, runPool, type History } from '../../src/application/bench/schedule'
import type { Catalog } from '../../src/domain/materials/catalog'
import type { LLMProvider } from '../../src/ports/LLMProvider'
import { deterministicSeeds } from './deterministic'
import { gitIdentity, gitText, hashCases, hashCatalog, hashPrompts, hashSchemas, sha256 } from './hashing'
import { createRunStore, readManifests, type RunStore, type StoredJob } from './store'
import { attemptsLines, exitCodeOf, progressLine, runSummary, type JobOutcome } from './summary'
import type { Telemetry } from './telemetry'

// Runs the bench's cases as jobs: one directory per run, a manifest saved after every job, every expert answer recorded for replay.

/** Per provider host. SheLLM took 4 at once with no queue and no errors (2026-10-02, 50 requests); the other providers keep the 2 the bench has always used, because their limits are unmeasured. KNOTTY_PARALLEL overrides it. */
export const DEFAULT_PARALLEL = 2
export const SHELLM_PARALLEL = 4
export const defaultParallel = (spec: string) => (spec.startsWith('shellm') ? SHELLM_PARALLEL : DEFAULT_PARALLEL)
export const REQUEST_MS = 5 * 60_000
export const JOB_MS = 15 * 60_000

export interface CommonOptions {
  catalog: Catalog
  repoRoot: string
  resultsDir: string
  baseline: Baseline | PromotedBaseline | null
  telemetry: Telemetry
  signal?: AbortSignal
  out?: (text: string) => void
  /** Clock and ids that do not depend on the moment: the session is the same however many times it is built. */
  deterministic?: boolean
  clock?: () => Date
  jobMs?: number
  requestMs?: number
}

export interface CompareOptions extends CommonOptions {
  spec: string
  /** Host only, no credentials: it is stored in the manifest and keys the per-host limit. */
  host: string
  makeProvider: () => LLMProvider
  cases: string[] | null
  repeat: number
  label: string
  parallel: number
}

export interface ResumeOptions extends CommonOptions {
  runId: string
  mode: PlanMode
  makeProvider: (spec: string) => LLMProvider
}

export interface CompareOutcome {
  runId: string
  dir: string
  exitCode: number
  outcomes: JobOutcome[]
  manifest: Manifest
}

export type ResumeOutcome = ({ ok: true } & CompareOutcome) | { ok: false; reasons: string[] }

const abortError = () => Object.assign(new Error('Cancelado'), { name: 'AbortError' })

function checkoutNote(root: string): string | null {
  const count = (range: string) => Number(gitText(root, ['rev-list', '--count', range]) ?? 0)
  const behind = count('HEAD..origin/main')
  const ahead = count('origin/main..HEAD')
  const dirty = (gitText(root, ['status', '--porcelain', '--', '.', ':(exclude)scripts/compare']) ?? '').split('\n').filter(Boolean).length
  const off = [
    ...(behind ? [`${behind} ${behind === 1 ? 'commit' : 'commits'} detrás de origin/main (según el último fetch)`] : []),
    ...(ahead ? [`${ahead} ${ahead === 1 ? 'commit' : 'commits'} que no están en origin/main`] : []),
    ...(dirty ? [`cambios sin commit en ${dirty} ${dirty === 1 ? 'archivo' : 'archivos'}`] : []),
  ]
  return off.length ? `Mide un checkout que no es origin/main: ${off.join('; ')}.` : null
}

/** Durations of earlier runs; a case never run before falls back to the baseline's seconds. */
function historyFor(resultsDir: string, baseline: Baseline | null): History {
  const history = historyOf(readManifests(resultsDir))
  for (const row of baseline?.rows ?? []) if (row.ok && !history[row.caseId]?.length) (history[row.caseId] ??= []).push(row.seconds * 1000)
  return history
}

/** What this checkout would measure now: the commit, the state and the hashes of cases, grader, prompts, schemas and catalog. */
function measured(o: Pick<CommonOptions, 'repoRoot' | 'catalog'>, cases: BenchCase[]) {
  const identity = gitIdentity(o.repoRoot)
  return {
    commit: identity.commit,
    state: { dirty: identity.dirty, stateHash: identity.stateHash },
    hashes: { cases: hashCases(cases), graderVersion: GRADER_VERSION, prompts: hashPrompts(o.repoRoot), schemas: hashSchemas(o.repoRoot), catalog: hashCatalog(o.catalog), corpus: null },
  }
}

const identityOf = ({ jobs: _jobs, ...identity }: Manifest): ManifestIdentity => identity

const trialOf = (o: JobOutcome): TrialRecord[] => (o.row && o.classification ? [{ caseId: o.caseId, trial: o.trial, result: o.row, classification: o.classification, error: o.stepErrors?.join('\n') || undefined }] : [])

interface Execution extends CommonOptions {
  store: RunStore
  manifest: Manifest
  makeProvider: () => LLMProvider
  /** The jobs this process runs; the rest of the manifest is already settled. */
  toRun: JobRecord[]
  settled: JobOutcome[]
}

async function execute(o: Execution): Promise<CompareOutcome> {
  const { store, catalog, telemetry } = o
  const out = o.out ?? ((text: string) => void process.stdout.write(`${text}\n`))
  const clock = o.clock ?? (() => new Date())
  let manifest = o.manifest
  const { runId, label, provider: { spec, host }, config } = manifest
  const catalogHash = manifest.hashes.catalog
  const benchCases = createBench({ llm: o.makeProvider, catalog }).cases
  const caseOf = new Map(benchCases.map((c) => [c.id, c]))
  const jobMs = o.jobMs ?? config.timeouts.jobMs ?? JOB_MS
  const parallel = config.concurrency.perHost[host] ?? config.concurrency.default

  const save = (next: Manifest) => {
    manifest = next
    store.writeManifest(manifest)
  }
  save(manifest)

  const meta: RunMeta = { label, commit: manifest.commit.slice(0, 7), date: manifest.createdAt, checkout: checkoutNote(o.repoRoot) }
  out([`Corrida ${runId} · ${manifest.jobs.length} ${manifest.jobs.length === 1 ? 'trabajo' : 'trabajos'}${o.toRun.length < manifest.jobs.length ? ` (${o.toRun.length} por correr)` : ''} · ${spec} · ${parallel} a la vez por host · base: ${o.baseline ? `«${o.baseline.label}» (${o.baseline.commit})` : 'ninguna'} · carpeta: ${store.dir}`, ...(meta.checkout ? [`⚠ ${meta.checkout}`] : [])].join('\n'))

  const outcomes = new Map<string, JobOutcome>(o.settled.map((s) => [s.jobId, s]))
  const standing = () => (o.baseline ? standingAgainst(o.baseline, { manifest: identityOf(manifest), trials: manifest.jobs.flatMap((j) => (outcomes.has(j.jobId) ? trialOf(outcomes.get(j.jobId)!) : [])) }, { known: KNOWN_FAILURES, benchCases: benchCases.map((c) => c.id) }) : null)
  const writeReport = () => {
    const rows = manifest.jobs.flatMap((j) => outcomes.get(j.jobId)?.row ?? [])
    const lines = [...(standing()?.lines ?? [])]
    store.writeReport([reportMarkdown(rows, meta, o.baseline, manifest.jobs.length, lines), ...attemptsLines(store.listAttempts())].join('\n'))
  }

  const poolStart = performance.now()
  const runJob = async (job: { jobId: string; caseId: string; trial: number }, signal: AbortSignal | undefined): Promise<void> => {
    const queuedMs = Math.round(performance.now() - poolStart)
    const startedAt = clock().toISOString()
    save(updateJob(manifest, job.jobId, { status: 'running', startedAt }))
    const recording = emptyRecording(catalogHash)
    const provider = recordingProvider(telemetry.provider(o.makeProvider(), job.jobId), recording, { catalogStamp: catalogHash })
    const seeds = o.deterministic ? deterministicSeeds() : {}
    const jobBench = createBench({ llm: () => provider, catalog, ...seeds })
    const aborts = [AbortSignal.timeout(jobMs), ...(signal ? [signal] : [])]
    const started = performance.now()
    const { state, ...result } = await jobBench.runCase(caseOf.get(job.caseId)!, AbortSignal.any(aborts))
    if (signal?.aborted) throw abortError()

    const row: ReportRow = { ...result, model: spec, prompt: state?.versions[0].origin?.promptId ?? null }
    const stepErrors = (state?.chat ?? []).filter((m) => m.error && m.failure !== 'rejection').map((m) => m.text)
    const classification = classifyTrial(result, { known: KNOWN_FAILURES, stepErrors })
    const requests = await telemetry.take(job.jobId)
    const stateHash = state ? sha256(canonicalJson(state)) : null

    store.writeRecording(job.jobId, recording)
    store.writeTelemetry(job.jobId, requests)
    if (state) store.writeDesign(job.jobId, state)
    const stored: StoredJob = { jobId: job.jobId, runId, caseId: job.caseId, trial: job.trial, spec, graderVersion: GRADER_VERSION, classification, stepErrors, stateHash, queuedMs, row }
    store.writeJob(job.jobId, stored)

    const outcome: JobOutcome = { ...job, status: 'done', classification, row, stepErrors, seconds: (performance.now() - started) / 1000, queuedMs }
    outcomes.set(job.jobId, outcome)
    save({
      ...updateJob(manifest, job.jobId, { status: 'done', outcome: classification, endedAt: clock().toISOString(), file: `jobs/${job.jobId}.json`, queuedMs }),
      provider: { ...manifest.provider, effectiveModels: [...new Set([...manifest.provider.effectiveModels, ...telemetry.effectiveModels()])].sort() },
    })
    writeReport()
    out(progressLine(outcome))
  }

  const ordered = orderJobs(o.toRun, historyFor(o.resultsDir, o.baseline)).map((j) => ({ ...j, host }))
  const wallStart = performance.now()
  const pooled = await runPool(ordered, (job, signal) => runJob(job, signal), { limits: config.concurrency, now: () => performance.now(), signal: o.signal })
  const wallMs = performance.now() - wallStart

  for (const p of pooled) {
    const { jobId: id, caseId, trial } = p.job
    if (p.status === 'cancelled') save(updateJob(manifest, id, { status: 'cancelled', endedAt: clock().toISOString() }))
    if (p.status === 'failed') save(updateJob(manifest, id, { status: 'failed', endedAt: clock().toISOString(), queuedMs: Math.round(p.queuedMs) }))
    if (p.status !== 'done') outcomes.set(id, { jobId: id, caseId, trial, status: p.status, error: p.error instanceof Error ? p.error.message : p.error ? String(p.error) : undefined, seconds: 0, queuedMs: Math.round(p.queuedMs) })
  }
  const ordering = manifest.jobs.map((j) => outcomes.get(j.jobId)!)
  writeReport()
  const verdict = standing()
  const attempts = store.listAttempts()
  out(`\n${runSummary({ runId, label, spec, outcomes: ordering, wallMs, resultsPath: `${store.dir}/report.md`, baselineLines: verdict?.lines.filter(Boolean), attempts })}`)
  return { runId, dir: store.dir, exitCode: exitCodeOf(ordering, { baselineRegression: verdict?.regression }), outcomes: ordering, manifest }
}

export async function runCompare(o: CompareOptions): Promise<CompareOutcome> {
  const clock = o.clock ?? (() => new Date())
  const created = clock()
  const runId = newRunId(created, entropyOf(randomBytes(4)))
  const store = createRunStore(o.resultsDir, runId)
  const cases = createBench({ llm: o.makeProvider, catalog: o.catalog }).cases.filter((c) => !o.cases || o.cases.includes(c.id))
  if (!cases.length) throw new Error(`No case matches KNOTTY_CASES=${o.cases?.join(',')}.`)

  const manifest = buildManifest({
    version: 1,
    runId,
    createdAt: created.toISOString(),
    label: o.label,
    ...measured(o, cases),
    provider: { spec: o.spec, host: o.host, requestedModel: o.spec.split(':').slice(1).join(':') || null, effectiveModels: [] },
    config: { repeat: o.repeat, concurrency: { default: o.parallel, perHost: { [o.host]: o.parallel } }, casesFilter: o.cases, timeouts: { requestMs: o.requestMs ?? REQUEST_MS, jobMs: o.jobMs ?? JOB_MS } },
    jobs: newJobs(runId, cases.map((c) => c.id), o.repeat),
  })
  return execute({ ...o, store, manifest, toRun: manifest.jobs, settled: [] })
}

const settledOutcome = (store: RunStore, job: JobRecord): JobOutcome => {
  const base = { jobId: job.jobId, caseId: job.caseId, trial: job.trial, queuedMs: job.queuedMs ?? 0 }
  if (job.status === 'done' && store.hasJob(job.jobId)) {
    const saved = store.readJob(job.jobId) as StoredJob
    return { ...base, status: 'done', classification: saved.classification, row: saved.row, stepErrors: saved.stepErrors, seconds: saved.row.seconds }
  }
  if (job.status === 'failed' || job.status === 'done') return { ...base, status: 'failed', error: 'falló en una corrida anterior y no se reintentó', seconds: 0 }
  return { ...base, status: 'cancelled', seconds: 0 }
}

/** Runs only what the plan says is pending in a compatible run; each job that runs again keeps its earlier attempt whole. */
export async function resumeCompare(o: ResumeOptions): Promise<ResumeOutcome> {
  const store = createRunStore(o.resultsDir, o.runId)
  const saved = store.readManifest()
  const cases = createBench({ llm: () => o.makeProvider(saved.provider.spec), catalog: o.catalog }).cases
  const current: ManifestIdentity = { ...identityOf(saved), ...measured(o, cases) }
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
  const outcome = await execute({ ...o, store, manifest, makeProvider: () => o.makeProvider(saved.provider.spec), toRun: manifest.jobs.filter((j) => rerun.has(j.jobId)), settled })
  return { ok: true, ...outcome }
}
