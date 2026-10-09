import type { Box } from '../../domain/design/resolve'
import type { Offset } from '../scene/explode'

// The pieces apart as a line drawing: it prints as ink, with no 3D behind it. All in the design's axes: x to the right, y up, z to the front.

type Point = [number, number]
type Face = 'x0' | 'x1' | 'y1' | 'z0' | 'z1'

export type Angle = 'right' | 'left' | 'back' | 'front' | 'top'

interface View {
  name: string
  project(x: number, y: number, z: number): Point
  /** How much nearer the eye a point is for each step along x, y and z. */
  near: Offset
  /** The faces in sight, sides first and the top last. */
  faces: Face[]
}

const COS = Math.cos(Math.PI / 6)

export const VIEWS: Record<Angle, View> = {
  right: { name: 'De frente, por la derecha', project: (x, y, z) => [(x - z) * COS, (x + z) / 2 - y], near: [1, 1, 1], faces: ['x1', 'z1', 'y1'] },
  left: { name: 'De frente, por la izquierda', project: (x, y, z) => [(x + z) * COS, (z - x) / 2 - y], near: [-1, 1, 1], faces: ['x0', 'z1', 'y1'] },
  back: { name: 'Desde atrás', project: (x, y, z) => [(z - x) * COS, -(x + z) / 2 - y], near: [-1, 1, -1], faces: ['x0', 'z0', 'y1'] },
  front: { name: 'De frente', project: (x, y) => [x, -y], near: [0, 0, 1], faces: ['z1'] },
  top: { name: 'Desde arriba', project: (x, _, z) => [x, z], near: [0, 1, 0], faces: ['y1'] },
}

export interface DrawnPiece {
  id: string
  /** Each face in sight as the points of an SVG polygon, with which way it looks. */
  faces: { points: string; looks: 'side' | 'front' | 'up' }[]
  /** Where its number goes, and the number of its line in the cut list; null when no line cuts it. */
  badge: Point
  number: number | null
}

export interface Diagram {
  width: number
  height: number
  /** Back to front, so each one covers what is behind it. */
  pieces: DrawnPiece[]
}

const LOOKS = { x0: 'side', x1: 'side', z0: 'front', z1: 'front', y1: 'up' } as const

function corners(b: Box, face: Face): Offset[] {
  if (face === 'y1') return [[b.x0, b.y1, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]]
  if (face === 'x0' || face === 'x1') return [[b[face], b.y0, b.z0], [b[face], b.y0, b.z1], [b[face], b.y1, b.z1], [b[face], b.y1, b.z0]]
  return [[b.x0, b.y0, b[face]], [b.x1, b.y0, b[face]], [b.x1, b.y1, b[face]], [b.x0, b.y1, b[face]]]
}

const MARGIN = 0.04

/** Every piece pushed away from the middle of the furniture, further the further it already is: two boards that touch end up with air between them, so they never read as one longer board. */
export function spreadApart(boxes: Map<string, Box>, factor: number): Map<string, Offset> {
  const centers = new Map([...boxes].map(([id, b]) => [id, [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2] as Offset]))
  const all = [...boxes.values()]
  if (!all.length) return new Map()
  const middle = [
    (Math.min(...all.map((b) => b.x0)) + Math.max(...all.map((b) => b.x1))) / 2,
    (Math.min(...all.map((b) => b.y0)) + Math.max(...all.map((b) => b.y1))) / 2,
    (Math.min(...all.map((b) => b.z0)) + Math.max(...all.map((b) => b.z1))) / 2,
  ]
  return new Map([...centers].map(([id, c]) => [id, c.map((at, axis) => (at - middle[axis]) * (factor - 1)) as Offset]))
}

/** Every piece that has a box, moved by its offset and drawn as that box: a slanted or rounded board shows as its rectangle. */
export function drawDiagram(boxes: Map<string, Box>, offsets: Map<string, Offset>, numbers: Map<string, number>, angle: Angle = 'right'): Diagram {
  const view = VIEWS[angle]
  const drawn = [...boxes].map(([id, box]) => {
    const [dx, dy, dz] = offsets.get(id) ?? [0, 0, 0]
    const moved = { x0: box.x0 + dx, x1: box.x1 + dx, y0: box.y0 + dy, y1: box.y1 + dy, z0: box.z0 + dz, z1: box.z1 + dz }
    const center: Offset = [(moved.x0 + moved.x1) / 2, (moved.y0 + moved.y1) / 2, (moved.z0 + moved.z1) / 2]
    return {
      id,
      faces: view.faces.map((face) => ({ looks: LOOKS[face], points: corners(moved, face).map((c) => view.project(...c)) })),
      badge: view.project(...center),
      near: center[0] * view.near[0] + center[1] * view.near[1] + center[2] * view.near[2],
    }
  })
  if (!drawn.length) return { width: 0, height: 0, pieces: [] }
  const points = drawn.flatMap((d) => d.faces.flatMap((f) => f.points))
  const [left, top] = [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1]))]
  const [right, bottom] = [Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))]
  const pad = Math.max(right - left, bottom - top) * MARGIN
  const placed = ([x, y]: Point): Point => [Math.round(x - left + pad), Math.round(y - top + pad)]
  return {
    width: Math.round(right - left + 2 * pad),
    height: Math.round(bottom - top + 2 * pad),
    pieces: drawn
      .sort((a, b) => a.near - b.near)
      .map((d) => ({ id: d.id, faces: d.faces.map((f) => ({ looks: f.looks, points: f.points.map((p) => placed(p).join(',')).join(' ') })), badge: placed(d.badge), number: numbers.get(d.id) ?? null })),
  }
}
