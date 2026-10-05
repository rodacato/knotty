import type { Base } from '../domain/furniture/examples'
import type { Reference } from '../domain/furniture/references'

/** The furniture of reference Knotty ships: every ficha, the latest version of one, and all of them as the home screen lists them. */
export interface ReferenceStore {
  all(): readonly Reference[]
  /** The latest version of a reference by its code (`KC-APA-01`), or null when there is none. */
  latest(code: string): Reference | null
  /** Every reference as a place to start, in the home screen's order. */
  home(): Base[]
}
