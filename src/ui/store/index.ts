import { create } from 'zustand'
import { createExpert } from './expert'
import { createPlanDraft } from './planDraft'
import { createScene } from './scene'
import { createSession } from './session'
import { createSettings } from './settings'
import { createNavigation } from './navigation'
import type { Store } from './types'
import { reviewSignature } from '../../application/useCases/review'
import { applySettings } from '../../domain/materials/catalog'

// One store for the whole interface, composed from slices that each own one concern.

export const useStore = create<Store>()((...a) => ({
  ...createSession(...a),
  ...createExpert(...a),
  ...createScene(...a),
  ...createPlanDraft(...a),
  ...createSettings(...a),
  ...createNavigation(...a),
}))

useStore.subscribe((state, previous) => {
  if (!state.reviewing || !state.reviewProgress || (state.state === previous.state && state.catalogSettings === previous.catalogSettings)) return
  if (state.state && state.services && state.reviewProgress.signature === reviewSignature(state.state, applySettings(state.services.catalog, state.catalogSettings))) return
  const controller = state.reviewing
  useStore.setState({ reviewing: null, reviewProgress: null, verdictError: null, reviewNotice: state.state ? 'Cambiaste el diseño o los ajustes de corte. Cancelamos la revisión anterior; revisa de nuevo cuando termines de editar.' : null })
  controller.abort()
})

export { hiddenIn, visibleDesign, type EditSide, type SceneMode, type View } from './scene'
export type { CaptureInput } from './expert'
export { draftOf, type PlanDraft } from './planDraft'
export type { Phase } from './session'
export type { Store } from './types'
