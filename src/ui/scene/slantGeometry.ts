import { BufferGeometry, Float32BufferAttribute } from 'three'
import { faceAxes, type Box } from '../../domain/design/resolve'
import { AXES, type Axis } from '../../domain/design/schema'
import type { Point } from '../../domain/design/slants'
import { UV_MAPS } from './cutGeometry'

type Vec = [number, number, number]

/** The material a face takes in a BoxGeometry: +x, −x, +y, −y, +z, −z. */
const materialOf = (axis: number, positive: boolean) => axis * 2 + (positive ? 0 : 1)

/**
 * The mesh of a piece whose face is this outline, in a unit cube so it can still be scaled by the size.
 * It keeps the six materials and the uv of a box: a slanted edge takes the material of the side it mostly faces.
 */
export function slantGeometry(box: Box, normal: Axis, points: Point[]) {
  const [a, b] = faceAxes(normal).map((axis) => AXES.indexOf(axis))
  const n = AXES.indexOf(normal)
  const lo = [box.x0, box.y0, box.z0]
  const size = [box.x1 - box.x0, box.y1 - box.y0, box.z1 - box.z0]
  const at = ([u, v]: Point, end: 0 | 1): Vec => {
    const p: Vec = [0, 0, 0]
    p[a] = (u - lo[a]) / size[a]
    p[b] = (v - lo[b]) / size[b]
    p[n] = end
    return p
  }
  const faces: { corners: Vec[]; out: Vec }[][] = [[], [], [], [], [], []]
  for (const end of [0, 1] as const) {
    const out: Vec = [0, 0, 0]
    out[n] = end ? 1 : -1
    faces[materialOf(n, end === 1)].push({ corners: points.map((p) => at(p, end)), out })
  }
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length]
    const out: Vec = [0, 0, 0]
    out[a] = q[1] - p[1]
    out[b] = p[0] - q[0]
    const length = Math.hypot(out[a], out[b])
    out[a] /= length
    out[b] /= length
    const axis = Math.abs(out[a]) >= Math.abs(out[b]) ? a : b
    faces[materialOf(axis, out[axis] > 0)].push({ corners: [at(p, 0), at(q, 0), at(q, 1), at(p, 1)], out })
  })

  const position: number[] = []
  const normals: number[] = []
  const uv: number[] = []
  const index: number[] = []
  const geometry = new BufferGeometry()
  faces.forEach((group, face) => {
    const start = index.length
    const [mu, mv] = UV_MAPS[face]
    for (const { corners, out } of group) {
      const base = position.length / 3
      // The mesh is scaled by the size afterwards, which turns a normal the other way round: it is stretched here so it comes out square to the face.
      const stretched = out.map((v, axis) => v * size[axis])
      const length = Math.hypot(...stretched)
      for (const c of corners) {
        position.push(c[0] - 0.5, c[1] - 0.5, c[2] - 0.5)
        normals.push(...stretched.map((v) => v / length))
        uv.push(mu.flip ? 1 - c[mu.axis] : c[mu.axis], mv.flip ? 1 - c[mv.axis] : c[mv.axis])
      }
      // The outline is convex, so a fan from its first corner covers it; the winding follows the side the face looks at.
      const [o, p, q] = corners
      const cross = [(p[1] - o[1]) * (q[2] - o[2]) - (p[2] - o[2]) * (q[1] - o[1]), (p[2] - o[2]) * (q[0] - o[0]) - (p[0] - o[0]) * (q[2] - o[2]), (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])]
      const front = cross[0] * out[0] * size[0] + cross[1] * out[1] * size[1] + cross[2] * out[2] * size[2] > 0
      for (let k = 1; k < corners.length - 1; k++) index.push(base, base + (front ? k : k + 1), base + (front ? k + 1 : k))
    }
    geometry.addGroup(start, index.length - start, face)
  })
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setIndex(index)
  return geometry
}
