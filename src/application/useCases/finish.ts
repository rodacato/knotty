import { FINISHES, finishOf, type FinishId } from '../../domain/materials/finishes'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { currentPlan, layered } from './currentPlan'
import type { Kit } from './kit'

/** The finish the person picks in Materiales: a version of its own, with the same pieces, plan and extras. */
export function createFinish(kit: Kit) {
  const { save, addVersion, noted } = kit

  function chooseFinish(state: DesignState, finish: FinishId): DesignState {
    const design = currentDesign(state)
    if (finishOf(design) === finish) return state
    const summary = `Acabado: ${FINISHES[finish].name.toLowerCase()}`
    const withVersion = addVersion(state, { ...design, finish }, { summary, reason: `A mano: ${summary}`, operations: [], origin: null, ...layered(currentPlan(state), []) })
    return save(noted(withVersion, 'user', `Elegí el acabado: ${FINISHES[finish].name.toLowerCase()}.`))
  }

  return { chooseFinish }
}
