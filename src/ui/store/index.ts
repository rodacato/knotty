import { create } from 'zustand'
import { createExpert } from './expert'
import { createPlanDraft } from './planDraft'
import { createScene } from './scene'
import { createSession } from './session'
import { createSettings } from './settings'
import type { Store } from './types'

// One store for the whole interface, composed from slices that each own one concern.

export const useStore = create<Store>()((...a) => ({
  ...createSession(...a),
  ...createExpert(...a),
  ...createScene(...a),
  ...createPlanDraft(...a),
  ...createSettings(...a),
}))

export { hiddenIn, visibleDesign, type SceneMode, type View } from './scene'
export type { CaptureInput } from './expert'
export { draftOf, type PlanDraft } from './planDraft'
export type { Store } from './types'
