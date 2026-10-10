import { faceAxes, type Box } from '../../domain/design/resolve'
import type { Axis } from '../../domain/design/schema'
import type { Offset } from '../scene/explode'

// The pieces apart as a line drawing: it prints as ink, with no 3D behind it. All in the design's axes: x to the right, y up, z to the front.

type Point = [number, number]

export type Angle = 'right' | 'left' | 'back' | 'front' | 'top'

interface View {
  name: string
  project(x: number, y: number, z: number): Point
  /** How much nearer the eye a point is for each step along x, y and z. */
  near: Offset
}

/** A board that is not its whole rectangle: what is left of its face, in mm on the face's two axes, counterclockwise. */
export interface Shape {
  normal: Axis
  points: Point[]
}

const COS = Math.cos(Math.PI / 6)

export const VIEWS: Record<Angle, View> = {
  right: { name: 'De frente, por la derecha', project: (x, y, z) => [(x - z) * COS, (x + z) / 2 - y], near: [1, 1, 1] },
  left: { name: 'De frente, por la izquierda', project: (x, y, z) => [(x + z) * COS, (z - x) / 2 - y], near: [-1, 1, 1] },
  back: { name: 'Desde atrás', project: (x, y, z) => [(z - x) * COS, -(x + z) / 2 - y], near: [-1, 1, -1] },
  front: { name: 'De frente', project: (x, y) => [x, -y], near: [0, 0, 1] },
  top: { name: 'Desde arriba', project: (x, _, z) => [x, z], near: [0, 1, 0] },
}

export interface DrawnPiece {
  id: string
  /** Each face in sight as the points of an SVG polygon, with which way it looks. */
  faces: { points: string; looks: 'side' | 'front' | 'up' }[]
  /** Where its number goes, and the number of its line in the cut list; null when no line cuts it. */
  badge: Point
  number: number | null
  /** One of the pieces the drawing is about, when it marks some: the rest are drawn fainter. */
  marked: boolean
  /** Its number lands on the piece itself: false when a nearer piece covers that spot, where the number would read as the other's. */
  seen: boolean
}

export interface Diagram {
  width: number
  height: number
  /** The radius of a number. */
  dot: number
  /** Back to front, so each one covers what is behind it. */
  pieces: DrawnPiece[]
}

const AXES = ['x', 'y', 'z'] as const
const LOOKS = { x: 'side', y: 'up', z: 'front' } as const

/** The faces of a board the eye sees: the two of its outline and a wall for each of its edges, less the ones that look away. */
function facesInSight(box: Box, shape: Shape | undefined, near: Offset): { looks: 'side' | 'front' | 'up'; corners: Offset[] }[] {
  const normal = shape?.normal ?? 'y'
  const [a, b] = faceAxes(normal).map((axis) => AXES.indexOf(axis))
  const n = AXES.indexOf(normal)
  const points: Point[] = shape?.points ?? [[box.x0, box.z0], [box.x1, box.z0], [box.x1, box.z1], [box.x0, box.z1]]
  const at = ([u, v]: Point, end: number): Offset => {
    const p: Offset = [0, 0, 0]
    p[a] = u
    p[b] = v
    p[n] = end
    return p
  }
  const out = (onA: number, onB: number, onN: number): Offset => {
    const o: Offset = [0, 0, 0]
    o[a] = onA
    o[b] = onB
    o[n] = onN
    return o
  }
  const [lo, hi] = [box[`${normal}0`], box[`${normal}1`]]
  const faces = [
    { out: out(0, 0, -1), corners: points.map((p) => at(p, lo)) },
    { out: out(0, 0, 1), corners: points.map((p) => at(p, hi)) },
    ...points.map((p, i) => {
      const q = points[(i + 1) % points.length]
      return { out: out(q[1] - p[1], p[0] - q[0], 0), corners: [at(p, lo), at(q, lo), at(q, hi), at(p, hi)] }
    }),
  ]
  return faces
    .filter((f) => f.out[0] * near[0] + f.out[1] * near[1] + f.out[2] * near[2] > 1e-9)
    .map((f) => ({ looks: LOOKS[AXES[f.out.map(Math.abs).indexOf(Math.max(...f.out.map(Math.abs)))]], corners: f.corners }))
}

