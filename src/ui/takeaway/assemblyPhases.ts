import { currentPlan } from '../../application/useCases'
import { moduleOf } from '../../domain/furniture/modules/plan'
import { currentDesign, type DesignState } from '../../domain/session/state'

export function assemblyPhases(state: DesignState) {
  const { plan, diverged } = currentPlan(state)
  return (plan && !diverged ? moduleOf(plan).phases?.(plan, currentDesign(state)) : null) ?? []
}
