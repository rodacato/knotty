import type { Bench, ModuleCheck } from '../../application/bench/bench'
import { analyze } from '../../domain/checks/analysis'
import type { Reference } from '../../domain/furniture/references'
import { buildPlan, type FurniturePlan } from '../../domain/furniture/modules/plan'
import type { Catalog } from '../../domain/materials/catalog'

// The workshop's list: every variant of every module, with what Knotty finds in it.

export type Verdict = 'ok' | 'note' | 'invalid'

export interface VariantRow {
  variant: string
  plan: FurniturePlan
  verdict: Verdict
  /** Errors when invalid, otherwise findings and then geometry warnings. */
  notes: string[]
}

export interface ModuleGroup {
  module: ModuleCheck['module']
  variants: VariantRow[]
}

const verdictOf = (c: ModuleCheck): Verdict => (!c.valid ? 'invalid' : c.findings.length || c.warnings.length ? 'note' : 'ok')

export function groupVariants(bench: Pick<Bench, 'variants' | 'runModules'>): ModuleGroup[] {
  const checks = new Map(bench.runModules().map((c) => [`${c.module}/${c.variant}`, c]))
  const groups = new Map<ModuleGroup['module'], VariantRow[]>()
  for (const { module, variant, plan } of bench.variants()) {
    const check = checks.get(`${module}/${variant}`)
    if (!check) continue
    const row: VariantRow = { variant, plan, verdict: verdictOf(check), notes: [...check.findings, ...check.warnings] }
    groups.set(module, [...(groups.get(module) ?? []), row])
  }
  return [...groups].map(([module, variants]) => ({ module, variants }))
}

export interface FichaRow {
  reference: Reference
  verdict: Verdict
  notes: string[]
}

/** Every ficha Knotty ships, built and checked as the bench checks a variant. */
export function listFichas(references: readonly Reference[], catalog: Catalog): FichaRow[] {
  return references.map((reference) => {
    const a = analyze(buildPlan(reference.plan, catalog).design, catalog)
    if (!a.valid) return { reference, verdict: 'invalid', notes: a.errors.map((e) => e.message) }
    const notes = [...a.findings.map((f) => f.message), ...a.warnings.map((w) => w.message)]
    return { reference, verdict: notes.length ? 'note' : 'ok', notes }
  })
}
