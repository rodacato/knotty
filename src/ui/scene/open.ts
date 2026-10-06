import { ASSUMPTIONS } from '../../domain/assumptions'
import { bounds, CONTACT_TOLERANCE, drawerGroups, overlap } from '../../domain/design/boxes'
import { slides } from '../../domain/design/doors'
import type { Design } from '../../domain/design/schema'
import type { Box } from '../../domain/design/resolve'
import type { Explosion, Offset } from './explode'

// The furniture in use: drawers pulled out, doors swung open on their hinges and sliding ones run along their tracks. Nothing comes apart, and all in mm like the rest of the scene.

/** How far a drawer comes out, as a share of its depth. */
const DRAWER_OUT = 0.6
/** How wide a door opens. */
const DOOR_ANGLE = (100 * Math.PI) / 180

/** A turn about a vertical axis through (x, z). */
export interface Swing {
  pivot: [number, number]
  angle: number
}

export interface Opening extends Explosion {
  swings: Map<string, Swing>
}

const center = (b: Box, axis: 'x' | 'y' | 'z') => (b[`${axis}0`] + b[`${axis}1`]) / 2

/** Drawers slide out through their front; doors swing about the edge their hinge is on, out of the face that shows, or slide sideways when they hang from none. */
export function opening(design: Design, boxes: Map<string, Box>): Opening {
  const offsets = new Map<string, Offset>(design.pieces.map((p) => [p.id, [0, 0, 0]]))
  const swings = new Map<string, Swing>()
  const all = bounds(design.pieces.filter((p) => boxes.has(p.id)).map((p) => boxes.get(p.id)!))
  const reach: Box[] = [all]

  for (const group of drawerGroups(design)) {
    const pieces = design.pieces.filter((p) => p.group === group && boxes.has(p.id))
    const face = pieces.find((p) => p.role === 'drawer-front')!
    const box = bounds(pieces.map((p) => boxes.get(p.id)!))
    const axis = face.normal
    const sign = center(boxes.get(face.id)!, axis) >= center(box, axis) ? 1 : -1
    const distance = sign * DRAWER_OUT * (box[`${axis}1`] - box[`${axis}0`])
    const offset: Offset = [axis === 'x' ? distance : 0, axis === 'y' ? distance : 0, axis === 'z' ? distance : 0]
    for (const p of pieces) offsets.set(p.id, offset)
    reach.push({ x0: box.x0 + Math.min(0, offset[0]), x1: box.x1 + Math.max(0, offset[0]), y0: box.y0, y1: box.y1, z0: box.z0 + Math.min(0, offset[2]), z1: box.z1 + Math.max(0, offset[2]) })
  }

  for (const door of design.pieces.filter((p) => p.role === 'door' && p.normal === 'z' && boxes.has(p.id))) {
    const hinge = design.joints.find((j) => j.type === 'cup-hinge' && j.a === door.id)
    const upright = hinge && boxes.get(hinge.b)
    if (!upright) continue
    const box = boxes.get(door.id)!
    const onLeft = Math.abs(center(upright, 'x') - box.x0) <= Math.abs(center(upright, 'x') - box.x1)
    const out = center(box, 'z') >= center(all, 'z') ? 1 : -1
    // An overlay door turns about the corner of its inner face, in front of the upright; one set inside the opening turns about the corner of its outer face, so its inner corner moves away from the upright instead of into it.
    const inset = Math.min(box.z1, upright.z1) - Math.max(box.z0, upright.z0) > 1
    const [inner, outer] = out > 0 ? [box.z0, box.z1] : [box.z1, box.z0]
    const pivot: [number, number] = [onLeft ? box.x0 : box.x1, inset ? outer : inner]
    // About the vertical axis a positive turn carries +x toward −z, so the free edge goes out with the opposite sign of (side × face).
    swings.set(door.id, { pivot, angle: -(onLeft ? 1 : -1) * out * DOOR_ANGLE })
    const width = box.x1 - box.x0
    reach.push({ ...box, z0: out > 0 ? box.z0 : box.z0 - width * Math.sin(DOOR_ANGLE), z1: out > 0 ? box.z1 + width * Math.sin(DOOR_ANGLE) : box.z1 })
  }

  // A sliding leaf runs along its track from the upright it closes against, over the other half of its opening. Of two that overlap only the one behind moves: both would just trade places.
  const sliding = design.pieces.filter((p) => p.role === 'door' && boxes.has(p.id) && slides(design, p.id)).map((p) => ({ id: p.id, box: boxes.get(p.id)! }))
  const uprights = design.pieces.filter((p) => p.normal === 'x' && p.role !== 'door' && boxes.has(p.id)).map((p) => boxes.get(p.id)!)
  for (const { id, box } of sliding) {
    const out = center(box, 'z') >= center(all, 'z') ? 1 : -1
    if (sliding.some((other) => other.id !== id && overlap(other.box, box, 'x') > 0 && overlap(other.box, box, 'y') > 0 && out * (center(other.box, 'z') - center(box, 'z')) < 0)) continue
    const beside = (edge: number, face: 'x0' | 'x1') => uprights.some((u) => Math.abs(u[face] - edge) <= CONTACT_TOLERANCE && overlap(u, box, 'y') > 0 && overlap(u, box, 'z') > 0)
    const direction = beside(box.x0, 'x1') ? 1 : beside(box.x1, 'x0') ? -1 : 0
    const distance = direction * (box.x1 - box.x0 - ASSUMPTIONS.sliding.overlap)
    offsets.set(id, [distance, 0, 0])
  }

  return { offsets, swings, bounds: bounds(reach) }
}
