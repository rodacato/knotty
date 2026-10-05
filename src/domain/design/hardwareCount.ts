import { ASSUMPTIONS, hingesFor } from '../assumptions'
import type { Joint } from './schema'
import type { Geometry } from './resolve'
import { jointLength } from './validation/contact'

// How many dowels, screws, nails, pins and hinges a joint takes when the model does not say. The shopping list buys them and the 3D draws them.

const SPACING = { screw: 200, nail: 150, dowel: 150, bolt: 400 }
/** A joint shorter than this has room for one connector bolt; the reference gives no spacing for them, so both numbers are Knotty's. */
const BOLT_PAIR_NEEDS = 120
/** Dowels, plugs and screws keep this far from the ends of the joint. */
export const END_MARGIN = 50

/** The shortest butt joint that takes two screws, each far enough from its end (R3); a shorter one takes one in the middle. */
const screwPairNeeds = 2 * ASSUMPTIONS.screws.endDistance + ASSUMPTIONS.screws.pairRoom

/** How many dowels, spaced along a joint of this length and never fewer than two. */
export const dowelsAlong = (length: number) => Math.max(2, Math.ceil((length - 2 * END_MARGIN) / SPACING.dowel) + 1)
/** How much hardware a joint takes when the model does not say: by spacing along the joint. */
export function hardwarePerJoint(u: Joint, geo: Pick<Geometry, 'boxes'>): number {
  const a = geo.boxes.get(u.a)
  const b = geo.boxes.get(u.b)
  const length = a && b ? jointLength(a, b) : 0
  const bySpacing = (spacing: number, minimum: number) => Math.max(minimum, Math.ceil((length - 2 * END_MARGIN) / spacing) + 1)
  switch (u.type) {
    case 'butt-screw':
      return length > 0 && length < screwPairNeeds ? 1 : bySpacing(SPACING.screw, 2)
    case 'pocket-screw':
      return bySpacing(SPACING.screw, 2)
    case 'dowel':
    case 'plugged-dowel':
    case 'cam-lock':
      return dowelsAlong(length)
    case 'connector-bolt':
      return length > 0 && length < BOLT_PAIR_NEEDS ? 1 : bySpacing(SPACING.bolt, 2)
    case 'glue-nail':
      return bySpacing(SPACING.nail, 2)
    case 'shelf-pin':
      return 2
    case 'cup-hinge': {
      const door = geo.boxes.get(u.a)
      return hingesFor(door ? door.y1 - door.y0 : 0)
    }
    case 'bracket':
      return 2
    case 'drawer-slide':
    case 'dado':
    case 'rabbet':
    case 'finger':
      return 1
  }
}
