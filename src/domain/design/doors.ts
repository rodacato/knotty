import type { Box } from './resolve'
import type { Design, Piece } from './schema'
import { CONTACT_TOLERANCE, overlap } from './boxes'
import type { DoorMount } from '../materials/catalog'
import { cite, JOINTS_DOC, type Source } from '../sources'

// How a door sits on the upright it hangs from, read from where the pieces are: that is what picks its hinge (straight, cranked, super-cranked).

/** From this share of the upright's edge covered, the door covers all of it; less, it shares the edge with the door beside it. */
const FULL_OVERLAY_SHARE = 2 / 3
export const DOOR_SOURCES: Record<string, Source> = {
  // «Recta» covers all the edge, «codo» half of it: two thirds splits them with the door gap on either side.
  FULL_OVERLAY_SHARE: cite(JOINTS_DOC, '61-bisagra-de-cazoleta-de-35-mm-concealed--european-hinge', 'cada una tapa la mitad del canto (half overlay)'),
}

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

/** A lid: a door lying flat that lifts on a hinge along its back edge, held open by a stay. It neither swings out to the front nor hangs from an upright. */
export const lifts = (design: Pick<Design, 'joints'>, doorId: string) => design.joints.some((u) => u.a === doorId && u.type === 'lid-hinge')

/** As far as a friction stay lets a lid open. */
const LID_OPEN = Math.PI / 2

export interface LidSwing {
  /** The edge it turns about: the top of the edge its hinge is on, as [y, z]. */
  pivot: [number, number]
  /** Which way its free edge lies from the hinge, along z. */
  toFree: 1 | -1
  /** From the hinge to the free edge. */
  reach: number
  /** What it meets first on its way up, and the room up to it; null when nothing is in its way. */
  over: { piece: Piece; room: number } | null
  /** How far it opens, in radians: all the way, or until it meets what is over it. */
  angle: number
}

/** How a lid opens: about the edge next to the board its hinge is on, up to what is over it. Null when it is not a lid or it is not placed. */
export function lidSwing(design: Pick<Design, 'joints' | 'pieces'>, boxes: Map<string, Box>, lidId: string): LidSwing | null {
  const hinge = design.joints.find((u) => u.a === lidId && u.type === 'lid-hinge')
  const box = boxes.get(lidId)
  const held = hinge && boxes.get(hinge.b)
  if (!box || !held) return null
  const toFree = (held.z0 + held.z1) / 2 <= (box.z0 + box.z1) / 2 ? 1 : -1
  const reach = box.z1 - box.z0
  const over =
    design.pieces
      .filter((p) => p.id !== lidId)
      .flatMap((piece) => {
        const b = boxes.get(piece.id)
        return b && b.y0 >= box.y1 - CONTACT_TOLERANCE && overlap(b, box, 'x') > CONTACT_TOLERANCE && overlap(b, box, 'z') > CONTACT_TOLERANCE ? [{ piece, room: b.y0 - box.y1 }] : []
      })
      .sort((a, b) => a.room - b.room)[0] ?? null
  return { pivot: [box.y1, toFree > 0 ? box.z0 : box.z1], toFree, reach, over, angle: over && over.room < reach ? Math.asin(Math.max(0, over.room) / reach) : LID_OPEN }
}

/** A door that slides instead of swinging: it hangs from no hinge and runs, unglued, in grooves of the boards under and over it. */
export const slides = (design: Pick<Design, 'joints'>, doorId: string) => design.joints.some((u) => u.a === doorId && u.type === 'dado' && !u.glue)
