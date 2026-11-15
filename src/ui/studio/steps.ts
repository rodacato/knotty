import { partName, type PartSpec } from '../../domain/furniture/modules/parts'
import { moduleOf, type FurniturePlan } from '../../domain/furniture/modules/plan'

// The parts of one side read as a numbered sequence (UI-92): one step open at a time, the rest one line each.

export interface Step {
  id: string
  name: string
  summary: string
  number: number
  active: boolean
}

/** The kind of furniture is step 1 from outside; it is a step of its own, not a part of the plan. */
export const KIND_STEP = 'kind'

/** The parts of one side as steps numbered from `first`: outside opens with the kind of furniture, so its parts start at 2. At most one is active. */
export function sideSteps(plan: FurniturePlan, side: PartSpec<FurniturePlan>['side'], finish: string, active: string | null, first = 1): Step[] {
  const parts = (moduleOf(plan).parts.list as PartSpec<FurniturePlan>[]).filter((p) => p.side === side)
  return parts.map((p, i) => ({ id: p.id, name: partName(p, plan), summary: p.summary(plan, finish), number: first + i, active: p.id === active }))
}

/** Every step of editing from outside, as the strip shows them (UI-93): the kind first, then the parts. Exactly one is open: the chosen part, or the kind while no part is. */
export function outsideSteps(plan: FurniturePlan, finish: string, part: string | null, kind: string): Step[] {
  const parts = sideSteps(plan, 'outside', finish, part, 2)
  const partOpen = parts.some((s) => s.active)
  return [{ id: KIND_STEP, name: 'Tipo de mueble', summary: kind, number: 1, active: !partOpen }, ...parts]
}
