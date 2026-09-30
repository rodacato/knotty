import type { Base } from '../domain/furniture/examples'
import type { Reference } from '../domain/furniture/references'

/** The furniture of reference Knotty ships: every ficha, the latest version of one, and the ones that go on the home screen. */
export interface ReferenceStore {
  all(): readonly Reference[]
  /** The latest version of a reference by its code (`KC-APA-01`), or null when there is none. */
  latest(code: string): Reference | null
  /** The references with a place on the home screen, in its order. */
  home(): Base[]
}
