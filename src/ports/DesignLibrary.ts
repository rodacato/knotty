import type { Design } from '../domain/design/schema'
import type { DesignState } from '../domain/session/state'

export const LIBRARY_PLACES = 5

/** What a place shows without loading its whole session: the design as it stood when it was saved. */
export interface SavedDesign {
  place: number
  name: string
  savedAt: string
  design: Design
}

/** The places where the person keeps designs on purpose, beside the open one that saves itself. Places are numbered from 1. */
export interface DesignLibrary {
  /** False when this browser can only keep the open design. */
  readonly available: boolean
  /** One entry per place, null for an empty one. */
  places(): (SavedDesign | null)[]
  /** The place the open design belongs to, and whether that place already holds it as it is now. */
  current(): { place: number | null; saved: boolean }
  /** The open design is another one from now on: it belongs to no place until it is saved in one. */
  detach(): void
  /** Saves the open design in a place, over whatever it held; false when it could not be stored. */
  saveTo(place: number, name: string): Promise<boolean>
  rename(place: number, name: string): void
  remove(place: number): void
  read(place: number): Promise<DesignState | null>
  /** Reads a place and makes it the open design. */
  open(place: number): Promise<DesignState | null>
}
