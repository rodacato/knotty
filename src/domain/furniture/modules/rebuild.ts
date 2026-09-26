import type { Design } from '../../design/schema'
import { completeJoints } from '../../design/joints'
import { normalize } from '../../design/normalize'
import type { Catalog } from '../../materials/catalog'
import { applyOperations } from '../../editing/operations/apply'
import type { Operation } from '../../editing/operations/schema'
import { repairDesign, type Repair } from '../../editing/repair/repair'
import type { Requirement } from '../../checks/requirements/requirements'
import { buildPlan, type FurniturePlan } from './plan'

// The design is its plan plus the free-form changes made on top: rebuilding replays them, so neither the ficha nor the freedom is lost.

interface Rebuilt {
  design: Design
  notes: string[]
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
  if (extras.length) design = completeJoints(normalize(design, catalog), catalog, built.design)
  const { design: repaired, repairs } = repairDesign(design, catalog, requirements)
  const notes = [...built.notes, ...(dropped.length ? [`${dropped.length === 1 ? 'Un cambio hecho con el experto ya no aplica' : `${dropped.length} cambios hechos con el experto ya no aplican`} con la nueva ficha y lo${dropped.length === 1 ? '' : 's'} dejé fuera.`] : [])]
  return { design: repaired, notes, dropped, repairs }
}
