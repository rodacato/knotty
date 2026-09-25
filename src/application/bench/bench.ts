import { analyze } from '../../domain/analysis'
import { buildBed, type BedPlan } from '../../domain/modules/bed'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetPlan } from '../../domain/modules/cabinet'
import { buildTable, type TablePlan } from '../../domain/modules/table'
import type { Design } from '../../domain/diseno/schema'
import type { Catalog } from '../../domain/materiales/catalog'
import { estimatePurchase } from '../../domain/materiales/purchase'
import { currentDesign, type DesignState } from '../../domain/sesion/state'
import { reviewViability } from '../../domain/viabilidad/viability'
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
  /** How the design came to be: from a ficha Knotty built, or piece by piece. */
  path: 'ficha' | 'pieces' | null
  pieces: number
  joints: number
  measures: string
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
  module: 'cama' | 'mesa' | 'gabinete'
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

export function withinExpected(c: BenchCase, d: Design['dimensions']) {
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
      const common = {
        caseId: c.id,
        ok: true,
        error: null,
        seconds,
        calls: calls.length,
        outputTokens: tokens.length && tokens.every((t) => t !== null) ? tokens.reduce((s, t) => s! + t!, 0) : null,
        path: state.versions[0].plan ? ('ficha' as const) : ('pieces' as const),
        pieces: design.pieces.length,
        joints: design.joints.length,
        measures: `${d.height} × ${d.width} × ${d.depth}`,
        reasonable: withinExpected(c, d),
        corrections: [...new Set(calls.flatMap((l) => l.corrects))],
        repairs: state.trace.reduce((n, t) => n + t.repairs.length, 0),
        state,
      }
      const a = analyze(design, catalog)
      if (!a.valid) return { ...common, criticals: 0, rules: [], verdict: 'inválido' }
      const purchase = estimatePurchase(design, a.geo, catalog)
      const viability = reviewViability({ design, geo: a.geo, catalog, purchase, findings: a.findings, unmet: [] })
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
    const results: ModuleCheck[] = []
    for (const mattress of ['individual', 'matrimonial', 'queen', 'king'] as const)
      for (const style of ['none', 'plain', 'bookcase', 'storage'] as const)
        for (const side of ['none', 'left', 'right', 'both'] as const)
          for (const position of ['head', 'center', 'foot'] as const) {
            if (side === 'none' && position !== 'head') continue
            const plan: BedPlan = { kind: 'bed', name: 'Cama', mattress, material: 'T18', height: 400, drawers: { side, count: side === 'none' ? 0 : 3, position }, headboard: { style, height: 1100, depth: 250, shelves: 2 } }
            results.push(check('cama', `${mattress}, cabecera ${style}, cajones ${side} hacia ${position}`, buildBed(plan, catalog).design))
          }
    const table = (use: TablePlan['use'], name: string, dimensions: TablePlan['dimensions'], extra: Partial<TablePlan> = {}): TablePlan => ({ kind: 'table', use, name, material: 'T18', dimensions, overhang: 0, shelf: false, pedestal: { side: 'none', drawers: 0 }, ...extra })
    const tables: [string, TablePlan][] = [
      ['comedor', table('dining', 'Mesa de comedor', { width: 1500, height: 750, depth: 900 }, { overhang: 50 })],
      ['comedor largo', table('dining', 'Mesa de comedor', { width: 1800, height: 750, depth: 900 }, { overhang: 50 })],
      ['centro', table('coffee', 'Mesa de centro', { width: 1000, height: 420, depth: 550 }, { shelf: true })],
      ['lateral', table('side', 'Mesa lateral', { width: 500, height: 550, depth: 400 }, { shelf: true })],
      ['escritorio', table('desk', 'Escritorio', { width: 1200, height: 750, depth: 600 })],
      ...([1, 2, 3, 4] as const).flatMap((drawers) =>
        (['left', 'right'] as const).map((side): [string, TablePlan] => [`escritorio con ${drawers} cajones a la ${side === 'left' ? 'izquierda' : 'derecha'}`, table('desk', 'Escritorio con cajonera', { width: 1300, height: 750, depth: 600 }, { pedestal: { side, drawers } })]),
      ),
    ]
    for (const [variant, plan] of tables) results.push(check('mesa', variant, buildTable(plan, catalog).design))
    const cell = (content: 'open' | 'drawer' | 'door' | 'closed', height = 1, shelves: number | null = null, doors: number | null = null) => ({ height, content, shelves, doors })
    const cabinet = (name: string, dimensions: CabinetPlan['dimensions'], columns: CabinetPlan['columns'], extra: Partial<CabinetPlan> = {}): CabinetPlan => ({ name, dimensions, material: 'T18', base: 'kick', wallMounted: true, construction: DEFAULT_CONSTRUCTION, columns, ...extra })
    const cabinets: [string, CabinetPlan][] = [
      ['librero', cabinet('Librero', { width: 600, height: 1800, depth: 300 }, [{ width: 1, cells: [cell('open', 1, 4)] }])],
      ['buró', cabinet('Buró', { width: 450, height: 550, depth: 400 }, [{ width: 1, cells: [cell('open', 0.6, 0), cell('drawer', 0.4)] }], { base: 'floor', wallMounted: false })],
      ['alacena', cabinet('Alacena', { width: 760, height: 720, depth: 320 }, [{ width: 1, cells: [cell('door', 1, 1, 2)] }], { base: 'floor' })],
      ['cajonera', cabinet('Cajonera', { width: 500, height: 900, depth: 450 }, [{ width: 1, cells: [cell('drawer'), cell('drawer'), cell('drawer')] }])],
      ['mueble de TV', cabinet('Mueble de TV', { width: 1600, height: 500, depth: 400 }, [{ width: 0.3, cells: [cell('door', 1, 0, 1)] }, { width: 0.4, cells: [cell('open', 1, 1)] }, { width: 0.3, cells: [cell('door', 1, 0, 1)] }], { wallMounted: false })],
    ]
    for (const [variant, plan] of cabinets) results.push(check('gabinete', variant, buildCabinet(plan, catalog).design))
    return results
  }

  return { cases: BENCH_CASES, runCase, runModules }
}

export type Bench = ReturnType<typeof createBench>
