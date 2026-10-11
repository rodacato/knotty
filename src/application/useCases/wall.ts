import { wallOf, type Wall } from '../../domain/design/schema'
import { WALL_LABELS } from '../../domain/estimate/anchoring'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { currentPlan, layered } from './currentPlan'
import type { Kit } from './kit'

/** The wall the person says in Materiales the piece is anchored to: a version of its own, with the same pieces, plan and extras. */
export function createWall(kit: Kit) {
  const { save, addVersion, noted } = kit

  function chooseWall(state: DesignState, wall: Wall): DesignState {
    const design = currentDesign(state)
    if (wallOf(design) === wall) return state
    const summary = wall === 'unknown' ? 'Muro: sin decir' : `Muro: ${WALL_LABELS[wall].toLowerCase()}`
    const withVersion = addVersion(state, { ...design, wall }, { summary, reason: `A mano: ${summary}`, operations: [], origin: null, ...layered(currentPlan(state), []) })
    return save(noted(withVersion, 'user', wall === 'unknown' ? 'No sé de qué es el muro.' : `El muro es de ${WALL_LABELS[wall].toLowerCase()}.`))
  }

  return { chooseWall }
}
