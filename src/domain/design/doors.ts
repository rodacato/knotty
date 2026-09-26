import type { Box } from './resolve'
import { CONTACT_TOLERANCE, overlap } from './boxes'
import type { DoorMount } from '../materials/catalog'

// How a door sits on the upright it hangs from, read from where the pieces are: that is what picks its hinge (straight, cranked, super-cranked).

/** From this share of the upright's edge covered, the door covers all of it; less, it shares the edge with the door beside it. */
export const FULL_OVERLAY_SHARE = 2 / 3

/** Over the upright's front edge (all of it or half), or inside the opening beside it; null when the pieces do not say. */
export function doorMount(door: Box, upright: Box): DoorMount | null {
  const covered = overlap(door, upright, 'x')
  const inFront = door.z0 >= upright.z1 - CONTACT_TOLERANCE || door.z1 <= upright.z0 + CONTACT_TOLERANCE
  if (inFront) {
    if (covered <= CONTACT_TOLERANCE) return null
    return covered >= (upright.x1 - upright.x0) * FULL_OVERLAY_SHARE ? 'overlay' : 'half-overlay'
  }
  return covered <= CONTACT_TOLERANCE && overlap(door, upright, 'z') > 0 ? 'inset' : null
}
