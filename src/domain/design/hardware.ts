import { hingesFor } from '../checks/structure/assumptions'
import { dowelsAlong } from '../materials/purchase'
import type { Axis, Design } from './schema'
import type { Box } from './resolve'
import { contactBetween } from './validation/contact'

// Where the hardware sits, to draw it: runners in the gap beside each drawer, hinge cups on the inside of each door, wood plugs on the face a dowel goes through.

/** A runner is about this tall; the model does not say, the common 45 mm ones are. */
const RUNNER_HEIGHT = 45
const CUP_DIAMETER = 35
const CUP_DEPTH = 12
/** From the door's edge to the center of the cup, and from its ends to the first and last hinge. */
const CUP_INSET = 22.5
const HINGE_FROM_END = 100
/** A plug closes the hole of an 8 mm dowel, so it is a little wider. */
const PLUG_DIAMETER = 10
/** The plugs keep this far from the ends of the joint, as the dowels do. */
const PLUG_MARGIN = 50
const AXES: Axis[] = ['x', 'y', 'z']
const low = (b: Box, axis: Axis) => b[`${axis}0` as const]
const high = (b: Box, axis: Axis) => b[`${axis}1` as const]

type HardwarePart =
  /** Moves with `owner` in the exploded view. */
  | { kind: 'runner'; owner: string; box: Box }
  | { kind: 'hinge'; owner: string; center: [number, number, number]; diameter: number; depth: number }
  /** On the face of `owner` away from the piece the dowel goes into, looking out along `axis` in the direction `outward`. */
  | { kind: 'plug'; owner: string; center: [number, number, number]; axis: Axis; outward: 1 | -1; diameter: number }

export function hardwareParts(design: Design, boxes: Map<string, Box>): HardwarePart[] {
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
      const contact = contactBetween(u.a, a, u.b, b)
      if (!contact?.axis) continue
      const face = contact.axis
      const outward = (low(b, face) + high(b, face)) / 2 >= (low(a, face) + high(a, face)) / 2 ? -1 : 1
      const around = AXES.filter((e) => e !== face).map((e) => ({ axis: e, lo: Math.max(low(a, e), low(b, e)), hi: Math.min(high(a, e), high(b, e)) }))
      const [along, across] = around[0].hi - around[0].lo >= around[1].hi - around[1].lo ? around : [around[1], around[0]]
      const length = along.hi - along.lo
      const n = dowelsAlong(length)
      const margin = Math.min(PLUG_MARGIN, length / 4)
      for (let i = 0; i < n; i++) {
        const center: [number, number, number] = [0, 0, 0]
        center[AXES.indexOf(face)] = outward === 1 ? high(a, face) : low(a, face)
        center[AXES.indexOf(along.axis)] = along.lo + margin + (n > 1 ? ((length - 2 * margin) * i) / (n - 1) : (length - 2 * margin) / 2)
        center[AXES.indexOf(across.axis)] = (across.lo + across.hi) / 2
        parts.push({ kind: 'plug', owner: u.a, center, axis: face, outward, diameter: PLUG_DIAMETER })
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
