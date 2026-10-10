import type { Source } from '../../sources'

// A build guide: what goes together first, as a module declares it for the furniture it builds. Knotty knows the pieces and their joints, not their order; the order is the module's.

export interface GuideStep {
  /** What to do, for the person. It carries no number the reference row does not have. */
  text: string
  /** The row of docs/carpinteria it comes from. */
  source: Source
}

export type Way = 'back' | 'below' | 'front' | 'above'

export interface GuidePhase {
  id: string
  title: string
  steps: GuideStep[]
  /** The pieces that go on in this phase; none for a phase that only prepares or finishes. */
  pieces: string[]
  /** Where its pieces are seen from when the front hides them. */
  seenFrom?: 'back'
  /** Which way its pieces come on, so the drawing shows them on their way there; none when they are drawn in place. */
  entersFrom?: Way
  /** Its pieces in the order they go on, when that order is the phase: each lot is drawn in turn, over the ones before. */
  lots?: { pieces: string[]; entersFrom?: Way }[]
  /** Some of its pieces drawn by themselves and apart, when the furniture hides how they go together: one drawer, the base. */
  detail?: { title: string; pieces: string[] }
}
