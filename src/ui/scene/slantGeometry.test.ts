import { describe, expect, it } from 'vitest'
import { holeOutline, outline, outlineArea } from '../../domain/design/slants'
import type { Slant } from '../../domain/design/schema'
import { slantGeometry } from './slantGeometry'

const leg = { x0: 100, x1: 118, y0: 0, y1: 200, z0: 50, z1: 150 }
const taper: Slant = { x: null, y: { from: 'start', length: 120 }, z: { from: 'end', length: 40 } }

/** Each triangle as its three corners, and the normal its corners were given. */
function triangles(g: ReturnType<typeof slantGeometry>) {
  const [p, n, index] = [g.getAttribute('position'), g.getAttribute('normal'), g.getIndex()!]
  return Array.from({ length: index.count / 3 }, (_, t) => {
    const corners = [0, 1, 2].map((k) => index.getX(t * 3 + k))
    return { points: corners.map((i) => [p.getX(i), p.getY(i), p.getZ(i)]), normal: [n.getX(corners[0]), n.getY(corners[0]), n.getZ(corners[0])] }
  })
}
const cross = (u: number[], v: number[]) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
const dot = (u: number[], v: number[]) => u.reduce((sum, c, i) => sum + c * v[i], 0)
const minus = (u: number[], v: number[]) => u.map((c, i) => c - v[i])

describe('slantGeometry', () => {
  for (const normal of ['x', 'y', 'z'] as const) {
    it(`a piece lying across ${normal} is closed and drawn the right way out`, () => {
      const box = normal === 'x' ? leg : normal === 'y' ? { x0: 0, x1: 300, y0: 0, y1: 18, z0: 0, z1: 100 } : { x0: 0, x1: 300, y0: 0, y1: 100, z0: 0, z1: 18 }
      const slant: Slant = normal === 'x' ? taper : normal === 'y' ? { x: { from: 'end', length: 50 }, y: null, z: { from: 'end', length: 30 } } : { x: { from: 'end', length: 50 }, y: { from: 'start', length: 30 }, z: null }
      const all = triangles(slantGeometry(box, normal, outline(box, normal, [slant])))
      // Five corners: three triangles on each face, two on each of the five edges.
      expect(all).toHaveLength(2 * 3 + 5 * 2)
      for (const { points, normal: given } of all) {
        const wound = cross(minus(points[1], points[0]), minus(points[2], points[0]))
        expect(dot(wound, given)).toBeGreaterThan(0)
        expect(dot(points[0], given)).toBeGreaterThan(0)
      }
    })
  }

  it('stays in the unit cube and keeps the six materials of a box, the slanted edge on the side it mostly faces', () => {
    const g = slantGeometry(leg, 'x', outline(leg, 'x', [taper]))
    g.computeBoundingBox()
    expect([...g.boundingBox!.min.toArray(), ...g.boundingBox!.max.toArray()]).toEqual([-0.5, -0.5, -0.5, 0.5, 0.5, 0.5])
    expect(g.groups.map((x) => x.materialIndex)).toEqual([0, 1, 2, 3, 4, 5])
    // 120 along the height for 40 across: it faces the front (+z) more than the floor.
    const front = g.groups[4]
    expect(front.count).toBe(2 * 3 * 2)
  })
})

describe('a piece with a hole through it', () => {
  const top = { x0: 0, x1: 1200, y0: 732, y1: 750, z0: 0, z1: 600 }
  const hole = holeOutline(top, 'y', { x: 600, y: null, z: 80, diameter: 60 })
  const rounded = outline(top, 'y', [], [{ x: 'end', y: null, z: 'end', radius: 40 }])
  const all = triangles(slantGeometry(top, 'y', rounded, [hole]))
  const area = ({ points }: (typeof all)[number]) => Math.hypot(...cross(minus(points[1], points[0]), minus(points[2], points[0]))) / 2

  it('keeps its rounded corner and loses the hole on both faces', () => {
    const faces = all.filter((t) => Math.abs(t.normal[1]) > 0.99)
    const left = (outlineArea(rounded) - outlineArea(hole)) / (1200 * 600)
    for (const side of [1, -1]) expect(faces.filter((t) => t.normal[1] * side > 0).reduce((sum, t) => sum + area(t), 0)).toBeCloseTo(left, 5)
  })

  it('walls the hole all round, each wall looking into it, and every triangle is drawn the right way out', () => {
    const center = [600 / 1200 - 0.5, 0, 80 / 600 - 0.5]
    const walls = all.filter((t) => Math.abs(t.normal[1]) < 0.01 && t.points.every((p) => Math.hypot((p[0] - center[0]) * 1200, (p[2] - center[2]) * 600) < 31))
    expect(walls).toHaveLength(hole.length * 2)
    for (const { points, normal } of walls) expect(dot(minus(center, [points[0][0], 0, points[0][2]]), [normal[0] / 1200, 0, normal[2] / 600])).toBeGreaterThan(0)
    for (const { points, normal } of all) expect(dot(cross(minus(points[1], points[0]), minus(points[2], points[0])), normal)).toBeGreaterThan(0)
  })
})
