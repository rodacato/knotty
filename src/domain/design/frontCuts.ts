import type { Box } from './resolve'
import type { Cut, Design, FaceRef, Piece, Span } from './schema'
import { lifts, slides } from './doors'

// What is taken out of a board: a finger notch to open a front, grooves that make it ribbed, or the grooves sliding leaves run in. Only drawn: they change neither the size of a board nor the purchase.

/** A groove is at most a third of the board deep and never more than half of it (valores-de-referencia.md, «Profundidad de ranura»). */
const GROOVE_DEPTH_SHARE = 1 / 3
const NOTCH_DEPTH_SHARE = 1 / 2
/** Chosen, not sourced: a 6 mm router bit, a rib every 30 mm, and a border left smooth. */
const GROOVE_WIDTH = 6
const GROOVE_PITCH = 30
const GROOVE_BORDER = 15
/** The finger notch: as wide as a finger and a half, and as deep in the face as it is tall. */
const NOTCH_LENGTH = 100
const NOTCH_HEIGHT = 22
/** A cut starts this far out of the board so it opens the edge instead of stopping a hair short of it. */
const OUT = 1
/** How much wider than its leaf a groove is cut, on each side, so the leaf runs free. */
const GROOVE_PLAY = 1

const isFront = (p: Piece) => p.role === 'door' || p.role === 'drawer-front'
const span = (from: Span['from'], offset: number, length: number): Span => ({ from, offset, length })
/** From the front face inward. */
const deep = (depth: number) => span('end', -OUT, depth + OUT)

function grooves(box: Box): Cut[] {
  const width = box.x1 - box.x0
  const thickness = box.z1 - box.z0
  const count = Math.floor((width - 2 * GROOVE_BORDER + (GROOVE_PITCH - GROOVE_WIDTH)) / GROOVE_PITCH)
  if (count < 1) return []
  const first = (width - (count * GROOVE_PITCH - (GROOVE_PITCH - GROOVE_WIDTH))) / 2
  return Array.from({ length: count }, (_, i) => ({ x: span('start', first + i * GROOVE_PITCH, GROOVE_WIDTH), y: span('start', -OUT, box.y1 - box.y0 + 2 * OUT), z: deep(thickness * GROOVE_DEPTH_SHARE) }))
}

/** A lid's notch goes through its front edge, in the middle: a finger gets under it there. */
const lidNotch = (box: Box): Cut => ({ x: span('center', 0, Math.min(NOTCH_LENGTH, box.x1 - box.x0 - 2 * GROOVE_BORDER)), y: span('start', -OUT, box.y1 - box.y0 + 2 * OUT), z: span('end', -OUT, NOTCH_HEIGHT + OUT) })

/** The notch of a drawer front, by the width and the thickness of its board: on its top edge, in the middle. */
export const drawerNotch = (width: number, thickness: number): Cut => ({ x: span('center', 0, Math.min(NOTCH_LENGTH, width - 2 * GROOVE_BORDER)), y: span('end', -OUT, NOTCH_HEIGHT + OUT), z: deep(thickness * NOTCH_DEPTH_SHARE) })

/** A drawer front takes its own notch; a door's sits on the edge away from its hinge, halfway up. */
function notch(piece: Piece, box: Box, hingeOnLeft: boolean): Cut {
  const width = box.x1 - box.x0
  const height = box.y1 - box.y0
  const depth = deep((box.z1 - box.z0) * NOTCH_DEPTH_SHARE)
  if (piece.role === 'drawer-front') return drawerNotch(width, box.z1 - box.z0)
  const along = span('center', 0, Math.min(NOTCH_LENGTH, height - 2 * GROOVE_BORDER))
  return { x: hingeOnLeft ? span('end', -OUT, NOTCH_HEIGHT + OUT) : span('start', -OUT, NOTCH_HEIGHT + OUT), y: along, z: depth }
}

/** Which side each door hangs on, read from its hinge joint. A sliding leaf has none: it counts as hung on the middle of its track, so its notch is on its outer edge, where the other leaf never covers it. */
function hingeSides(design: Design, boxes: Map<string, Box>): Map<string, boolean> {
  const sides = new Map<string, boolean>()
  for (const u of design.joints) {
    const door = boxes.get(u.a)
    const held = boxes.get(u.b)
    if ((u.type === 'cup-hinge' || slides(design, u.a)) && door && held) sides.set(u.a, (held.x0 + held.x1) / 2 < (door.x0 + door.x1) / 2)
  }
  return sides
}

/** The design with the notches and the grooves its plan asks for, door by door and front by front. */
export function withFrontCuts(design: Design, boxes: Map<string, Box>, askOf: (front: Piece) => { notch: boolean; grooved: boolean }): Design {
  const sides = hingeSides(design, boxes)
  return {
    ...design,
    pieces: design.pieces.map((p) => {
      const box = boxes.get(p.id)
      if (!box || !isFront(p)) return p
      const ask = askOf(p)
      // A lid lies flat: its face is not a front to rib, and its notch is its own.
      const lid = lifts(design, p.id)
      const cuts = [...(ask.grooved && !lid ? grooves(box) : []), ...(ask.notch ? [lid ? lidNotch(box) : notch(p, box, sides.get(p.id) ?? false)] : [])]
      return cuts.length ? { ...p, cuts } : p
    }),
  }
}

/** The opening a sliding leaf runs across, by the faces at its two ends. */
export interface Track {
  door: string
  left: FaceRef
  right: FaceRef
}

const faceAt = (boxes: Map<string, Box>, face: FaceRef) => {
  const [id, side] = face.split('.') as [string, keyof Box]
  return boxes.get(id)?.[side]
}

/**
 * The grooves sliding leaves run in, taken out of the board under each opening and the one over it, all along the opening.
 * The one above is twice as deep, so the leaf lifts in and out; both are a little wider than the leaf.
 */
export function withTrackGrooves(design: Design, boxes: Map<string, Box>, tracks: Track[]): Design {
  const cuts = new Map<string, Cut[]>()
  for (const track of tracks) {
    const leaf = boxes.get(track.door)
    const [left, right] = [faceAt(boxes, track.left), faceAt(boxes, track.right)]
    if (!leaf || left === undefined || right === undefined) continue
    for (const joint of design.joints.filter((u) => u.a === track.door && u.type === 'dado' && !u.glue)) {
      const board = boxes.get(joint.b)
      if (!board) continue
      const under = (board.y0 + board.y1) / 2 < (leaf.y0 + leaf.y1) / 2
      const y = under ? span('end', -OUT, board.y1 - leaf.y0 + OUT) : span('start', -OUT, 2 * (leaf.y1 - board.y0) + OUT)
      cuts.set(joint.b, [...(cuts.get(joint.b) ?? []), { x: span('start', left - board.x0, right - left), y, z: span('start', leaf.z0 - board.z0 - GROOVE_PLAY, leaf.z1 - leaf.z0 + 2 * GROOVE_PLAY) }])
    }
  }
  return cuts.size ? { ...design, pieces: design.pieces.map((p) => (cuts.has(p.id) ? { ...p, cuts: [...(p.cuts ?? []), ...cuts.get(p.id)!] } : p)) } : design
}
