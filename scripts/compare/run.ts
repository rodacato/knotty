import { randomBytes } from 'node:crypto'
import { emptyRecording, canonicalJson, recordingProvider } from '../../src/adapters/llm/replay'
import { createBench } from '../../src/application/bench/bench'
import { classifyTrial } from '../../src/application/bench/classify'
import { GRADER_VERSION } from '../../src/application/bench/grading'
import { entropyOf, newRunId } from '../../src/application/bench/ids'
import { KNOWN_FAILURES } from '../../src/application/bench/knownFailures'
import { buildManifest, newJobs, updateJob, type Manifest } from '../../src/application/bench/manifest'
import { reportMarkdown, type Baseline, type ReportRow, type RunMeta } from '../../src/application/bench/report'
import { historyOf, orderJobs, runPool, type History } from '../../src/application/bench/schedule'
import type { Catalog } from '../../src/domain/materials/catalog'
import type { LLMProvider } from '../../src/ports/LLMProvider'
import { deterministicSeeds } from './deterministic'
import { gitIdentity, gitText, hashCases, hashCatalog, hashPrompts, hashSchemas, sha256 } from './hashing'
import { createRunStore, readManifests } from './store'
import { exitCodeOf, progressLine, runSummary, type JobOutcome } from './summary'
import type { Telemetry } from './telemetry'

// Runs the bench's cases as jobs: one directory per run, a manifest saved after every job, every expert answer recorded for replay.

/** Per provider host, until SheLLM's real limit is measured: the same 2 the bench has always used. KNOTTY_PARALLEL overrides it. */
export const DEFAULT_PARALLEL = 2
export const REQUEST_MS = 5 * 60_000
export const JOB_MS = 15 * 60_000

export interface CompareOptions {
  spec: string
  /** Host only, no credentials: it is stored in the manifest and keys the per-host limit. */
  host: string
  makeProvider: () => LLMProvider
  catalog: Catalog
  repoRoot: string
  resultsDir: string
  cases: string[] | null
  repeat: number
  label: string
  parallel: number
  baseline: Baseline | null
  telemetry: Telemetry
  signal?: AbortSignal
  out?: (text: string) => void
  /** Clock and ids that do not depend on the moment: the session is the same however many times it is built. */
  deterministic?: boolean
  clock?: () => Date
  jobMs?: number
  requestMs?: number
}

export interface CompareOutcome {
  runId: string
  dir: string
  exitCode: number
  outcomes: JobOutcome[]
  manifest: Manifest
}

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

