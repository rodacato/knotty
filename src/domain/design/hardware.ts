import { hingesFor } from '../assumptions'
import type { Catalog } from '../materials/catalog'
import type { Axis, Design } from './schema'
import type { Box } from './resolve'
import { contactBetween } from './validation/contact'
import { dowelsAlong, END_MARGIN, hardwarePerJoint } from './hardwareCount'

// Where the hardware sits, to draw it: runners in the gap beside each drawer, hinge cups on the inside of each door, wood plugs on the face a dowel goes through,
// and the dowels, screws and shelf pins of the other joints with the holes they go into. Spaced as the shopping list counts them: typical places, not a drilling template.

/** A runner is about this tall; the model does not say, the common 45 mm ones are. */
const RUNNER_HEIGHT = 45
const CUP_DIAMETER = 35
const CUP_DEPTH = 12
/** From the door's edge to the center of the cup, and from its ends to the first and last hinge. */
const CUP_INSET = 22.5
const HINGE_FROM_END = 100
/** A plug closes the hole of an 8 mm dowel, so it is a little wider. */
const PLUG_DIAMETER = 10
/** The catalog's dowel, 8 × 40; into a face it goes no deeper than two thirds of the board (valores-de-referencia.md). */
const DOWEL = { diameter: 8, length: 40, faceShare: 2 / 3 }
/** A #8 screw; the length is the catalog's, this one when it does not say. */
const SCREW = { diameter: 4, length: 38, pilot: 3 }
/** An M6 connector bolt, in the 7 mm hole that lets it reach its barrel nut. */
const BOLT = { diameter: 6, pilot: 7 }
/** A 5 mm shelf pin: this much of it sticks out under the shelf. */
const SHELF_PIN = { diameter: 5, length: 16, out: 8 }
const AXES: Axis[] = ['x', 'y', 'z']
const low = (b: Box, axis: Axis) => b[`${axis}0` as const]
const high = (b: Box, axis: Axis) => b[`${axis}1` as const]

type Point = [number, number, number]

export type HardwarePart =
  /** Moves with `owner` in the exploded view. */
  | { kind: 'runner'; owner: string; box: Box }
  | { kind: 'hinge'; owner: string; center: [number, number, number]; diameter: number; depth: number }
  /** On the face of `owner` away from the piece the dowel goes into, looking out along `axis` in the direction `outward`. */
  | { kind: 'plug'; owner: string; center: Point; axis: Axis; outward: 1 | -1; diameter: number }
  /** Where a dowel or a screw enters `owner`, on the face it meets the other piece with. */
  | { kind: 'hole'; owner: string; center: Point; axis: Axis; outward: 1 | -1; diameter: number }
  /** A rod lying along `axis`, `center` at its middle. A dowel stays in the piece that takes it; a pin in the side that carries the shelf. */
  | { kind: 'dowel' | 'shelf-pin'; owner: string; center: Point; axis: Axis; length: number; diameter: number }
  /** Goes through `owner`, its head on the end that looks `outward`. */
  | { kind: 'screw'; owner: string; center: Point; axis: Axis; length: number; diameter: number; outward: 1 | -1 }

/** Where a meets b: the axis their faces touch along, which way b lies, the plane between them and points spaced along the longer side of the contact. */
function meeting(a: Box, b: Box) {
  const face = contactBetween('a', a, 'b', b)?.axis
  if (!face) return null
  const toward: 1 | -1 = (low(b, face) + high(b, face)) / 2 >= (low(a, face) + high(a, face)) / 2 ? 1 : -1
  const around = AXES.filter((e) => e !== face).map((e) => ({ axis: e, lo: Math.max(low(a, e), low(b, e)), hi: Math.min(high(a, e), high(b, e)) }))
  const [along, across] = around[0].hi - around[0].lo >= around[1].hi - around[1].lo ? around : [around[1], around[0]]
  const length = along.hi - along.lo
  const margin = Math.min(END_MARGIN, length / 4)
  /** `n` points on the plane `at` along the face axis. */
  const points = (n: number, at: number): Point[] =>
    Array.from({ length: n }, (_, i) => {
      const point: Point = [0, 0, 0]
      point[AXES.indexOf(face)] = at
      point[AXES.indexOf(along.axis)] = along.lo + margin + (n > 1 ? ((length - 2 * margin) * i) / (n - 1) : (length - 2 * margin) / 2)
      point[AXES.indexOf(across.axis)] = (across.lo + across.hi) / 2
      return point
    })
  return { face, toward, length, plane: toward === 1 ? high(a, face) : low(a, face), points }
}

