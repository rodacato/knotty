import type { Classification } from '../../src/application/bench/manifest'
import { caseLine, problemsOf, type ReportRow } from '../../src/application/bench/report'

// What a finished run prints and how it exits. Pure: the orchestrator hands over what happened.

export interface JobOutcome {
  jobId: string
  caseId: string
  trial: number
  status: 'done' | 'failed' | 'cancelled'
  classification?: Classification
  row?: ReportRow
  /** Why the job could not produce a result. */
  error?: string
  seconds: number
  queuedMs: number
}

export interface RunFacts {
  runId: string
  label: string
  spec: string
  /** In the order the run planned them, not the order they finished. */
  outcomes: JobOutcome[]
  wallMs: number
  resultsPath: string
}

export const EXIT = { ok: 0, regression: 1, incomplete: 2 } as const

/** A regression wins over an incomplete run; a declared known failure alone does not fail the run. */
export function exitCodeOf(outcomes: JobOutcome[]): number {
  if (outcomes.some((o) => o.classification === 'regression')) return EXIT.regression
  if (outcomes.some((o) => o.status !== 'done' || o.classification === 'infrastructure')) return EXIT.incomplete
  return EXIT.ok
}

const LABEL: Record<Classification, string> = { pass: 'pasa', 'known-failure': 'falla conocida (sigue fallando)', regression: 'REGRESIÓN', infrastructure: 'infraestructura' }
const MARK: Record<Classification, string> = { pass: '✓', 'known-failure': '×', regression: '×', infrastructure: '!' }

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`
const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]

export function progressLine(o: JobOutcome): string {
  const name = `${o.caseId} t${o.trial}`
  if (o.status === 'cancelled') return `  - ${name} → cancelado`
  if (o.status === 'failed' || !o.row || !o.classification) return `  ! ${name} → no terminó: ${o.error ?? 'sin mensaje'}`
  return `  ${MARK[o.classification]} ${name} → ${LABEL[o.classification]} · ${caseLine(o.row)}`
}

export function runSummary(f: RunFacts): string {
  const count = (c: Classification) => f.outcomes.filter((o) => o.classification === c).length
  const unfinished = f.outcomes.filter((o) => o.status !== 'done').length
  const rows = f.outcomes.flatMap((o) => (o.row ? [{ o, row: o.row }] : []))

  const perCase = [...new Set(f.outcomes.map((o) => o.caseId))].map((id) => {
    const durations = rows.filter((r) => r.o.caseId === id).map((r) => r.row.seconds)
    return durations.length ? `${id} ${durations.map((d) => seconds(d * 1000)).join(' / ')}` : `${id} —`
  })
  const calls = rows.flatMap((r) => r.row.callLog.map((c) => c.seconds)).sort((a, b) => a - b)
  const queued = f.outcomes.map((o) => o.queuedMs)
  const corrections = [...new Set(rows.flatMap((r) => r.row.corrections))]
  const problems = f.outcomes.flatMap((o) => (o.classification && o.classification !== 'pass' && o.row ? [`  ${o.caseId} t${o.trial} (${LABEL[o.classification]})`, ...problemsOf(o.row).map((p) => `    - ${p}`)] : []))
  const failed = f.outcomes.flatMap((o) => (o.status === 'failed' ? [`  ${o.caseId} t${o.trial}: ${o.error ?? 'sin mensaje'}`] : []))

  return [
    `Corrida ${f.runId} · «${f.label}» · ${f.spec}`,
    ...f.outcomes.map(progressLine),
    '',
    `Resumen: ${count('pass')} pasan · ${count('known-failure')} fallas conocidas (siguen fallando) · ${count('regression')} regresiones · ${count('infrastructure')} de infraestructura · ${unfinished} sin terminar`,
    `Tiempo total: ${seconds(f.wallMs)} · espera en cola: máx ${seconds(Math.max(0, ...queued))}, suma ${seconds(queued.reduce((s, q) => s + q, 0))}`,
    `Por escenario: ${perCase.join(' · ')}`,
    calls.length ? `Llamadas al experto: ${calls.length} · mediana ${seconds(quantile(calls, 0.5) * 1000)} · p95 ${seconds(quantile(calls, 0.95) * 1000)} · máx ${seconds(calls.at(-1)! * 1000)}` : 'Llamadas al experto: ninguna',
    `Correcciones: ${corrections.length ? corrections.join(' ') : 'ninguna'} · casos con error: ${rows.filter((r) => !r.row.ok).length}`,
    ...(problems.length ? ['', 'Lo que no cuadró:', ...problems] : []),
    ...(failed.length ? ['', 'Trabajos sin resultado:', ...failed] : []),
    '',
    `Reporte: ${f.resultsPath}`,
  ].join('\n')
}
