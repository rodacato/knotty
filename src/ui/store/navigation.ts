import type { Slice } from './types'

/** The Studio panels are view state, so browser history can restore them without changing the design. */
export interface NavigationSlice {
  roomOpen: boolean
  setRoomOpen(open: boolean): void
  studioTab: 'chat' | 'findings'
  studioOverlay: 'notices' | 'history' | null
  setStudioTab(tab: string): void
  setStudioOverlay(overlay: NavigationSlice['studioOverlay']): void
}

export const createNavigation: Slice<NavigationSlice> = (set) => ({
  roomOpen: false,
  setRoomOpen: (roomOpen) => set({ roomOpen }),
  studioTab: 'chat',
  studioOverlay: null,
  setStudioTab: (tab) => { if (tab === 'chat' || tab === 'findings') set({ studioTab: tab }) },
  setStudioOverlay: (studioOverlay) => set({ studioOverlay }),
})
