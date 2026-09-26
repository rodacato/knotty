import type { Design } from '../design/schema'
import { resolveGeometry, type Geometry } from '../design/resolve'
import type { Finding } from './structure/finding'
import { reviewStructure } from './structure/review'
import type { Catalog } from '../materials/catalog'
import { checkRequirements, type Requirement } from './requirements/requirements'
import type { Contact } from '../design/validation/contact'
import type { DesignWarning, DesignError } from '../design/validation/errors'
import { validateGeometry } from '../design/validation/geometry'

// What the design is, for every reader: errors (DesignError: not a piece of furniture yet, for the expert to fix) and warnings, or the structural findings
// (Finding: critical, recommendation, detail, shown as notices). The review before buying (viability/viability.ts) turns these into its checks without
// re-deriving them; the carpenter's high/medium/low is the model's opinion on top.

export type Analysis =
  | { valid: true; geo: Geometry; contacts: Contact[]; warnings: DesignWarning[]; findings: Finding[] }
  /** `geo` when the pieces still resolve: an invalid design can be drawn with its problems marked. */
  | { valid: false; errors: DesignError[]; geo?: Geometry }

/** All there is to know about a design before showing it: geometry, requirements and structure. */
export function analyze(design: Design, catalog: Catalog, requirements: Requirement[] = []): Analysis {
  const resolved = resolveGeometry(design, catalog)
  if (!resolved.ok) return { valid: false, errors: resolved.errors }
  const geo = resolved.value
  const { errors, warnings, contacts } = validateGeometry(design, geo, catalog)
  errors.push(...checkRequirements(design, requirements))
  if (errors.length) return { valid: false, errors, geo }
  return { valid: true, geo, contacts, warnings, findings: reviewStructure({ design, geo, catalog, contacts }) }
}
