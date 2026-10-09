import type { Axis, Design } from './schema'
import type { Box, Geometry } from './resolve'

// Box arithmetic every check shares: how much two boxes overlap, the box around them all, what holds a horizontal piece up, and the drawers of a design.
// Pure and without rules: validation, repair, viability and the structural rules stand on it.

/** Two faces this close touch: below half a millimetre it is rounding, not a gap. */
export const CONTACT_TOLERANCE = 0.5

/** How far two boxes overlap along an axis; negative, the gap between them. */
export const overlap = (a: Box, b: Box, axis: Axis) => Math.min(a[`${axis}1`], b[`${axis}1`]) - Math.max(a[`${axis}0`], b[`${axis}0`])

/** The box around them all. With none, every side is infinite. */
export function bounds(boxes: Iterable<Box>): Box {
  const list = [...boxes]
  const low = (side: keyof Box) => Math.min(...list.map((b) => b[side]))
  const high = (side: keyof Box) => Math.max(...list.map((b) => b[side]))
  return { x0: low('x0'), x1: high('x1'), y0: low('y0'), y1: high('y1'), z0: low('z0'), z1: high('z1') }
}

/** Each drawer once, by its group: the groups that have a front. */
export const drawerGroups = (design: Design): string[] => [...new Set(design.pieces.filter((p) => p.role === 'drawer-front' && p.group).map((p) => p.group!))]

/** What freeSpan needs to know: the pieces, where they are and which touch. */
interface SpanContext {
  design: Design
  geo: Geometry
  contacts: readonly { a: string; b: string }[]
}

/** From this many times longer front to back than side to side, a horizontal board is a strip: a slat, which spans its own length. */
const STRIP_RATIO = 3
export const isStrip = (box: Box) => box.z1 - box.z0 >= STRIP_RATIO * (box.x1 - box.x0)

/** Where the longest free span of a horizontal piece lies, between upright supports: those touching its ends or holding it from below. Along the furniture's width, or front to back for a slat. */
export function freeStretch(id: string, box: Box, ctx: SpanContext, axis: 'x' | 'z' = 'x'): [number, number] | null {
  const [lo, hi] = [`${axis}0`, `${axis}1`] as const
  const supports = ctx.contacts
    .filter((c) => c.a === id || c.b === id)
    .map((c) => (c.a === id ? c.b : c.a))
    .filter((other) => {
      const piece = ctx.design.pieces.find((p) => p.id === other)
      const o = ctx.geo.boxes.get(other)
      if (!piece || !o || piece.normal !== axis || piece.role === 'door') return false
      return Math.abs(o[hi] - box[lo]) <= CONTACT_TOLERANCE || Math.abs(o[lo] - box[hi]) <= CONTACT_TOLERANCE || Math.abs(o.y1 - box.y0) <= CONTACT_TOLERANCE
    })
    .map((other) => ctx.geo.boxes.get(other)!)
    .sort((a, b) => a[lo] - b[lo])
  let longest: [number, number] | null = null
  for (let i = 1; i < supports.length; i++) {
    const from = Math.max(...supports.slice(0, i).map((a) => a[hi]))
    if (supports[i][lo] - from > (longest ? longest[1] - longest[0] : 0)) longest = [from, supports[i][lo]]
  }
  return longest
}

/** The length of that span; null when the piece has no two supports with room between them. */
export function freeSpan(id: string, box: Box, ctx: SpanContext, axis: 'x' | 'z' = 'x') {
  const stretch = freeStretch(id, box, ctx, axis)
  return stretch ? stretch[1] - stretch[0] : null
}
