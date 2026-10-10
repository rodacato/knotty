import type { Source } from '../../sources'

// A build guide: what goes together first, as a module declares it for the furniture it builds. Knotty knows the pieces and their joints, not their order; the order is the module's.

export interface GuideStep {
  /** What to do, for the person. It carries no number the reference row does not have. */
  text: string
  /** The row of docs/carpinteria it comes from. */
  source: Source
}

export interface GuidePhase {
  id: string
  title: string
  steps: GuideStep[]
  /** The pieces that go on in this phase; none for a phase that only prepares or finishes. */
  pieces: string[]
  /** Where its pieces are seen from when the front hides them. */
  seenFrom?: 'back'
}
