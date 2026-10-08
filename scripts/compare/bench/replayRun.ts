import { firstDifference, replayProvider } from '../../../src/adapters/llm/replay'
import { BENCH_CASES } from '../../../src/application/bench/cases'
import { createBench } from '../../../src/application/bench/bench'
import { classifyTrial } from '../../../src/application/bench/classify'
import { caseFingerprint, GRADER_VERSION } from '../../../src/application/bench/grading'
import { KNOWN_FAILURES } from '../../../src/application/bench/knownFailures'
import type { ReportRow } from '../../../src/application/bench/report'
import type { Catalog } from '../../../src/domain/materials/catalog'
import { deterministicSeeds } from '../shared/deterministic'
import { hashCatalog, sha256 } from '../shared/hashing'
import type { RunStore } from '../shared/store'

// Re-runs every recorded job offline through the app, with the recorded answers, and compares the verdicts with the stored ones.

export interface JobReplay {
  jobId: string
  caseId: string
  trial: number
  /** Replay problems: a request that no longer matches the recording, an answer never asked for, a case that changed. */
  problems: string[]
  /** The first stored field the replay did not reproduce, with both values. */
  difference: string | null
}

export interface ReplayReport {
  runId: string
  verdict: 'ok' | 'differs'
  storedGrader: string
  currentGrader: string
  jobs: JobReplay[]
  lines: string[]
}

interface StoredJob {
  classification: string
  stepErrors: string[]
  graderVersion: string
  row: ReportRow
}

/** Without the timings: they are the only part of a result that is about when it ran. */
const verdictOf = (row: ReportRow, classification: string) => {
  const { seconds: _seconds, callLog, ...rest } = row
  return { ...rest, callLog: callLog.map(({ seconds: _s, ...call }) => call), classification }
}

const valueAt = (value: unknown, path: string): unknown =>
  [...path.matchAll(/\.([^.[\]]+)|\[([^\]]+)\]/g)].reduce<unknown>((at, m) => (at as Record<string, unknown> | undefined)?.[m[1] ?? m[2]], value)

const show = (value: unknown) => {
  const text = JSON.stringify(value) ?? 'undefined'
  return text.length > 160 ? `${text.slice(0, 157)}...` : text
}

export async function replayRun(store: RunStore, options: { catalog: Catalog; regrade: boolean }): Promise<ReplayReport> {
  const manifest = store.readManifest()
  const stamp = hashCatalog(options.catalog)
  const jobs: JobReplay[] = []
  const lines: string[] = []
  const catalogChanged = stamp !== manifest.hashes.catalog

  for (const job of manifest.jobs.filter((j) => j.status === 'done')) {
    const entry: JobReplay = { jobId: job.jobId, caseId: job.caseId, trial: job.trial, problems: [], difference: null }
    jobs.push(entry)
    const c = BENCH_CASES.find((x) => x.id === job.caseId)
    if (catalogChanged) entry.problems.push('the catalog changed since the run: its answers cannot be replayed against it')
    if (!c) entry.problems.push(`case ${job.caseId} no longer exists`)
    else if (sha256(caseFingerprint(c)) !== manifest.hashes.cases[job.caseId]) entry.problems.push(`case ${job.caseId} changed since the run`)
    if (!c || entry.problems.length) continue

    const stored = store.readJob(job.jobId) as StoredJob
    const replay = replayProvider(store.readRecording(job.jobId), { catalogStamp: stamp })
    const bench = createBench({ llm: () => replay, catalog: options.catalog, ...deterministicSeeds() })
    const { state, ...result } = await bench.runCase(c, new AbortController().signal)
    const row: ReportRow = { ...result, model: stored.row.model, prompt: state?.versions[0].origin?.promptId ?? null }
    const stepErrors = (state?.chat ?? []).filter((m) => m.error && m.failure !== 'rejection').map((m) => m.text)
    const classification = classifyTrial(result, { known: KNOWN_FAILURES, stepErrors })

    for (const m of replay.mismatches()) entry.problems.push(m.message)
    for (const u of replay.unused()) entry.problems.push(`recorded ${u.method} answer never asked for (${u.key})`)

    const was = verdictOf(stored.row, stored.classification)
    const now = verdictOf(row, classification)
    const at = firstDifference(was, now)
    if (at) entry.difference = `${at.replace(/^\$\.?/, '')}: stored ${show(valueAt(was, at))}, replayed ${show(valueAt(now, at))}`
  }

  const gradeDiffers = manifest.hashes.graderVersion !== GRADER_VERSION
  const exact = jobs.every((j) => !j.problems.length && !j.difference)
  const clean = jobs.every((j) => !j.problems.length)
  const ok = options.regrade ? clean : exact
  lines.push(`Repetición sin conexión de ${manifest.runId}: ${jobs.length} ${jobs.length === 1 ? 'trabajo' : 'trabajos'}`)
  if (options.regrade) lines.push(`regradedFrom: ${manifest.runId}, calificador ${manifest.hashes.graderVersion} → ${GRADER_VERSION}`)
  else if (gradeDiffers) lines.push(`aviso: la corrida se calificó con el calificador ${manifest.hashes.graderVersion} y el actual es ${GRADER_VERSION}; con --regrade se ven las diferencias sin fallar.`)
  for (const j of jobs) {
    const mark = j.problems.length ? '×' : j.difference ? (options.regrade ? '~' : '×') : '✓'
    lines.push(`  ${mark} ${j.caseId} t${j.trial}`, ...j.problems.map((p) => `      problema: ${p}`), ...(j.difference ? [`      primera diferencia en ${j.difference}`] : []))
  }
  lines.push(
    ok
      ? options.regrade
        ? `REGRADE LISTO: ${jobs.filter((j) => j.difference).length} de ${jobs.length} trabajos cambian de calificación (provenance regradedFrom ${manifest.runId}).`
        : `REPLAY OK: ${jobs.length} ${jobs.length === 1 ? 'trabajo reproduce' : 'trabajos reproducen'} su veredicto exacto.`
      : `REPLAY FALLÓ: ${jobs.filter((j) => j.problems.length || (!options.regrade && j.difference)).length} de ${jobs.length} trabajos no se reproducen.`,
  )
  return { runId: manifest.runId, verdict: ok ? 'ok' : 'differs', storedGrader: manifest.hashes.graderVersion, currentGrader: GRADER_VERSION, jobs, lines }
}
