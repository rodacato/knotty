import { create } from 'zustand'
import { createExpert } from './expert'
import { createScene } from './scene'
import { createSession } from './session'
import { createSettings } from './settings'
import type { Store } from './types'

// One store for the whole interface, composed from slices that each own one concern.

export const useStore = create<Store>()((...a) => ({
  ...createSession(...a),
  ...createExpert(...a),
  ...createScene(...a),
  ...createSettings(...a),
}))

export { visibleDesign, type View } from './scene'
export type { CaptureInput } from './expert'
export type { Store } from './types'
