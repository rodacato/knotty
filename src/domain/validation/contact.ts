import { AXES, type Axis } from '../design/schema'
import type { Box } from '../design/resolve'

// Which pieces touch, overlap or face each other across a gap: the geometry every other check stands on.

export const CONTACT_TOLERANCE = 0.5

export interface Contact {
  a: string
  b: string
  /** The axis along which their faces touch; null when they overlap. */
  axis: Axis | null
  /** The smallest overlap along any axis: how far they go into each other (0 when they only touch). */
  depth: number
}

const overlap = (a: Box, b: Box, axis: Axis) => Math.min(a[`${axis}1`], b[`${axis}1`]) - Math.max(a[`${axis}0`], b[`${axis}0`])

export function contactBetween(idA: string, a: Box, idB: string, b: Box): Contact | null {
  const o = AXES.map((e) => overlap(a, b, e))
  if (o.every((v) => v > CONTACT_TOLERANCE)) return { a: idA, b: idB, axis: null, depth: Math.min(...o) }
  const touching = AXES.findIndex((_, i) => Math.abs(o[i]) <= CONTACT_TOLERANCE && o.every((v, j) => j === i || v > CONTACT_TOLERANCE))
  return touching < 0 ? null : { a: idA, b: idB, axis: AXES[touching], depth: 0 }
}

export function contacts(boxes: Map<string, Box>): Contact[] {
  const list = [...boxes]
  const found: Contact[] = []
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const c = contactBetween(list[i][0], list[i][1], list[j][0], list[j][1])
      if (c) found.push(c)
    }
  return found
}

export const samePair = (c: { a: string; b: string }, a: string, b: string) => (c.a === a && c.b === b) || (c.a === b && c.b === a)

/** How long the joint between two touching pieces is: the longer side of the rectangle where they meet. */
export function jointLength(a: Box, b: Box): number {
  const contact = contactBetween('a', a, 'b', b)
  if (!contact) return 0
  const sides = AXES.filter((e) => e !== contact.axis).map((e) => overlap(a, b, e))
  return Math.max(0, ...sides)
}

/** Two pieces facing each other across a gap along a single axis, like a drawer and the side that carries its runner. */
export function gapBetween(a: Box, b: Box): { axis: Axis; distance: number } | null {
  const o = AXES.map((e) => overlap(a, b, e))
  const apart = AXES.findIndex((_, i) => o[i] < -CONTACT_TOLERANCE && o.every((v, j) => j === i || v > CONTACT_TOLERANCE))
  return apart < 0 ? null : { axis: AXES[apart], distance: -o[apart] }
}
