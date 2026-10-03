import type { Dimensions } from '../../domain/design/schema'
import { BENCH_CASES, type BenchCase } from './cases'
import type { StepResult } from './grading'
import type { KnownFailure } from './knownFailures'
import { compatibility, type Classification, type Compatibility, type ManifestIdentity } from './manifest'
import { problemsOf, type ReportRow } from './report'
import { ALPHA, fisherP } from './significance'

/** A case result as the report keeps it, with or without the model and prompt columns. */
export type GradedResult = Omit<ReportRow, 'model' | 'prompt'>

// Messages the app raises itself (adapters/llm/common/errors.ts, compatibleOpenAI.ts) plus raw network failures.
const INFRASTRUCTURE: [RegExp, string][] = [
  [/tardó demasiado en responder/, 'provider timeout'],
  [/tardó más de \d+ minutos/, 'client time limit'],
  [/cortó la petición a los \d+ s/, 'SheLLM or proxy time limit'],
  [/Límite de peticiones alcanzado/, 'rate limit (429)'],
  [/No se pudo conectar/, 'connection failure'],
  [/no pudo mandarle el pedido/, 'blocked request'],
  [/Error 5\d\d del proveedor/, 'provider 5xx'],
  [/^Cancelado/, 'cancelled'],
  [/Request timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|fetch failed|socket hang up|AbortError/, 'network or abort'],
]

/** The kind of provider failure the message tells, or null when it is not one. */
export const infrastructureCause = (message: string | null | undefined): string | null => (message ? (INFRASTRUCTURE.find(([pattern]) => pattern.test(message))?.[1] ?? null) : null)

interface Source {
  line: string
  key: string
  step: StepResult
}

// Worded exactly as problemsOf words them, so a line can be traced back to its expectation.
const sourcesOf = (result: GradedResult): Source[] =>
  (result.steps ?? []).flatMap((step) =>
    step.expectations.filter((e) => e.status === 'fail').map((e) => ({ line: `${step.label}: ${e.detail}${e.subject === 'proposal' ? ' (propuesta pendiente)' : ''}`, key: e.id.split(':').slice(1).join(':'), step })),
  )

const DIMENSIONS: (keyof Dimensions)[] = ['height', 'width', 'depth']

function overshootHolds(overshoot: { dimension: keyof Dimensions; max: number }, measures: string, c: BenchCase | undefined): boolean {
  const numbers = measures.match(/\d+(?:\.\d+)?/g)?.map(Number)
  if (!c || numbers?.length !== 3) return false
  const [height, width, depth] = numbers
  const orientations = [{ height, width, depth }, ...(c.anyOrientation ? [{ height, width: depth, depth: width }] : [])]
  return orientations.some((d) =>
    DIMENSIONS.every((k) => {
      const range = c.expected[k]
      if (k !== overshoot.dimension) return !range || (d[k] >= range[0] && d[k] <= range[1])
      return !!range && d[k] > range[1] && d[k] <= overshoot.max
    }),
  )
}

