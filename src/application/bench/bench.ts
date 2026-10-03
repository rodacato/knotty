import { analyze } from '../../domain/checks/analysis'
import { buildPlan, MODULES, type FurnitureKind, type FurniturePlan } from '../../domain/furniture/modules/plan'
import type { Design } from '../../domain/design/schema'
import type { Catalog } from '../../domain/materials/catalog'
import { currentVersion, type DesignState } from '../../domain/session/state'
import type { LLMProvider } from '../../ports/LLMProvider'
import { createUseCases } from '../useCases'
import { BENCH_CASES, type BenchCase, type Part } from './cases'
import { countParts, GRADER_VERSION, gradeStep, outcomeOf, reasonableOf, scenarioOf, type DesignGrade, type Scenario, type StepResult } from './grading'

export { countParts }

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
  /** The final measures within the case's ranges, and the expected path and module when the case names them. */
  reasonable: boolean | null
  /** The doors, drawers and open openings the case asks for against the final design's; null when the case does not name exact counts. */
  structure: Structure | null
  /** Criticals, rules and verdict of the final design, after every request. */
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
  /** Each step graded on the state it left, with its expectations; absent in rows saved before the grader had steps. */
  steps?: StepResult[]
  /** The first design graded on its own, before any request. */
  reconstruction?: Reconstruction | null
  graderVersion?: string
}

export type Reconstruction = DesignGrade & { reasonable: boolean | null; structure: Structure | null }

export interface Adjustment {
  request: string
  by: 'knotty' | 'expert'
  /** Calls to the expert this request made; 0 when Knotty answered alone. */
  calls: number
  outcome: 'version' | 'proposal' | 'answer' | 'error'
}

const LEGACY_OUTCOME: Record<StepResult['outcome'], Adjustment['outcome']> = { applied: 'version', pending: 'proposal', answer: 'answer', rejected: 'error', error: 'error' }

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

/** The exact counts a step asks for; ranges are expectations of their own and are not part of the structure. */
const exactParts = (scenario: Scenario, step: number): Structure['expected'] =>
  Object.fromEntries(scenario.steps[step].expect.flatMap((e) => (e.kind === 'parts' && typeof e.count === 'number' && !e.unsupported ? [[e.part, e.count] as const] : [])))

function structureOf(expected: Structure['expected'], design: Design, plan: FurniturePlan | null): Structure | null {
  const asked = Object.entries(expected) as [Part, number][]
  if (!asked.length) return null
  const found = countParts(design, plan)
  const ok = asked.some(([part, n]) => found[part] !== null && found[part] !== n) ? false : asked.some(([part]) => found[part] === null) ? null : true
  return { expected, found, ok }
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
  /** The geometry warnings: they do not fail the bench, the bench drawer lists them. */
  warnings: string[]
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
  /** The lowest input reported: a provider that adds a prompt of its own only some of the time (SheLLM's CLI) inflates the average. */
  minInput: number | null
  output: number | null
  seconds: number
}

const average = (xs: (number | null)[]) => {
  const known = xs.filter((x): x is number => x !== null)
  return known.length ? known.reduce((s, x) => s + x, 0) / known.length : null
}

