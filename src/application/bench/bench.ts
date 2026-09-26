import { designParts } from '../../domain/editing/intent/counts'
import { analyze } from '../../domain/checks/analysis'
import { buildPlan, MODULES, type FurnitureKind, type FurniturePlan } from '../../domain/furniture/modules/plan'
import type { Design } from '../../domain/design/schema'
import type { Catalog } from '../../domain/materials/catalog'
import { estimatePurchase } from '../../domain/materials/purchase'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { reviewViability } from '../../domain/checks/viability/viability'
import type { LLMProvider } from '../../ports/LLMProvider'
import { createUseCases } from '../useCases'
import { BENCH_CASES, type BenchCase, type Part } from './cases'

// A test bench: the fixed cases run against the expert that is connected, and every variant of Knotty's modules, each measured and graded.

export interface BenchResult {
  caseId: string
  ok: boolean
  error: string | null
  seconds: number
  /** Calls to the expert, retries included. */
  calls: number
  outputTokens: number | null
  /** What the design's calls read, prompt, schema and context together; null if a provider did not say. */
  inputTokens: number | null
  /** Every call of the case, the design's and its requests', to compare tokens by kind of call and prompt. */
  callLog: CallRecord[]
  /** How the design came to be: from a plan Knotty built, or piece by piece. */
  path: 'plan' | 'pieces' | null
  pieces: number
  joints: number
  measures: string
  /** Measures within the case's ranges, and the expected path and module when the case names them. */
  reasonable: boolean | null
  /** The doors, drawers and open openings the case asks for against the design's; null when the case does not say. */
  structure: Structure | null
  criticals: number
  rules: string[]
  /** Error codes sent back to the expert when it retried. */
  corrections: string[]
  repairs: number
  verdict: string
  /** The case's chat requests after the design: Knotty alone makes no call to the expert. */
  adjustments: Adjustment[]
  /** The whole session, after its requests, to open it in the studio or export it. */
  state: DesignState | null
}

export interface Adjustment {
  request: string
  by: 'knotty' | 'expert'
  /** Calls to the expert this request made; 0 when Knotty answered alone. */
  calls: number
  outcome: 'version' | 'proposal' | 'answer' | 'error'
}

const OUTCOME: Record<Adjustment['outcome'], string> = { version: 'versión', proposal: 'propuesta', answer: 'respuesta', error: 'error' }

/** The requests in a line for the report and the bench: «Sin zoclo» Knotty, versión · «¿Cuántas hojas?» experto (1), respuesta. */
export const describeAdjustments = (adjustments: Adjustment[]) =>
  adjustments.map((a) => `«${a.request}» ${a.by === 'knotty' ? 'Knotty' : `experto (${a.calls})`}, ${OUTCOME[a.outcome]}`).join(' · ')

export interface Structure {
  expected: Partial<Record<Part, number>>
  /** Null for what the design cannot tell: open openings are only known from a cabinet's plan. */
  found: Record<Part, number | null>
  /** False if a count differs; null if none differs but one could not be counted. */
  ok: boolean | null
}

const PART_LABEL: Record<Part, string> = { doors: 'puertas', drawers: 'cajones', open: 'abiertos' }

/** Doors and drawers by their pieces, so a design piece by piece counts too; open openings from the cells of a cabinet's plan. */
export function countParts(design: Design, plan: FurniturePlan | null): Record<Part, number | null> {
  const open = plan?.kind === 'cabinet' ? plan.columns.flatMap((c) => c.cells).filter((c) => c.content === 'open').length : null
  return { ...designParts(design), open }
}

function structureOf(c: BenchCase, design: Design, plan: FurniturePlan | null): Structure | null {
  if (!c.parts) return null
  const found = countParts(design, plan)
  const asked = Object.entries(c.parts) as [Part, number][]
  const ok = asked.some(([part, n]) => found[part] !== null && found[part] !== n) ? false : asked.some(([part]) => found[part] === null) ? null : true
  return { expected: c.parts, found, ok }
}

/** For the report and the bench: «puertas 4 (pidió 3) · cajones 3 · abiertos ? (pidió 3)». */
export const describeStructure = (s: Structure) =>
  (Object.entries(s.expected) as [Part, number][])
    .map(([part, n]) => `${PART_LABEL[part]} ${s.found[part] ?? '?'}${s.found[part] === n ? '' : ` (pidió ${n})`}`)
    .join(' · ')