export function hardwareParts(design: Design, boxes: Map<string, Box>, catalog: Catalog): HardwarePart[] {
  const parts: HardwarePart[] = []
  for (const u of design.joints) {
    const a = boxes.get(u.a)
    const b = boxes.get(u.b)
    if (!a || !b) continue
    if (u.type === 'drawer-slide') {
      // The drawer side and its support, whichever order the joint names them in.
      const [side, support] = design.pieces.find((p) => p.id === u.a)?.group ? [a, b] : [b, a]
      const [x0, x1] = side.x0 >= support.x1 ? [support.x1, side.x0] : [side.x1, support.x0]
      if (x1 - x0 <= 0) continue
      const middle = (side.y0 + side.y1) / 2
      const height = Math.min(RUNNER_HEIGHT, side.y1 - side.y0)
      parts.push({ kind: 'runner', owner: side === a ? u.a : u.b, box: { x0, x1, y0: middle - height / 2, y1: middle + height / 2, z0: side.z0, z1: side.z1 } })
    }
    if (u.type === 'plugged-dowel') {
      const m = meeting(a, b)
      if (!m) continue
      // The dowel goes through the face of a into the edge of b: two boards glued face to face (a laminated leg) have no plug to show.
      const [pieceA, pieceB] = [design.pieces.find((p) => p.id === u.a), design.pieces.find((p) => p.id === u.b)]
      if (pieceA?.normal !== m.face || pieceB?.normal === m.face) continue
      const outward = m.toward === 1 ? -1 : 1
      for (const center of m.points(dowelsAlong(m.length), outward === 1 ? high(a, m.face) : low(a, m.face))) parts.push({ kind: 'plug', owner: u.a, center, axis: m.face, outward, diameter: PLUG_DIAMETER })
    }
    if (u.type === 'dowel' || u.type === 'butt-screw' || u.type === 'connector-bolt' || u.type === 'shelf-pin') {
      const m = meeting(a, b)
      if (!m) continue
      const { face, toward, plane } = m
      const back = toward === 1 ? -1 : 1
      const count = u.hardware[0]?.count ?? hardwarePerJoint(u, { boxes })
      const depth = (box: Box) => high(box, face) - low(box, face)
      if (u.type === 'dowel') {
        const inA = Math.min(DOWEL.length / 2, depth(a) * DOWEL.faceShare)
        const inB = Math.min(DOWEL.length - inA, depth(b) * DOWEL.faceShare)
        for (const center of m.points(count, plane + (toward * (inB - inA)) / 2)) parts.push({ kind: 'dowel', owner: u.b, center, axis: face, length: inA + inB, diameter: DOWEL.diameter })
        for (const center of m.points(count, plane)) parts.push({ kind: 'hole', owner: u.a, center, axis: face, outward: toward, diameter: DOWEL.diameter })
      }
      if (u.type === 'butt-screw' || u.type === 'connector-bolt') {
        const { diameter, pilot } = u.type === 'connector-bolt' ? BOLT : SCREW
        const length = catalog.hardware.find((h) => h.id === u.hardware[0]?.hardwareId)?.length ?? SCREW.length
        // Through the whole board when a meets b with its face; a piece met by its edge has no outside face to start from.
        const through = depth(a) < length ? depth(a) : length / 2
        for (const center of m.points(count, plane + toward * (length / 2 - through))) parts.push({ kind: 'screw', owner: u.a, center, axis: face, length, diameter, outward: back })
        for (const center of m.points(count, plane)) parts.push({ kind: 'hole', owner: u.b, center, axis: face, outward: back, diameter: pilot })
      }
      // The shelf rests on its pins, so they sit just under it; only on an upright, where under is down.
      if (u.type === 'shelf-pin' && face === 'x') {
        for (const center of m.points(count, plane + toward * (SHELF_PIN.length / 2 - SHELF_PIN.out))) {
          center[1] = a.y0 - SHELF_PIN.diameter / 2
          parts.push({ kind: 'shelf-pin', owner: u.b, center, axis: face, length: SHELF_PIN.length, diameter: SHELF_PIN.diameter })
        }
      }
    }
    if (u.type === 'cup-hinge') {
      const door = a
      const onLeft = Math.abs((b.x0 + b.x1) / 2 - door.x0) <= Math.abs((b.x0 + b.x1) / 2 - door.x1)
      const x = onLeft ? door.x0 + CUP_INSET : door.x1 - CUP_INSET
      const height = door.y1 - door.y0
      const n = hingesFor(height)
      const span = height - 2 * HINGE_FROM_END
      for (let i = 0; i < n; i++)
        parts.push({ kind: 'hinge', owner: u.a, center: [x, door.y0 + HINGE_FROM_END + (n > 1 ? (span * i) / (n - 1) : span / 2), door.z0], diameter: CUP_DIAMETER, depth: CUP_DEPTH })
    }
  }
  return parts
}
