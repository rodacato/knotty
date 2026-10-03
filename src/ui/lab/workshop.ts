import type { ReactNode } from 'react'

/** What the workshop hands the Studio to wrap itself in: the bench on the left, the expert's switch, the way out. */
export interface Workshop {
  bench: ReactNode
  /** What the folded bench shows on its rail. */
  benchRail: ReactNode
  /** What goes in the header next to the expert's switch: the export of the open design. */
  actions: ReactNode
  expert: ReactNode
  onExit: () => void
}
