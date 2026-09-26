import { analyze, type Analysis } from '../../domain/checks/analysis'
import type { Design } from '../../domain/design/schema'
import { normalize } from '../../domain/design/normalize'
import { completeJoints } from '../../domain/design/joints'
import type { Catalog } from '../../domain/materials/catalog'
import { applyOperations } from '../../domain/editing/operations/apply'
import type { Operation } from '../../domain/editing/operations/schema'
import { repairDesign, type Repair } from '../../domain/editing/repair/repair'
import type { Requirement } from '../../domain/checks/requirements/requirements'
import { errorKey } from '../../domain/session/trace/trace'
import type { DesignError, DesignWarning } from '../../domain/design/validation/errors'

/** The problems a design already has: a change may leave them, but must not add new ones. */
export const knownErrors = (analysis: Analysis) => new Set(analysis.valid ? [] : analysis.errors.map(errorKey))

export const newErrors = (analysis: Analysis, known: Set<string>) => (analysis.valid ? [] : analysis.errors.filter((e) => !known.has(errorKey(e))))

/** `errors` are all the problems of a refused candidate, `added` the ones it brought. */
export type Candidate =
  | { ok: true; design: Design; analysis: Analysis; repairs: Repair[]; warnings: DesignWarning[] }
  | { ok: false; errors: DesignError[]; added: DesignError[]; repairs: Repair[] }

export type Accepted = Extract<Candidate, { ok: true }>

/** Operations applied, normalized, joined (optionally repaired) and analyzed; refused if they add a problem not in `known`. */
export function tryCandidate(
  design: Design,
  operations: Operation[],
  catalog: Catalog,
  requirements: Requirement[],
  options: { known?: Set<string>; repair?: boolean } = {},
): Candidate {
  const applied = applyOperations(design, operations, catalog)
  if (!applied.ok) return { ok: false, errors: applied.errors, added: applied.errors, repairs: [] }
  const joined = completeJoints(normalize(applied.value.design, catalog), catalog, design)
  const { design: next, repairs } = options.repair ? repairDesign(joined, catalog, requirements) : { design: joined, repairs: [] }
  const analysis = analyze(next, catalog, requirements)
  const added = newErrors(analysis, options.known ?? new Set())
  if (!analysis.valid && added.length) return { ok: false, errors: analysis.errors, added, repairs }
  return { ok: true, design: next, analysis, repairs, warnings: applied.value.warnings }
}
