import type { Design } from './design/schema'
import { resolveGeometry, type Geometry } from './design/resolve'
import type { Finding } from './structure/finding'
import { reviewStructure } from './structure/review'
import type { Catalog } from './materials/catalog'
import { checkRequirements, type Requirement } from './requirements/requirements'
import type { Contact } from './validation/contact'
import type { DesignWarning, DesignError } from './validation/errors'
import { validateGeometry } from './validation/geometry'

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