const lowest = (xs: (number | null)[]) => {
  const known = xs.filter((x): x is number => x !== null)
  return known.length ? Math.min(...known) : null
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
    minInput: lowest(group.map((c) => c.input)),
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

/** The case's requests one after the other, each graded on the state it left; the design's own calls stay out of the count. */
async function adjustAll(p: {
  useCases: ReturnType<typeof createUseCases>
  state: DesignState
  scenario: Scenario
  first: StepResult
  calls: Call[]
  signal: AbortSignal
  grade: (index: number, before: DesignState, after: DesignState, outcome: StepResult['outcome'], previous: StepResult) => StepResult
}) {
  const adjustments: Adjustment[] = []
  const steps = [p.first]
  let state = p.state
  for (const [i, spec] of p.scenario.steps.slice(1).entries()) {
    const before = state
    const made = p.calls.length
    state = await p.useCases.adjust(state, spec.request!, p.signal)
    const outcome = outcomeOf(before, state)
    adjustments.push({ request: spec.request!, by: p.calls.length - made ? 'expert' : 'knotty', calls: p.calls.length - made, outcome: LEGACY_OUTCOME[outcome] })
    steps.push(p.grade(i + 1, before, state, outcome, steps.at(-1)!))
  }
  return { adjustments, steps, state }
}

const record = ({ step, promptId, seconds, input, output }: Call): CallRecord => ({ step, promptId, seconds, input, output })

/** Kept in memory: a bench run never touches the design the person is working on. */
const inMemory = () => {
  let state: DesignState | null = null
  return { load: () => state, save: (x: DesignState) => void (state = x), clear: () => void (state = null) }
}

export function createBench(deps: { llm: () => LLMProvider; catalog: Catalog; now?: () => string; newId?: () => string }) {
  const { catalog } = deps

  async function runCase(c: BenchCase, signal: AbortSignal): Promise<BenchResult> {
    const calls: Call[] = []
    const provider = deps.llm()
    const useCases = createUseCases({ llm: () => measured(provider, calls), catalog: catalog, repository: inMemory(), now: deps.now, newId: deps.newId })
    const start = performance.now()
    const empty = { callLog: [], inputTokens: null, adjustments: [], path: null, pieces: 0, joints: 0, measures: '—', reasonable: null, structure: null, criticals: 0, rules: [], corrections: [], repairs: 0, verdict: '—', outputTokens: null, state: null, steps: [], reconstruction: null, graderVersion: GRADER_VERSION }
    try {
      const scenario = scenarioOf(c)
      const initial = await useCases.reconstruct({ measures: c.measures, photos: [], thumbnails: [], notes: c.notes }, signal)
      const seconds = (performance.now() - start) / 1000
      const total = (of: (c: Call) => number | null) => {
        const values = calls.map(of)
        return values.length && values.every((t) => t !== null) ? values.reduce((s, t) => s! + t!, 0) : null
      }
      const path = initial.versions[0].plan ? ('plan' as const) : ('pieces' as const)
      const grade = (index: number, before: DesignState | null, after: DesignState, outcome: StepResult['outcome'], previous: StepResult | null) =>
        gradeStep({ catalog, spec: scenario.steps[index], index, before, after, outcome, previous })
      const first = grade(0, null, initial, 'applied', null)
      const firstVersion = initial.versions[0]
      const reconstruction: Reconstruction = { ...first.design, reasonable: reasonableOf([first]), structure: structureOf(exactParts(scenario, 0), firstVersion.design, firstVersion.plan ?? null) }
      const designCalls = {
        calls: calls.length,
        outputTokens: total((c) => c.output),
        inputTokens: total((c) => c.input),
        corrections: [...new Set(calls.flatMap((l) => l.corrects))],
        repairs: initial.trace.reduce((n, t) => n + t.repairs.length, 0),
      }
      const adjusted = await adjustAll({ useCases, state: initial, scenario, first, calls, signal, grade })
      const last = adjusted.steps.at(-1)!
      const finalVersion = currentVersion(adjusted.state)
      return {
        caseId: c.id,
        ok: true,
        error: null,
        seconds,
        ...designCalls,
        path,
        pieces: last.design.pieces,
        joints: last.design.joints,
        measures: last.design.measures,
        reasonable: reasonableOf(adjusted.steps),
        structure: structureOf(exactParts(scenario, scenario.steps.length - 1), finalVersion.design, finalVersion.plan ?? null),
        criticals: last.design.criticals,
        rules: last.design.rules,
        verdict: last.design.verdict,
        adjustments: adjusted.adjustments,
        state: adjusted.state,
        steps: adjusted.steps,
        reconstruction,
        graderVersion: GRADER_VERSION,
        callLog: calls.map(record),
      }
    } catch (e) {
      return { ...empty, caseId: c.id, ok: false, error: e instanceof Error ? e.message : String(e), seconds: (performance.now() - start) / 1000, calls: calls.length, callLog: calls.map(record) }
    }
  }

  /** Every variant of every module, as the plan the bench builds it from. */
  const variants = () => Object.values(MODULES).flatMap((module) => module.benchVariants().map(([variant, plan]) => ({ module: module.kind, variant, plan: plan as FurniturePlan })))

  /** Every variant of the modules, with no expert: any that comes out invalid or with findings is a bug in Knotty. */
  function runModules(): ModuleCheck[] {
    return variants().map(({ module, variant, plan }) => {
      const a = analyze(buildPlan(plan, catalog).design, catalog)
      return { module, variant, valid: a.valid, findings: a.valid ? a.findings.map((h) => `${h.severity}: ${h.message}`) : a.errors.map((e) => e.message), warnings: a.valid ? a.warnings.map((w) => w.message) : [] }
    })
  }

  return { cases: BENCH_CASES, runCase, runModules, variants }
}

export type Bench = ReturnType<typeof createBench>