const CRITICAL_LINE = /^\d+ cr[ií]ticos? \(/

function covered(line: string, result: GradedResult, sources: Source[], known: KnownFailure[]): boolean {
  return known
    .filter((k) => k.caseId === result.caseId)
    .some(({ covers }) => {
      if (CRITICAL_LINE.test(line)) return !!covers.rules && result.rules.length > 0 && result.rules.every((r) => covers.rules!.includes(r))
      if (covers.lines?.some((s) => line.includes(s))) return true
      return sources
        .filter((s) => s.line === line && covers.expectations?.includes(s.key))
        .some((s) => !covers.overshoot || overshootHolds(covers.overshoot, s.step.design.measures, BENCH_CASES.find((c) => c.id === result.caseId)))
    })
}

/** `error` and `stepErrors` carry the messages the result does not keep, like a step's chat error. */
export function classifyTrial(result: GradedResult, options: { known: KnownFailure[]; error?: string; stepErrors?: string[] }): Classification {
  const problems = problemsOf(result)
  if (!problems.length) return 'pass'
  if ([result.error, options.error, ...(options.stepErrors ?? [])].some(infrastructureCause)) return 'infrastructure'
  const sources = sourcesOf(result)
  return problems.every((line) => covered(line, result, sources, options.known)) ? 'known-failure' : 'regression'
}

export interface TrialRecord {
  caseId: string
  trial: number
  result: GradedResult
  classification: Classification
  error?: string
}

/** Saved report rows as trials, numbered by order within their case. */
export const trialsOfRows = (rows: ReportRow[], known: KnownFailure[]): TrialRecord[] => {
  const seen = new Map<string, number>()
  return rows.map((result) => {
    const trial = seen.get(result.caseId) ?? 0
    seen.set(result.caseId, trial + 1)
    return { caseId: result.caseId, trial, result, classification: classifyTrial(result, { known }) }
  })
}

export type Status = 'same' | 'regression' | 'improvement' | 'known' | 'variation' | 'new' | 'retired' | 'incompatible' | 'unmeasured'

export interface Tally {
  passed: number
  counted: number
}

export interface RequirementComparison {
  /** An expectation id («1:verdict»), or «case» for the case as a whole. */
  id: string
  status: Status
  base: Tally | null
  candidate: Tally | null
  /** Fisher's exact p of the two pass counts; null when there is nothing to compare. A rate that moved with a p above the alpha is variation, not a finding. */
  p: number | null
}

/** Whether the prompts a case's calls used are the same in both runs: a control case measures the noise, an affected one the change. */
export type Exposure = 'affected' | 'control' | 'unknown'

export interface CaseComparison {
  caseId: string
  status: Status
  exposure: Exposure
  requirements: RequirementComparison[]
}

export interface RunSet {
  manifest: ManifestIdentity
  trials: TrialRecord[]
}

export interface Comparison {
  compatible: true
  cases: CaseComparison[]
  /** Trials left out of every pass rate because the provider failed. */
  infrastructure: { side: 'base' | 'candidate'; caseId: string; trial: number; error?: string }[]
  caseDiffs: Compatibility['cases']
  varies: string[]
}

export interface Incomparable {
  compatible: false
  reasons: string[]
}

type Outcome = 'pass' | 'fail'

const requirementsOf = (r: GradedResult): Map<string, Outcome> => {
  const found = new Map<string, Outcome>([['case', problemsOf(r).length ? 'fail' : 'pass']])
  for (const step of r.steps ?? []) {
    for (const e of step.expectations) {
      if (e.status === 'pass') found.set(e.id, 'pass')
      else if (e.status === 'fail' || e.mandatory) found.set(e.id, 'fail')
    }
  }
  return found
}

interface Counts {
  tally: Tally
  knownFails: number
}

function countFor(trials: TrialRecord[]): Map<string, Counts> {
  const counts = new Map<string, Counts>()
  for (const t of trials.filter((t) => t.classification !== 'infrastructure')) {
    for (const [id, outcome] of requirementsOf(t.result)) {
      const c = counts.get(id) ?? { tally: { passed: 0, counted: 0 }, knownFails: 0 }
      c.tally.counted++
      if (outcome === 'pass') c.tally.passed++
      else if (t.classification === 'known-failure') c.knownFails++
      counts.set(id, c)
    }
  }
  return counts
}

const SEVERITY: Status[] = ['incompatible', 'regression', 'known', 'variation', 'improvement', 'new', 'retired', 'unmeasured', 'same']

/** `exact` calls any extra failure beyond the tolerance a regression; `significance` only a difference its sample can tell from variation. */
export type Rule = 'exact' | 'significance'

const failed = (c: Counts) => c.tally.counted - c.tally.passed

function judge(base: Counts, candidate: Counts, tolerance: number, rule: Rule): { status: Status; p: number } {
  const p = fisherP({ failed: failed(base), counted: base.tally.counted }, { failed: failed(candidate), counted: candidate.tally.counted })
  const cFail = failed(candidate)
  if (cFail > 0 && candidate.knownFails === cFail) return { status: 'known', p }
  // Scaled to the candidate's trial count so runs with different repeats compare by rate.
  const extra = cFail - (failed(base) / base.tally.counted) * candidate.tally.counted
  if (Math.abs(extra) < 1e-9) return { status: 'same', p }
  if (rule === 'significance') return { status: p >= ALPHA ? 'variation' : extra > 0 ? 'regression' : 'improvement', p }
  if (extra > tolerance) return { status: 'regression', p }
  if (extra < -tolerance) return { status: 'improvement', p }
  return { status: 'variation', p }
}

const promptsOf = (trials: TrialRecord[]): string[] | null => {
  const used = trials.flatMap((t) => (t.result.callLog ?? []).map((c) => `${c.step}:${c.promptId}`))
  return used.length ? [...new Set(used)].sort() : null
}

function exposureOf(was: TrialRecord[], now: TrialRecord[]): Exposure {
  const [before, after] = [promptsOf(was), promptsOf(now)]
  if (!before || !after) return 'unknown'
  return before.join() === after.join() ? 'control' : 'affected'
}

/** Per case and requirement, how the candidate stands against the base; only for runs that are compatible. */
export function compareRuns(base: RunSet, candidate: RunSet, options: { tolerance?: number; rule?: Rule } = {}): Comparison | Incomparable {
  const tolerance = options.tolerance ?? 0
  const rule = options.rule ?? 'exact'
  const compat = compatibility(base.manifest, candidate.manifest, 'compare')
  if (!compat.compatible) return { compatible: false, reasons: compat.reasons }

  const caseIds = [...new Set([...candidate.trials, ...base.trials].map((t) => t.caseId))]
  const cases = caseIds.map((caseId): CaseComparison => {
    const mine = (run: RunSet) => run.trials.filter((t) => t.caseId === caseId)
    const [was, now] = [mine(base), mine(candidate)]
    if (compat.cases.changed.includes(caseId)) return { caseId, status: 'incompatible', exposure: 'unknown', requirements: [] }
    if (!was.length) return { caseId, status: 'new', exposure: 'unknown', requirements: [] }
    if (!now.length) return { caseId, status: 'retired', exposure: 'unknown', requirements: [] }
    const [before, after] = [countFor(was), countFor(now)]
    if (!after.size) return { caseId, status: 'unmeasured', exposure: exposureOf(was, now), requirements: [] }
    const requirements = [...after].map(([id, c]): RequirementComparison => {
      const b = before.get(id)
      const verdict = b ? judge(b, c, tolerance, rule) : null
      return { id, status: verdict?.status ?? 'new', base: b?.tally ?? null, candidate: c.tally, p: verdict?.p ?? null }
    })
    const dropped = [...before].filter(([id]) => !after.has(id)).map(([id, c]): RequirementComparison => ({ id, status: 'retired', base: c.tally, candidate: null, p: null }))
    const all = [...requirements, ...dropped]
    return { caseId, status: SEVERITY.find((s) => all.some((r) => r.status === s))!, exposure: exposureOf(was, now), requirements: all }
  })

  const infra = (side: 'base' | 'candidate', run: RunSet) =>
    run.trials.filter((t) => t.classification === 'infrastructure').map((t) => ({ side, caseId: t.caseId, trial: t.trial, error: t.error ?? t.result.error ?? undefined }))
  return { compatible: true, cases, infrastructure: [...infra('base', base), ...infra('candidate', candidate)], caseDiffs: compat.cases, varies: compat.varies }
}
