import { hingesFor } from '../structure/assumptions'
import type { Diseno } from './esquema'
import type { Box } from './resolve'

// Where the hardware sits, to draw it: runners in the gap beside each drawer, hinge cups on the inside of each door.

/** A runner is about this tall; the model does not say, the common 45 mm ones are. */
const RUNNER_HEIGHT = 45
const CUP_DIAMETER = 35
const CUP_DEPTH = 12
/** From the door's edge to the center of the cup, and from its ends to the first and last hinge. */
const CUP_INSET = 22.5
const HINGE_FROM_END = 100

export type HardwarePart =
  /** Moves with `owner` in the exploded view. */
  | { kind: 'runner'; owner: string; box: Box }
  | { kind: 'hinge'; owner: string; center: [number, number, number]; diameter: number; depth: number }

export function hardwareParts(design: Diseno, boxes: Map<string, Box>): HardwarePart[] {
  const parts: HardwarePart[] = []
  for (const u of design.uniones) {
    const a = boxes.get(u.a)
    const b = boxes.get(u.b)
    if (!a || !b) continue
    if (u.tipo === 'corredera') {
      // The drawer side and its support, whichever order the joint names them in.
      const [side, support] = design.piezas.find((p) => p.id === u.a)?.grupo ? [a, b] : [b, a]
      const [x0, x1] = side.x0 >= support.x1 ? [support.x1, side.x0] : [side.x1, support.x0]
      if (x1 - x0 <= 0) continue
      const middle = (side.y0 + side.y1) / 2
      const height = Math.min(RUNNER_HEIGHT, side.y1 - side.y0)
      parts.push({ kind: 'runner', owner: side === a ? u.a : u.b, box: { x0, x1, y0: middle - height / 2, y1: middle + height / 2, z0: side.z0, z1: side.z1 } })
    }
    if (u.tipo === 'bisagra-cazoleta') {
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