export async function runCompare(o: CompareOptions): Promise<CompareOutcome> {
  const out = o.out ?? ((text: string) => void process.stdout.write(`${text}\n`))
  const clock = o.clock ?? (() => new Date())
  const created = clock()
  const runId = newRunId(created, entropyOf(randomBytes(4)))
  const store = createRunStore(o.resultsDir, runId)
  const catalogHash = hashCatalog(o.catalog)
  const bench = createBench({ llm: o.makeProvider, catalog: o.catalog })
  const cases = bench.cases.filter((c) => !o.cases || o.cases.includes(c.id))
  if (!cases.length) throw new Error(`No case matches KNOTTY_CASES=${o.cases?.join(',')}.`)
  const requestMs = o.requestMs ?? REQUEST_MS
  const jobMs = o.jobMs ?? JOB_MS

  const identity = gitIdentity(o.repoRoot)
  let manifest = buildManifest({
    version: 1,
    runId,
    createdAt: created.toISOString(),
    label: o.label,
    commit: identity.commit,
    state: { dirty: identity.dirty, stateHash: identity.stateHash },
    hashes: { cases: hashCases(cases), graderVersion: GRADER_VERSION, prompts: hashPrompts(o.repoRoot), schemas: hashSchemas(o.repoRoot), catalog: catalogHash, corpus: null },
    provider: { spec: o.spec, host: o.host, requestedModel: o.spec.split(':').slice(1).join(':') || null, effectiveModels: [] },
    config: { repeat: o.repeat, concurrency: { default: o.parallel, perHost: { [o.host]: o.parallel } }, casesFilter: o.cases, timeouts: { requestMs, jobMs } },
    jobs: newJobs(runId, cases.map((c) => c.id), o.repeat),
  })
  const save = (next: Manifest) => {
    manifest = next
    store.writeManifest(manifest)
  }
  save(manifest)

  const meta: RunMeta = { label: o.label, commit: identity.commit.slice(0, 7), date: manifest.createdAt, checkout: checkoutNote(o.repoRoot) }
  out([`Corrida ${runId} · ${manifest.jobs.length} ${manifest.jobs.length === 1 ? 'trabajo' : 'trabajos'} · ${o.spec} · ${o.parallel} a la vez por host · base: ${o.baseline ? `«${o.baseline.label}» (${o.baseline.commit})` : 'ninguna'} · carpeta: ${store.dir}`, ...(meta.checkout ? [`⚠ ${meta.checkout}`] : [])].join('\n'))

  const outcomes = new Map<string, JobOutcome>()
  const rowsInPlan = () => manifest.jobs.flatMap((j) => outcomes.get(j.jobId)?.row ?? [])
  const writeReport = () => store.writeReport(reportMarkdown(rowsInPlan(), meta, o.baseline, manifest.jobs.length))

  const caseOf = new Map(cases.map((c) => [c.id, c]))
  const poolStart = performance.now()

  const runJob = async (job: { jobId: string; caseId: string; trial: number }, signal: AbortSignal | undefined): Promise<void> => {
    const queuedMs = Math.round(performance.now() - poolStart)
    const startedAt = clock().toISOString()
    save(updateJob(manifest, job.jobId, { status: 'running', startedAt }))
    const recording = emptyRecording(catalogHash)
    const provider = recordingProvider(o.telemetry.provider(o.makeProvider(), job.jobId), recording, { catalogStamp: catalogHash })
    const seeds = o.deterministic ? deterministicSeeds() : {}
    const jobBench = createBench({ llm: () => provider, catalog: o.catalog, ...seeds })
    const aborts = [AbortSignal.timeout(jobMs), ...(signal ? [signal] : [])]
    const started = performance.now()
    const { state, ...result } = await jobBench.runCase(caseOf.get(job.caseId)!, AbortSignal.any(aborts))
    if (signal?.aborted) throw abortError()

    const row: ReportRow = { ...result, model: o.spec, prompt: state?.versions[0].origin?.promptId ?? null }
    const stepErrors = (state?.chat ?? []).filter((m) => m.error && m.failure !== 'rejection').map((m) => m.text)
    const classification = classifyTrial(result, { known: KNOWN_FAILURES, stepErrors })
    const requests = await o.telemetry.take(job.jobId)
    const stateHash = state ? sha256(canonicalJson(state)) : null

    store.writeRecording(job.jobId, recording)
    store.writeTelemetry(job.jobId, requests)
    if (state) store.writeDesign(job.jobId, state)
    store.writeJob(job.jobId, { jobId: job.jobId, runId, caseId: job.caseId, trial: job.trial, spec: o.spec, graderVersion: GRADER_VERSION, classification, stepErrors, stateHash, queuedMs, row })

    const outcome: JobOutcome = { ...job, status: 'done', classification, row, seconds: (performance.now() - started) / 1000, queuedMs }
    outcomes.set(job.jobId, outcome)
    save({
      ...updateJob(manifest, job.jobId, { status: 'done', outcome: classification, endedAt: clock().toISOString(), file: `jobs/${job.jobId}.json`, queuedMs }),
      provider: { ...manifest.provider, effectiveModels: o.telemetry.effectiveModels() },
    })
    writeReport()
    out(progressLine(outcome))
  }

  const ordered = orderJobs(manifest.jobs, historyFor(o.resultsDir, o.baseline)).map((j) => ({ ...j, host: o.host }))
  const wallStart = performance.now()
  const pooled = await runPool(ordered, (job, signal) => runJob(job, signal), { limits: manifest.config.concurrency, now: () => performance.now(), signal: o.signal })
  const wallMs = performance.now() - wallStart

  for (const p of pooled) {
    const { jobId: id, caseId, trial } = p.job
    if (p.status === 'cancelled') save(updateJob(manifest, id, { status: 'cancelled', endedAt: clock().toISOString() }))
    if (p.status === 'failed') save(updateJob(manifest, id, { status: 'failed', endedAt: clock().toISOString(), queuedMs: Math.round(p.queuedMs) }))
    if (p.status !== 'done') outcomes.set(id, { jobId: id, caseId, trial, status: p.status, error: p.error instanceof Error ? p.error.message : p.error ? String(p.error) : undefined, seconds: 0, queuedMs: Math.round(p.queuedMs) })
  }
  const ordering = manifest.jobs.map((j) => outcomes.get(j.jobId)!)
  writeReport()
  out(`\n${runSummary({ runId, label: o.label, spec: o.spec, outcomes: ordering, wallMs, resultsPath: `${store.dir}/report.md` })}`)
  return { runId, dir: store.dir, exitCode: exitCodeOf(ordering), outcomes: ordering, manifest }
}
