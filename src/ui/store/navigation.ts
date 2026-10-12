import type { Slice } from './types'

/** The Studio panels are view state, so browser history can restore them without changing the design. */
export interface NavigationSlice {
  studioTab: 'chat' | 'materials'
  studioOverlay: 'notices' | 'history' | null
  setStudioTab(tab: string): void
  setStudioOverlay(overlay: NavigationSlice['studioOverlay']): void
}

export const createNavigation: Slice<NavigationSlice> = (set) => ({
  studioTab: 'chat',
  studioOverlay: null,
  setStudioTab: (tab) => { if (tab === 'chat' || tab === 'materials') set({ studioTab: tab }) },
  setStudioOverlay: (studioOverlay) => set({ studioOverlay }),
})
