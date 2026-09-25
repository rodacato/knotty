import type { Diseno } from '../diseno/esquema'
import { completeJoints } from '../diseno/joints'
import { normalize } from '../diseno/normalize'
import type { Catalogo } from '../materiales/catalogo'
import { aplicar } from '../operaciones/aplicar'
import type { Operacion } from '../operaciones/esquema'
import { repairDesign, type Repair } from '../repair/repair'
import type { Requisito } from '../requisitos/requisitos'
import { buildPlan, type FurniturePlan } from './plan'

// The design is its plan plus the free-form changes made on top: rebuilding replays them, so neither the ficha nor the freedom is lost.

export interface Rebuilt {
  design: Diseno
  notes: string[]
  /** Extras that no longer apply (they touched a piece the new plan does not have): left out, and said. */
  dropped: Operacion[]
  repairs: Repair[]
}

export function rebuildFromPlan(plan: FurniturePlan, extras: Operacion[], catalog: Catalogo, requirements: Requisito[] = []): Rebuilt {
  const built = buildPlan(plan, catalog)
  let design = built.design
  const dropped: Operacion[] = []
  for (const extra of extras) {
    const result = aplicar(design, [extra], catalog)
    if (result.ok) design = result.valor.diseno
    else dropped.push(extra)
  }
  if (extras.length) design = completeJoints(normalize(design, catalog), catalog, built.design)
  const { design: repaired, repairs } = repairDesign(design, catalog, requirements)
  const notes = [...built.notes, ...(dropped.length ? [`${dropped.length === 1 ? 'Un cambio hecho con el experto ya no aplica' : `${dropped.length} cambios hechos con el experto ya no aplican`} con la nueva ficha y lo${dropped.length === 1 ? '' : 's'} dejé fuera.`] : [])]
  return { design: repaired, notes, dropped, repairs }
}
