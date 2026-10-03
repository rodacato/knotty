import type { DesignState } from '../domain/session/state'

export interface DesignRepository {
  load(): DesignState | null
  save(state: DesignState): void
  clear(): void
}

/** Lets the workshop work on throwaway designs: while it is on, nothing reaches the saved one. */
export interface Sandbox {
  enter(): void
  leave(): void
  active(): boolean
}
