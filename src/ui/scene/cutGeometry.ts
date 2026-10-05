import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from 'three'
import { cutGrid } from '../../domain/design/cuts'
import type { Box } from '../../domain/design/resolve'

/** How BoxGeometry maps a face's uv from its position, read off the geometry itself so the wood keeps its grain. */
type UvMap = { axis: number; flip: boolean }

const reference = new BoxGeometry(1, 1, 1)
const refPos = reference.getAttribute('position')
const refNormal = reference.getAttribute('normal')
const refUv = reference.getAttribute('uv')

function uvMaps(face: number): [UvMap, UvMap] {
  const find = (channel: 0 | 1): UvMap => {
    for (let axis = 0; axis < 3; axis++)
      for (const flip of [false, true]) {
        const ok = [0, 1, 2, 3].every((k) => {
          const at = face * 4 + k
          const p = [refPos.getX(at), refPos.getY(at), refPos.getZ(at)][axis] + 0.5
          const uv = channel === 0 ? refUv.getX(at) : refUv.getY(at)
          return Math.abs(uv - (flip ? 1 - p : p)) < 1e-6
        })
        if (ok) return { axis, flip }
      }
    throw new Error('unmapped box face')
  }
  return [find(0), find(1)]
}
export const UV_MAPS = [0, 1, 2, 3, 4, 5].map(uvMaps)
/** The cell a face looks at: +x, −x, +y, −y, +z, −z. */
const LOOKS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]

/**
 * The mesh of a piece with boxes taken away, in a unit cube so it can still be scaled by the size.
 * Only the faces that show are made, with the six materials and the uv of the whole piece, so the grain runs on across a cut.
 */
export function cutGeometry(whole: Box, cuts: Box[]) {
  const grid = cutGrid(whole, cuts)
  const [xs, ys, zs] = grid.planes
  const lo = [whole.x0, whole.y0, whole.z0]
  const size = [whole.x1 - whole.x0, whole.y1 - whole.y0, whole.z1 - whole.z0]
  const position: number[] = []
  const normal: number[] = []
  const uv: number[] = []
  const index: number[] = []
  const geometry = new BufferGeometry()
  for (let face = 0; face < 6; face++) {
    const start = index.length
    const [dx, dy, dz] = LOOKS[face]
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++)
        for (let k = 0; k < zs.length - 1; k++) {
          if (!grid.solid(i, j, k) || grid.solid(i + dx, j + dy, k + dz)) continue
          const from = [xs[i], ys[j], zs[k]].map((v, a) => (v - lo[a]) / size[a])
          const to = [xs[i + 1], ys[j + 1], zs[k + 1]].map((v, a) => (v - lo[a]) / size[a])
          const base = position.length / 3
          for (let n = 0; n < 4; n++) {
            const at = face * 4 + n
            const unit = [refPos.getX(at), refPos.getY(at), refPos.getZ(at)]
            const frac = unit.map((u, a) => from[a] + (u + 0.5) * (to[a] - from[a]))
            position.push(...frac.map((f) => f - 0.5))
            normal.push(refNormal.getX(at), refNormal.getY(at), refNormal.getZ(at))
            const [mu, mv] = UV_MAPS[face]
            uv.push(mu.flip ? 1 - frac[mu.axis] : frac[mu.axis], mv.flip ? 1 - frac[mv.axis] : frac[mv.axis])
          }
          for (let n = 0; n < 6; n++) index.push(base + (reference.index!.getX(face * 6 + n) - face * 4))
        }
    geometry.addGroup(start, index.length - start, face)
  }
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setIndex(index)
  return geometry
}
