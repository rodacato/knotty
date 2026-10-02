import { infrastructureCause } from './classify'
import type { Manifest } from './manifest'
import type { ReportRow } from './report'

// The same battery at several concurrency levels, side by side: what each level cost in time, errors and tokens.

/** Above this level a run needs an explicit acknowledgement; above MAX_LEVEL it is refused outright. */
export const FREE_LEVEL = 4
export const MAX_LEVEL = 6

export interface JobDetail {
  row?: Pick<ReportRow, 'error' | 'corrections' | 'inputTokens' | 'outputTokens'>
  stepErrors: string[]
  requests: { status: number; responseModel: string | null; headersAllowlisted: Record<string, string> }[]
}

export interface LevelInput {
  level: number
  manifest: Pick<Manifest, 'jobs'>
  /** By job id; a job that never produced files has none. */
  details: Record<string, JobDetail>
}

export type LevelsCheck = { ok: true; levels: number[] } | { ok: false; error: string }

/** «2,4,6» into levels; 5 and 6 need `allowHigh`, and nothing above 6 is allowed. */
export function parseLevels(text: string, allowHigh: boolean): LevelsCheck {
  const levels = text.split(',').map((x) => x.trim()).filter(Boolean).map(Number)
  if (!levels.length || levels.some((l) => !Number.isInteger(l) || l < 1)) return { ok: false, error: `Niveles de concurrencia inválidos: «${text}». Usa enteros separados por coma, por ejemplo 2,4.` }
  if (new Set(levels).size !== levels.length) return { ok: false, error: `Niveles repetidos: «${text}».` }
  const tooHigh = levels.find((l) => l > MAX_LEVEL)
  if (tooHigh) return { ok: false, error: `El nivel ${tooHigh} se rechaza: el máximo que se mide es ${MAX_LEVEL}.` }
  if (levels.some((l) => l > FREE_LEVEL) && !allowHigh) return { ok: false, error: `Los niveles arriba de ${FREE_LEVEL} piden confirmar a propósito con --allow-6: pueden toparse con el límite real del proveedor y cuestan tokens.` }
  return { ok: true, levels }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
const quantile = (xs: number[], q: number) => {
  const sorted = [...xs].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null
}
const median = (xs: number[]) => {
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return !sorted.length ? null : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const sec = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`)
const count = (n: number) => String(n)

export interface LevelStats {
  level: number
  jobs: number
  done: number
  wallMs: number | null
  meanMs: number | null
  medianMs: number | null
  p95Ms: number | null
  queueMeanMs: number | null
  queueMaxMs: number | null
  infrastructure: Record<string, number>
  corrections: number
  inputTokens: number
  outputTokens: number
  models: string[]
  headers: string[]
}

export function statsOf(input: LevelInput): LevelStats {
  const { jobs } = input.manifest
  const timed = jobs.flatMap((j) => (j.startedAt && j.endedAt ? [{ start: Date.parse(j.startedAt), end: Date.parse(j.endedAt) }] : []))
  const durations = jobs.filter((j) => j.status === 'done').flatMap((j) => (j.startedAt && j.endedAt ? [Date.parse(j.endedAt) - Date.parse(j.startedAt)] : []))
  const queued = jobs.flatMap((j) => (j.queuedMs === undefined ? [] : [j.queuedMs]))
  const details = jobs.flatMap((j) => input.details[j.jobId] ?? [])

  const infrastructure: Record<string, number> = {}
  const tally = (kind: string) => void (infrastructure[kind] = (infrastructure[kind] ?? 0) + 1)
  for (const j of jobs) {
    const d = input.details[j.jobId]
    const kind = [d?.row?.error, ...(d?.stepErrors ?? [])].map(infrastructureCause).find(Boolean)
    if (kind) tally(kind)
    else if (j.outcome === 'infrastructure' || j.status === 'failed') tally('sin mensaje del proveedor')
  }
  for (const r of details.flatMap((d) => d.requests)) {
    if (r.status === 429) tally('HTTP 429 en una petición')
    else if (r.status >= 500) tally(`HTTP ${r.status} en una petición`)
  }

  return {
    level: input.level,
    jobs: jobs.length,
    done: jobs.filter((j) => j.status === 'done').length,
    wallMs: timed.length ? Math.max(...timed.map((t) => t.end)) - Math.min(...timed.map((t) => t.start)) : null,
    meanMs: mean(durations),
    medianMs: median(durations),
    p95Ms: quantile(durations, 0.95),
    queueMeanMs: mean(queued),
    queueMaxMs: queued.length ? Math.max(...queued) : null,
    infrastructure,
    corrections: details.reduce((s, d) => s + (d.row?.corrections.length ?? 0), 0),
    inputTokens: details.reduce((s, d) => s + (d.row?.inputTokens ?? 0), 0),
    outputTokens: details.reduce((s, d) => s + (d.row?.outputTokens ?? 0), 0),
    models: [...new Set(details.flatMap((d) => d.requests.flatMap((r) => (r.responseModel ? [r.responseModel] : []))))].sort(),
    headers: [...new Set(details.flatMap((d) => d.requests.flatMap((r) => Object.keys(r.headersAllowlisted))))].sort(),
  }
}

/** One column per level, in the order given. */
export function concurrencyTable(inputs: LevelInput[]): string[] {
  const stats = inputs.map(statsOf)
  const kinds = (s: LevelStats) => {
    const entries = Object.entries(s.infrastructure)
    return entries.length ? `${entries.reduce((n, [, c]) => n + c, 0)}: ${entries.map(([k, c]) => `${k} ×${c}`).join(', ')}` : '0'
  }
  const rows: [string, (s: LevelStats) => string][] = [
    ['Trabajos terminados', (s) => `${s.done}/${s.jobs}`],
    ['Tiempo total', (s) => sec(s.wallMs)],
    ['Escenario: promedio', (s) => sec(s.meanMs)],
    ['Escenario: mediana', (s) => sec(s.medianMs)],
    ['Escenario: p95', (s) => sec(s.p95Ms)],
    ['Espera en cola: promedio', (s) => sec(s.queueMeanMs)],
    ['Espera en cola: máx.', (s) => sec(s.queueMaxMs)],
    ['Errores de infraestructura', kinds],
    ['Correcciones', (s) => count(s.corrections)],
    ['Tokens de entrada', (s) => count(s.inputTokens)],
    ['Tokens de salida', (s) => count(s.outputTokens)],
    ['Modelos que respondieron', (s) => s.models.join(', ') || '—'],
    ['Cabeceras vistas', (s) => s.headers.join(', ') || 'ninguna'],
  ]
  return [`| | ${stats.map((s) => `${s.level} a la vez`).join(' | ')} |`, `|---|${stats.map(() => '---').join('|')}|`, ...rows.map(([label, cell]) => `| ${label} | ${stats.map((s) => cell(s).replace(/\|/g, '/')).join(' | ')} |`)]
}
