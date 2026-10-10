import type { Design } from '../../design/schema'
import { completeJoints } from '../../design/joints'
import { normalize } from '../../design/normalize'
import type { Catalog } from '../../materials/catalog'
import { applyOperations } from '../../editing/operations/apply'
import { followChoice } from '../../editing/joints/choice'
import type { Operation } from '../../editing/operations/schema'
import { repairDesign, type Repair } from '../../editing/repair/repair'
import type { Requirement } from '../../checks/requirements/requirements'
import { buildPlan, builtAsAsked, type FurniturePlan } from './plan'

// The design is its plan plus the free-form changes made on top: rebuilding replays them, so neither the ficha nor the freedom is lost.

interface Rebuilt {
  design: Design
  notes: string[]
  /** What the plan asks for and its module left out, said for the person: a change to the plan is refused with it, and a saved one still opens. */
  missing: string | null
  /** Extras that no longer apply (they touched a piece the new plan does not have): left out, and said. */
  dropped: Operation[]
  repairs: Repair[]
}

export function rebuildFromPlan(plan: FurniturePlan, extras: Operation[], catalog: Catalog, requirements: Requirement[] = []): Rebuilt {
  const built = buildPlan(plan, catalog)
  let design = built.design
  const dropped: Operation[] = []
  for (const extra of extras) {
    const result = applyOperations(design, [extra], catalog)
    if (result.ok) design = result.value.design
    else dropped.push(extra)
  }
  if (extras.length) design = followChoice(completeJoints(normalize(design, catalog), catalog, built.design), retyped(built.design, extras, dropped), catalog)
  const { design: repaired, repairs } = repairDesign(design, catalog, requirements)
  const notes = [...built.notes, ...(dropped.length ? [`${dropped.length === 1 ? 'Un cambio hecho con el experto ya no aplica' : `${dropped.length} cambios hechos con el experto ya no aplican`} con la nueva ficha y lo${dropped.length === 1 ? '' : 's'} dejé fuera.`] : [])]
  return { design: repaired, notes, missing: builtAsAsked(plan, built.design), dropped, repairs }
}

/** The joints of the plan an extra gave another type: what the person chose for their group, to be followed by the joints the plan has gained since. */
function retyped(built: Design, extras: Operation[], dropped: Operation[]): Set<string> {
  const types = new Map(built.joints.map((u) => [u.id, u.type]))
  return new Set(extras.flatMap((e) => (e.op === 'changeJoint' && !dropped.includes(e) && types.has(e.joint.id) && types.get(e.joint.id) !== e.joint.type ? [e.joint.id] : [])))
}
