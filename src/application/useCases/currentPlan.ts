import type { FurniturePlan } from '../../domain/furniture/modules/plan'
import type { Operation } from '../../domain/editing/operations/schema'
import type { DesignState } from '../../domain/session/state'

/** The plan behind the current design, from version `since`; if later versions changed the design freely (`diverged`), applying it drops those changes. */
export function currentPlan(state: DesignState): { plan: FurniturePlan | null; extras: Operation[]; since: number | null; diverged: boolean } {
  const ordered = [...state.versions].sort((a, b) => b.n - a.n).filter((v) => v.n <= state.current)
  const source = ordered.find((v) => v.plan)
  return { plan: source?.plan ?? null, extras: source?.extras ?? [], since: source?.n ?? null, diverged: !!source && source.n !== state.current }
}

/** The ficha a design was opened from, and whether it changed since: its plan is no longer the first version's, or pieces were changed outside it. Null for a design of its own. */
export function fichaOrigin(state: DesignState): { code: string; version: number; changed: boolean } | null {
  if (!state.ficha) return null
  const first = [...state.versions].sort((a, b) => a.n - b.n)[0]
  const { plan, diverged } = currentPlan(state)
  return { ...state.ficha, changed: diverged || JSON.stringify(plan) !== JSON.stringify(first.plan) }
}

/** A free-form change on a design that has a plan keeps the plan and joins its extras. */
export const layered = (current: ReturnType<typeof currentPlan>, operations: Operation[]) =>
  current.plan && !current.diverged ? { plan: current.plan, extras: [...current.extras, ...operations] } : { plan: null, extras: [] }