export interface ModuleCheck {
  module: FurnitureKind
  variant: string
  valid: boolean
  findings: string[]
}

export type CallStep = 'skeleton' | 'pieces' | 'plan-adjust' | 'adjust' | 'review' | 'reading'

export interface CallRecord {
  step: CallStep
  promptId: string | null
  seconds: number
  input: number | null
  output: number | null
}

type Call = CallRecord & { corrects: string[] }

export interface CallSummary {
  step: CallStep
  promptId: string | null
  calls: number
  /** Averages over the calls that reported them; null when none did. */
  input: number | null
  output: number | null
  seconds: number
}

const average = (xs: (number | null)[]) => {
  const known = xs.filter((x): x is number => x !== null)
  return known.length ? known.reduce((s, x) => s + x, 0) / known.length : null
}

/** The calls grouped by kind of call and prompt, with their averages: the same prompt with and without a guide are two rows. */
export function byCallKind(calls: CallRecord[]): CallSummary[] {
  const groups = new Map<string, CallRecord[]>()
  for (const c of calls) groups.set(`${c.step} ${c.promptId}`, [...(groups.get(`${c.step} ${c.promptId}`) ?? []), c])
  return [...groups.values()].map((group) => ({
    step: group[0].step,
    promptId: group[0].promptId,
    calls: group.length,
    input: average(group.map((c) => c.input)),
    output: average(group.map((c) => c.output)),
    seconds: average(group.map((c) => c.seconds))!,
  }))
}

/** Wraps the provider to time each call: the use cases retry, and each attempt counts. */
function measured(llm: LLMProvider, calls: Call[]): LLMProvider {
  const timed =
    <A extends unknown[], R extends { usage: { inputTokens?: number; outputTokens?: number }; origin: { promptId: string } }>(step: CallStep, f: (...a: A) => Promise<R>) =>
    async (...a: A) => {
      const start = performance.now()
      const previous = (a[0] as { correction?: { errors: unknown } | null }).correction?.errors
      const corrects = Array.isArray(previous) ? previous.map((e: { code: string }) => e.code) : typeof previous === 'string' ? [previous.slice(0, 40)] : []
      const seconds = () => (performance.now() - start) / 1000
      try {
        const r = await f(...a)
        calls.push({ step, promptId: r.origin.promptId, seconds: seconds(), input: r.usage.inputTokens ?? null, output: r.usage.outputTokens ?? null, corrects })
        return r
      } catch (e) {
        calls.push({ step, promptId: null, seconds: seconds(), input: null, output: null, corrects })
        throw e
      }
    }
  return {
    ...llm,
    reconstruct: timed('pieces', llm.reconstruct.bind(llm)),
    proposeAdjustment: timed('adjust', llm.proposeAdjustment.bind(llm)),
    reviewPurchase: timed('review', llm.reviewPurchase.bind(llm)),
    readPhoto: timed('reading', llm.readPhoto.bind(llm)),
    planDesign: llm.planDesign ? timed('skeleton', llm.planDesign.bind(llm)) : null,
    adjustPlan: llm.adjustPlan ? timed('plan-adjust', llm.adjustPlan.bind(llm)) : null,
  }
}

/** The case's requests one after the other, each with the calls it made; the design's own calls stay out of the count. */
async function adjustAll(useCases: ReturnType<typeof createUseCases>, state: DesignState, requests: string[], calls: Call[], signal: AbortSignal) {
  const adjustments: Adjustment[] = []
  for (const request of requests) {
    const before = { calls: calls.length, current: state.current }
    state = await useCases.adjust(state, request, signal)
    const made = calls.length - before.calls
    const last = state.chat.at(-1)
    const outcome = last?.error ? 'error' : state.proposal ? 'proposal' : state.current !== before.current ? 'version' : 'answer'
    adjustments.push({ request, by: made ? 'expert' : 'knotty', calls: made, outcome })
  }
  return { adjustments, state }
}

const record = ({ step, promptId, seconds, input, output }: Call): CallRecord => ({ step, promptId, seconds, input, output })