function inside([x, y]: Point, polygon: Point[]) {
  return polygon.reduce((within, [px, py], i) => {
    const [qx, qy] = polygon[(i + 1) % polygon.length]
    return py > y !== qy > y && x < px + ((y - py) * (qx - px)) / (qy - py) ? !within : within
  }, false)
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

/**
 * Back to front. A board is behind another when it ends, along some axis the eye looks down, where the other begins: boards that touch are told apart by that,
 * which the distance of their middles gets wrong (a long top is «further» than the divider under it). Among the ones nothing is behind, the furthest middle goes first.
 */
function backToFront<T extends { box: Box; near: number }>(drawn: T[], near: Offset): T[] {
  const behind = (a: Box, b: Box) => AXES.some((axis, i) => (near[i] > 0 ? a[`${axis}1`] <= b[`${axis}0`] : near[i] < 0 ? a[`${axis}0`] >= b[`${axis}1`] : false))
  const left = [...drawn].sort((a, b) => a.near - b.near)
  const ordered: T[] = []
  while (left.length) {
    const next = left.findIndex((candidate) => !left.some((other) => other !== candidate && behind(other.box, candidate.box) && !behind(candidate.box, other.box)))
    ordered.push(...left.splice(Math.max(next, 0), 1))
  }
  return ordered
}

/** How many numbers fit across the drawing. */
const DOTS_ACROSS = 52
/** Two numbers closer than this many radii read as one. */
const CLEAR = 2.2

/**
 * Where each number goes so it covers no other: the short boards keep theirs in the middle, and a longer one moves its own along its length to the first free spot,
 * one that is in sight if it has any. With no room left it stays in the middle.
 */
function clearBadges<T extends { id: string; box: Box; badge: Point }>(ordered: T[], numbers: Map<string, number>, view: View, dot: number, covered: (i: number, at: Point) => boolean): Map<string, Point> {
  const length = (b: Box) => Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0)
  const origin = view.project(0, 0, 0)
  const taken: Point[] = []
  const badges = new Map<string, Point>()
  const numbered = ordered.map((d, i) => ({ d, i })).filter(({ d }) => numbers.has(d.id))
  for (const { d, i } of numbered.sort((a, b) => length(a.d.box) - length(b.d.box))) {
    const axis = AXES.map((e) => d.box[`${e}1`] - d.box[`${e}0`]).indexOf(length(d.box))
    const step = view.project(...(AXES.map((_, k) => (k === axis ? 1 : 0)) as Offset)).map((v, k) => v - origin[k])
    const perMm = Math.hypot(step[0], step[1])
    const stride = perMm > 1e-9 ? (CLEAR * dot) / perMm : Infinity
    const reach = Math.max(0, Math.floor((length(d.box) / 2 - stride / 2) / stride))
    const spots = Array.from({ length: 2 * reach + 1 }, (_, k) => Math.ceil(k / 2) * (k % 2 ? 1 : -1) * stride).map((mm): Point => [d.badge[0] + step[0] * mm, d.badge[1] + step[1] * mm])
    const free = spots.filter((at) => taken.every((other) => Math.hypot(other[0] - at[0], other[1] - at[1]) >= CLEAR * dot))
    const at = free.find((spot) => !covered(i, spot)) ?? free[0] ?? d.badge
    taken.push(at)
    badges.set(d.id, at)
  }
  return badges
}

interface Options {
  /** The pieces the drawing is about. */
  marked?: Set<string>
  /** The boards that are not their whole rectangle; any other is drawn as its box. */
  shapes?: Map<string, Shape>
}

/** Every piece that has a box, moved by its offset. */
export function drawDiagram(boxes: Map<string, Box>, offsets: Map<string, Offset>, numbers: Map<string, number>, angle: Angle = 'right', { marked, shapes }: Options = {}): Diagram {
  const view = VIEWS[angle]
  const drawn = [...boxes].map(([id, box]) => {
    const [dx, dy, dz] = offsets.get(id) ?? [0, 0, 0]
    const moved = { x0: box.x0 + dx, x1: box.x1 + dx, y0: box.y0 + dy, y1: box.y1 + dy, z0: box.z0 + dz, z1: box.z1 + dz }
    const center: Offset = [(moved.x0 + moved.x1) / 2, (moved.y0 + moved.y1) / 2, (moved.z0 + moved.z1) / 2]
    return {
      id,
      box: moved,
      faces: facesInSight(box, shapes?.get(id), view.near).map((face) => ({ looks: face.looks, points: face.corners.map(([x, y, z]) => view.project(x + dx, y + dy, z + dz)) })),
      badge: view.project(...center),
      near: center[0] * view.near[0] + center[1] * view.near[1] + center[2] * view.near[2],
    }
  })
  if (!drawn.length) return { width: 0, height: 0, dot: 0, pieces: [] }
  const points = drawn.flatMap((d) => d.faces.flatMap((f) => f.points))
  const [left, top] = [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1]))]
  const [right, bottom] = [Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))]
  const pad = Math.max(right - left, bottom - top) * MARGIN
  const placed = ([x, y]: Point): Point => [Math.round(x - left + pad), Math.round(y - top + pad)]
  const ordered = backToFront(drawn, view.near)
  const [width, height] = [Math.round(right - left + 2 * pad), Math.round(bottom - top + 2 * pad)]
  const dot = Math.max(width, height) / DOTS_ACROSS
  const covered = (i: number, at: Point) => ordered.slice(i + 1).some((nearer) => nearer.faces.some((f) => inside(at, f.points)))
  const badges = clearBadges(ordered, numbers, view, dot, covered)
  return {
    width,
    height,
    dot,
    pieces: ordered.map((d, i) => ({
      id: d.id,
      faces: d.faces.map((f) => ({ looks: f.looks, points: f.points.map((p) => placed(p).join(',')).join(' ') })),
      badge: placed(badges.get(d.id) ?? d.badge),
      number: numbers.get(d.id) ?? null,
      marked: marked?.has(d.id) ?? false,
      seen: !covered(i, badges.get(d.id) ?? d.badge),
    })),
  }
}
