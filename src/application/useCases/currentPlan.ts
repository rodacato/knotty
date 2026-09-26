import type { FurniturePlan } from '../../domain/furniture/modules/plan'
import type { Operation } from '../../domain/editing/operations/schema'
import type { DesignState } from '../../domain/session/state'

/** The plan behind the current design, from version `since`; if later versions changed the design freely (`diverged`), applying it drops those changes. */
export function currentPlan(state: DesignState): { plan: FurniturePlan | null; extras: Operation[]; since: number | null; diverged: boolean } {
  const ordered = [...state.versions].sort((a, b) => b.n - a.n).filter((v) => v.n <= state.current)
  const source = ordered.find((v) => v.plan)
  return { plan: source?.plan ?? null, extras: source?.extras ?? [], since: source?.n ?? null, diverged: !!source && source.n !== state.current }
}

/** A free-form change on a design that has a plan keeps the plan and joins its extras. */
export const layered = (current: ReturnType<typeof currentPlan>, operations: Operation[]) =>
  current.plan && !current.diverged ? { plan: current.plan, extras: [...current.extras, ...operations] } : { plan: null, extras: [] }