/** Kept in memory: a bench run never touches the design the person is working on. */
const inMemory = () => {
  let state: DesignState | null = null
  return { load: () => state, save: (x: DesignState) => void (state = x), clear: () => void (state = null) }
}

function withinExpected(c: BenchCase, d: Design['dimensions']) {
  const inside = (m: Design['dimensions']) => Object.entries(c.expected).every(([k, [min, max]]) => m[k as keyof typeof m] >= min && m[k as keyof typeof m] <= max)
  return inside(d) || (!!c.anyOrientation && inside({ ...d, width: d.depth, depth: d.width }))
}

export function createBench(deps: { llm: () => LLMProvider; catalog: Catalog }) {
  const { catalog } = deps

  async function runCase(c: BenchCase, signal: AbortSignal): Promise<BenchResult> {
    const calls: Call[] = []
    const provider = deps.llm()
    const useCases = createUseCases({ llm: () => measured(provider, calls), catalog: catalog, repository: inMemory() })
    const start = performance.now()
    const empty = { callLog: [], inputTokens: null, adjustments: [], path: null, pieces: 0, joints: 0, measures: '—', reasonable: null, structure: null, criticals: 0, rules: [], corrections: [], repairs: 0, verdict: '—', outputTokens: null, state: null }
    try {
      const state = await useCases.reconstruct({ measures: c.measures, photos: [], thumbnails: [], notes: c.notes }, signal)
      const seconds = (performance.now() - start) / 1000
      const design = currentDesign(state)
      const d = design.dimensions
      const total = (of: (c: Call) => number | null) => {
        const values = calls.map(of)
        return values.length && values.every((t) => t !== null) ? values.reduce((s, t) => s! + t!, 0) : null
      }
      const path = state.versions[0].plan ? ('plan' as const) : ('pieces' as const)
      const common = {
        caseId: c.id,
        ok: true,
        error: null,
        seconds,
        calls: calls.length,
        outputTokens: total((c) => c.output),
        inputTokens: total((c) => c.input),
        path,
        pieces: design.pieces.length,
        joints: design.joints.length,
        measures: `${d.height} × ${d.width} × ${d.depth}`,
        reasonable: withinExpected(c, d) && (!c.path || c.path === path) && (!c.module || state.versions[0].plan?.kind === c.module),
        structure: structureOf(c, design, state.versions[0].plan ?? null),
        corrections: [...new Set(calls.flatMap((l) => l.corrects))],
        repairs: state.trace.reduce((n, t) => n + t.repairs.length, 0),
      }
      const graded = grade(design)
      const adjusted = await adjustAll(useCases, state, c.adjust ?? [], calls, signal)
      return { ...common, ...graded, ...adjusted, callLog: calls.map(record) }
    } catch (e) {
      return { ...empty, caseId: c.id, ok: false, error: e instanceof Error ? e.message : String(e), seconds: (performance.now() - start) / 1000, calls: calls.length, callLog: calls.map(record) }
    }
  }

  function grade(design: Design) {
    const a = analyze(design, catalog)
    if (!a.valid) return { criticals: 0, rules: [], verdict: 'invalid' }
    const purchase = estimatePurchase(design, a.geo, catalog)
    const viability = reviewViability({ design, analysis: a, catalog, purchase, unmet: [] })
    const criticals = a.findings.filter((h) => h.severity === 'critical')
    return { criticals: criticals.length, rules: [...new Set(criticals.map((h) => h.code))], verdict: viability.verdict }
  }

  /** Every variant of the modules, with no expert: any that comes out invalid or with findings is a bug in Knotty. */
  function runModules(): ModuleCheck[] {
    const check = (module: ModuleCheck['module'], variant: string, design: Design): ModuleCheck => {
      const a = analyze(design, catalog)
      return { module, variant, valid: a.valid, findings: a.valid ? a.findings.map((h) => `${h.severity}: ${h.message}`) : a.errors.map((e) => e.message) }
    }
    return Object.values(MODULES).flatMap((module) => module.benchVariants().map(([variant, plan]) => check(module.kind, variant, buildPlan(plan, catalog).design)))
  }

  return { cases: BENCH_CASES, runCase, runModules }
}

export type Bench = ReturnType<typeof createBench>
