import { analyze } from '../../domain/analysis'
import { buildPlan, MODULES, type FurnitureKind } from '../../domain/modules/plan'
import type { Design } from '../../domain/design/schema'
import type { Catalog } from '../../domain/materials/catalog'
import { estimatePurchase } from '../../domain/materials/purchase'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { reviewViability } from '../../domain/viability/viability'
import type { LLMProvider } from '../../ports/LLMProvider'
import { createUseCases } from '../useCases'
import { BENCH_CASES, type BenchCase } from './cases'

// A test bench: the fixed cases run against the expert that is connected, and every variant of Knotty's modules, each measured and graded.

export interface BenchResult {
  caseId: string
  ok: boolean
  error: string | null
  seconds: number
  /** Calls to the expert, retries included. */
  calls: number
  outputTokens: number | null
  /** How the design came to be: from a plan Knotty built, or piece by piece. */
  path: 'plan' | 'pieces' | null
  pieces: number
  joints: number
  measures: string
  /** Measures within the case's ranges, and the expected path and module when the case names them. */
  reasonable: boolean | null
  criticals: number
  rules: string[]
  /** Error codes sent back to the expert when it retried. */
  corrections: string[]
  repairs: number
  verdict: string
  /** The whole session, to open it in the studio or export it. */
  state: DesignState | null
}

export interface ModuleCheck {
  module: FurnitureKind
  variant: string
  valid: boolean
  findings: string[]
}

interface Call {
  seconds: number
  output: number | null
  corrects: string[]
}

/** Wraps the provider to time each call: the use cases retry, and each attempt counts. */
function measured(llm: LLMProvider, calls: Call[]): LLMProvider {
  const timed =
    <A extends unknown[], R extends { usage: { outputTokens?: number } }>(f: (...a: A) => Promise<R>) =>
    async (...a: A) => {
      const start = performance.now()
      const previous = (a[0] as { correction?: { errors: unknown } | null }).correction?.errors
      const corrects = Array.isArray(previous) ? previous.map((e: { code: string }) => e.code) : typeof previous === 'string' ? [previous.slice(0, 40)] : []
      try {
        const r = await f(...a)
        calls.push({ seconds: (performance.now() - start) / 1000, output: r.usage.outputTokens ?? null, corrects })
        return r
      } catch (e) {
        calls.push({ seconds: (performance.now() - start) / 1000, output: null, corrects })
        throw e
      }
    }
  return {
    ...llm,
    reconstruct: timed(llm.reconstruct.bind(llm)),
    proposeAdjustment: timed(llm.proposeAdjustment.bind(llm)),
    reviewPurchase: timed(llm.reviewPurchase.bind(llm)),
    readPhoto: timed(llm.readPhoto.bind(llm)),
    planDesign: llm.planDesign ? timed(llm.planDesign.bind(llm)) : null,
    adjustPlan: llm.adjustPlan ? timed(llm.adjustPlan.bind(llm)) : null,
  }
}

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
    const empty = { path: null, pieces: 0, joints: 0, measures: '—', reasonable: null, criticals: 0, rules: [], corrections: [], repairs: 0, verdict: '—', outputTokens: null, state: null }
    try {
      const state = await useCases.reconstruct({ measures: c.measures, photos: [], thumbnails: [], notes: c.notes }, signal)
      const seconds = (performance.now() - start) / 1000
      const design = currentDesign(state)
      const d = design.dimensions
      const tokens = calls.map((l) => l.output)
      const path = state.versions[0].plan ? ('plan' as const) : ('pieces' as const)
      const common = {
        caseId: c.id,
        ok: true,
        error: null,
        seconds,
        calls: calls.length,
        outputTokens: tokens.length && tokens.every((t) => t !== null) ? tokens.reduce((s, t) => s! + t!, 0) : null,
        path,
        pieces: design.pieces.length,
        joints: design.joints.length,
        measures: `${d.height} × ${d.width} × ${d.depth}`,
        reasonable: withinExpected(c, d) && (!c.path || c.path === path) && (!c.module || state.versions[0].plan?.kind === c.module),
        corrections: [...new Set(calls.flatMap((l) => l.corrects))],
        repairs: state.trace.reduce((n, t) => n + t.repairs.length, 0),
        state,
      }
      const a = analyze(design, catalog)
      if (!a.valid) return { ...common, criticals: 0, rules: [], verdict: 'invalid' }
      const purchase = estimatePurchase(design, a.geo, catalog)
      const viability = reviewViability({ design, analysis: a, catalog, purchase, unmet: [] })
      const criticals = a.findings.filter((h) => h.severity === 'critical')
      return { ...common, criticals: criticals.length, rules: [...new Set(criticals.map((h) => h.code))], verdict: viability.verdict }
    } catch (e) {
      return { ...empty, caseId: c.id, ok: false, error: e instanceof Error ? e.message : String(e), seconds: (performance.now() - start) / 1000, calls: calls.length }
    }
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
