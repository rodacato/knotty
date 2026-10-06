import { faceAxes, type Box } from './resolve'
import type { Axis, Slant, SlantLeg } from './schema'

// Corners sawn off a piece on a slant. They are only drawn: the piece is still the whole board for the cut list, the purchase and the checks.

export type Point = [number, number]

/** The corners of a face, counterclockwise on its two axes from the one at the start of both: which end each is at. */
const CORNERS: ['start' | 'end', 'start' | 'end'][] = [['start', 'start'], ['end', 'start'], ['end', 'end'], ['start', 'end']]

const reach = (leg: SlantLeg, edge: number) => ('leave' in leg ? Math.max(0, edge - leg.leave) : Math.min(leg.length, edge))

/**
 * What is left of a piece's face, in mm on its two axes (in x, y, z order), counterclockwise.
 * A slant longer than the piece stops at its end, and two that meet on an edge share it in proportion.
 */
export function outline(box: Box, normal: Axis, slants: Slant[]): Point[] {
  const [a, b] = faceAxes(normal)
  const [a0, a1, b0, b1] = [box[`${a}0`], box[`${a}1`], box[`${b}0`], box[`${b}1`]]
  const legs = CORNERS.map(([atA, atB]): Point => {
    const slant = slants.find((s) => s[a]?.from === atA && s[b]?.from === atB)
    if (!slant) return [0, 0]
    const legs: Point = [reach(slant[a]!, a1 - a0), reach(slant[b]!, b1 - b0)]
    return legs[0] > 0 && legs[1] > 0 ? legs : [0, 0]
  })
  // Each edge is shared by two corners: bottom and top along a, right and left along b.
  for (const [axis, length, pairs] of [[0, a1 - a0, [[0, 1], [3, 2]]], [1, b1 - b0, [[1, 2], [0, 3]]]] as const)
    for (const [p, q] of pairs) {
      const sum = legs[p][axis] + legs[q][axis]
      if (sum > length) [legs[p][axis], legs[q][axis]] = [(legs[p][axis] * length) / sum, (legs[q][axis] * length) / sum]
    }
  const points: Point[] = [
    [a0, b0 + legs[0][1]], [a0 + legs[0][0], b0],
    [a1 - legs[1][0], b0], [a1, b0 + legs[1][1]],
    [a1, b1 - legs[2][1]], [a1 - legs[2][0], b1],
    [a0 + legs[3][0], b1], [a0, b1 - legs[3][1]],
  ]
  return points.filter(([u, v], i) => {
    const [nu, nv] = points[(i + 1) % points.length]
    return Math.abs(u - nu) > 1e-9 || Math.abs(v - nv) > 1e-9
  })
}

/** The area of an outline, in mm². */
export const outlineArea = (points: Point[]) => Math.abs(points.reduce((sum, [u, v], i) => sum + u * points[(i + 1) % points.length][1] - points[(i + 1) % points.length][0] * v, 0)) / 2
