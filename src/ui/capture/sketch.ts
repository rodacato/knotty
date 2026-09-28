import type { Box } from '../../domain/design/resolve'

// A furniture's boxes drawn in oblique projection, from the front, above and to the right: the thumbnail of a base, with no 3D scene.

const AXES = ['x', 'y', 'z'] as const
const DEPTH = 0.5
const ANGLE = Math.PI / 6

export type Face = 'front' | 'top' | 'side'
export interface Polygon {
  id: string
  face: Face
  points: [number, number][]
}

/**
 * Whether A is painted before B: the viewer looks from the front, above and the right, so along any axis that separates them
 * the box on the higher side is nearer. Separated along two axes that disagree, no line of sight crosses both, and neither goes first.
 */
function paintsBefore(a: Box, b: Box) {
  const sides = AXES.flatMap((axis) => (a[`${axis}1`] <= b[`${axis}0`] ? [true] : b[`${axis}1`] <= a[`${axis}0`] ? [false] : []))
  return sides.length > 0 && sides.every(Boolean)
}

/** Where a box lands on the drawing: `at` projects a point. */
function extentOf(b: Box, at: Projection) {
  const corners = [at(b.x0, b.y0, b.z1), at(b.x1, b.y1, b.z0)]
  return { x0: corners[0][0], x1: corners[1][0], y0: corners[1][1], y1: corners[0][1] }
}

type Projection = (x: number, y: number, z: number) => [number, number]

/** Back to front, so each box paints over the ones it hides; only boxes that overlap on the drawing need an order. */
export function paintOrder(boxes: Map<string, Box>, at: Projection = projection(boxes)): string[] {
  const ids = [...boxes.keys()]
  const extents = new Map(ids.map((id) => [id, extentOf(boxes.get(id)!, at)]))
  const overlap = (a: string, b: string) => {
    const [p, q] = [extents.get(a)!, extents.get(b)!]
    return p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1
  }
  const before = new Map(ids.map((id) => [id, new Set<string>()]))
  for (const a of ids) for (const b of ids) if (a !== b && overlap(a, b) && paintsBefore(boxes.get(a)!, boxes.get(b)!)) before.get(b)!.add(a)
  const order: string[] = []
  const left = new Set(ids)
  while (left.size) {
    const ready = [...left].filter((id) => [...before.get(id)!].every((other) => !left.has(other)))
    // A cycle, which boxes that do not intersect cannot make: the one furthest back goes first.
    const next = ready.length ? ready : [[...left].sort((a, b) => boxes.get(a)!.z0 - boxes.get(b)!.z0)[0]]
    for (const id of next) {
      order.push(id)
      left.delete(id)
    }
  }
  return order
}

/** Depth recedes up and to the right, so the top and the right side of each box show. */
function projection(boxes: Map<string, Box>): Projection {
  const front = Math.max(...[...boxes.values()].map((b) => b.z1))
  const dx = DEPTH * Math.cos(ANGLE)
  const dy = DEPTH * Math.sin(ANGLE)
  return (x, y, z) => [x + (front - z) * dx, -y - (front - z) * dy]
}

/** The visible faces of every box, in paint order, in a frame whose top left is 0,0; with its size. */
export function sketch(boxes: Map<string, Box>): { polygons: Polygon[]; width: number; height: number } {
  const at = projection(boxes)
  const polygons = paintOrder(boxes, at).flatMap((id): Polygon[] => {
    const b = boxes.get(id)!
    return [
      { id, face: 'front', points: [at(b.x0, b.y0, b.z1), at(b.x1, b.y0, b.z1), at(b.x1, b.y1, b.z1), at(b.x0, b.y1, b.z1)] },
      { id, face: 'top', points: [at(b.x0, b.y1, b.z1), at(b.x1, b.y1, b.z1), at(b.x1, b.y1, b.z0), at(b.x0, b.y1, b.z0)] },
      { id, face: 'side', points: [at(b.x1, b.y0, b.z1), at(b.x1, b.y0, b.z0), at(b.x1, b.y1, b.z0), at(b.x1, b.y1, b.z1)] },
    ]
  })
  const xs = polygons.flatMap((p) => p.points.map(([x]) => x))
  const ys = polygons.flatMap((p) => p.points.map(([, y]) => y))
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)]
  for (const p of polygons) p.points = p.points.map(([x, y]) => [x - minX, y - minY])
  return { polygons, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY }
}
