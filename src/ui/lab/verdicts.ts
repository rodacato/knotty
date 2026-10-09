import { analyze } from '../../domain/checks/analysis'
import { exampleDesign, type Base } from '../../domain/furniture/examples'
import type { Catalog } from '../../domain/materials/catalog'

export interface Verdict {
  valid: boolean
  /** Errors when invalid, otherwise findings and then geometry warnings. */
  notes: string[]
}

/** What Knotty finds in each base as it ships, by id: the debug tools' mark in the spotlight. */
export function verdictsOf(bases: readonly Base[], catalog: Catalog): Map<string, Verdict> {
  return new Map(
    bases.map((base) => {
      const a = analyze(exampleDesign(base, catalog).design, catalog)
      return [base.id, a.valid ? { valid: true, notes: [...a.findings.map((f) => f.message), ...a.warnings.map((w) => w.message)] } : { valid: false, notes: a.errors.map((e) => e.message) }]
    }),
  )
}
