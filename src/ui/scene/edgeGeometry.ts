import { BufferGeometry, Float32BufferAttribute } from 'three'
import { EDGE_SIDE } from '../../domain/design/edges'
import type { Axis, Edge } from '../../domain/design/schema'

/** A profile on one edge, in meters; both arrises of the edge take it. */
export interface EdgeShape {
  edge: Edge
  radius: number
  round: boolean
}

const AXES: Axis[] = ['x', 'y', 'z']
/** (u, v) axes of the faces that look along each axis, as BoxGeometry maps its textures. */
const UV: Record<Axis, [Axis, Axis]> = { x: ['z', 'y'], y: ['x', 'z'], z: ['x', 'y'] }
const STEPS = 4

type Point = Record<Axis, number>

/** The material a face takes in a BoxGeometry: +x, −x, +y, −y, +z, −z. */
const materialOf = (axis: Axis, end: 0 | 1) => AXES.indexOf(axis) * 2 + (end ? 0 : 1)

/**
 * A piece of this size (in meters) whose face edges are cut to a chamfer or a round, in a unit cube so the mesh can still be scaled by the size.
 * It is a stack of rectangles along the thickness, each inset by what every side's profile removes at that height, with the same six materials as a box.
 */
export function profiledGeometry(size: Record<Axis, number>, normal: Axis, shapes: EdgeShape[]) {
  const [a, b] = AXES.filter((axis) => axis !== normal)
  const thickness = size[normal]
  const reach = Math.min(thickness / 2, size[a] / 4, size[b] / 4) * 0.98
  const on = (axis: Axis, end: 0 | 1) => {
    const shape = shapes.find((s) => EDGE_SIDE[s.edge].axis === axis && EDGE_SIDE[s.edge].end === end)
    return shape && { round: shape.round, radius: Math.min(shape.radius, reach) }
  }
  const inset = (side: ReturnType<typeof on>, y: number) => {
    if (!side) return 0
    const d = Math.min(y, thickness - y)
    if (d >= side.radius) return 0
    return side.round ? side.radius - Math.sqrt(Math.max(0, side.radius ** 2 - (side.radius - d) ** 2)) : side.radius - d
  }

  const heights = new Set<number>([0, thickness])
  for (const shape of shapes) {
    const r = Math.min(shape.radius, reach)
    const steps = shape.round ? Array.from({ length: STEPS + 1 }, (_, k) => r * (1 - Math.cos((k / STEPS) * (Math.PI / 2)))) : [0, r]
    for (const y of steps) [y, thickness - y].forEach((h) => heights.add(Math.round(h * 1e9) / 1e9))
  }
  const levels = [...heights].sort((p, q) => p - q)

  const sides = { a0: on(a, 0), a1: on(a, 1), b0: on(b, 0), b1: on(b, 1) }
  const corner = (y: number, ca: 0 | 1, cb: 0 | 1): Point => {
    const p = { x: 0, y: 0, z: 0 }
    p[normal] = y / thickness - 0.5
    p[a] = ca ? 0.5 - inset(sides.a1, y) / size[a] : -0.5 + inset(sides.a0, y) / size[a]
    p[b] = cb ? 0.5 - inset(sides.b1, y) / size[b] : -0.5 + inset(sides.b0, y) / size[b]
    return p
  }

  const bySurface: { position: number[]; uv: number[] }[] = Array.from({ length: 6 }, () => ({ position: [], uv: [] }))
  const quad = (surface: number, face: Axis, ...q: Point[]) => {
    const [u, v] = UV[face]
    const out = bySurface[surface]
    const outward = surface % 2 === 0 ? 1 : -1
    // Vertices go counterclockwise seen from outside: flip when the corner order faces inward.
    const [e0, e1, e2] = q
    const n = { x: (e1.y - e0.y) * (e2.z - e0.z) - (e1.z - e0.z) * (e2.y - e0.y), y: (e1.z - e0.z) * (e2.x - e0.x) - (e1.x - e0.x) * (e2.z - e0.z), z: (e1.x - e0.x) * (e2.y - e0.y) - (e1.y - e0.y) * (e2.x - e0.x) }
    const flip = n[face] * outward < 0
    const ordered = flip ? [q[0], q[3], q[2], q[1]] : q
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = ordered[i]
      out.position.push(p.x, p.y, p.z)
      out.uv.push(p[u] + 0.5, p[v] + 0.5)
    }
  }

  const bottom = levels[0]
  const top = levels.at(-1)!
  quad(materialOf(normal, 0), normal, corner(bottom, 0, 0), corner(bottom, 1, 0), corner(bottom, 1, 1), corner(bottom, 0, 1))
  quad(materialOf(normal, 1), normal, corner(top, 0, 0), corner(top, 1, 0), corner(top, 1, 1), corner(top, 0, 1))
  for (let i = 0; i < levels.length - 1; i++) {
    const [y0, y1] = [levels[i], levels[i + 1]]
    quad(materialOf(a, 0), a, corner(y0, 0, 0), corner(y0, 0, 1), corner(y1, 0, 1), corner(y1, 0, 0))
    quad(materialOf(a, 1), a, corner(y0, 1, 0), corner(y0, 1, 1), corner(y1, 1, 1), corner(y1, 1, 0))
    quad(materialOf(b, 0), b, corner(y0, 0, 0), corner(y0, 1, 0), corner(y1, 1, 0), corner(y1, 0, 0))
    quad(materialOf(b, 1), b, corner(y0, 0, 1), corner(y0, 1, 1), corner(y1, 1, 1), corner(y1, 0, 1))
  }

  const geometry = new BufferGeometry()
  const position: number[] = []
  const uv: number[] = []
  bySurface.forEach((surface, material) => {
    if (!surface.position.length) return
    geometry.addGroup(position.length / 3, surface.position.length / 3, material)
    position.push(...surface.position)
    uv.push(...surface.uv)
  })
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.computeVertexNormals()
  return geometry
}
