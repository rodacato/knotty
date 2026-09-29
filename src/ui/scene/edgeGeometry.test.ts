import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'
import { profiledGeometry, type EdgeShape } from './edgeGeometry'

const SHELF = { x: 0.8, y: 0.018, z: 0.3 }
const unit = (g: BufferGeometry) => {
  g.computeBoundingBox()
  return g.boundingBox!
}

/** Every triangle must face away from the middle of the piece, or it is drawn inside out. */
function facesOutward(g: BufferGeometry) {
  const p = g.getAttribute('position')
  const n = g.getAttribute('normal')
  let inward = 0
  for (let i = 0; i < p.count; i += 3) {
    const centroid = [0, 1, 2].map((axis) => [0, 1, 2].reduce((sum, k) => sum + [p.getX, p.getY, p.getZ][axis].call(p, i + k), 0) / 3)
    const normal = [n.getX(i), n.getY(i), n.getZ(i)]
    if (centroid.reduce((sum, c, axis) => sum + c * normal[axis], 0) < 0) inward++
  }
  return inward
}

describe('profiledGeometry', () => {
  it('without profiles is the unit box: 12 triangles, six materials', () => {
    const g = profiledGeometry(SHELF, 'y', [])
    const box = unit(g)
    expect([box.min.x, box.max.x, box.min.y, box.max.y]).toEqual([-0.5, 0.5, -0.5, 0.5])
    expect(g.getAttribute('position').count).toBe(36)
    expect(g.groups.map((x) => x.materialIndex).sort()).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('a chamfer on the front edge insets both faces by its radius, at real scale', () => {
    const shapes: EdgeShape[] = [{ edge: 'front', radius: 0.003, round: false }]
    const g = profiledGeometry(SHELF, 'y', shapes)
    const p = g.getAttribute('position')
    const zs = Array.from({ length: p.count }, (_, i) => p.getZ(i))
    expect(Math.max(...zs)).toBeCloseTo(0.5, 6)
    const top = Array.from({ length: p.count }, (_, i) => i).filter((i) => Math.abs(p.getY(i) - 0.5) < 1e-9)
    expect(Math.max(...top.map((i) => p.getZ(i)))).toBeCloseTo(0.5 - 0.003 / SHELF.z, 6)
  })

  it('a round and a chamfer both face outward everywhere', () => {
    for (const round of [true, false]) {
      const g = profiledGeometry(SHELF, 'y', [
        { edge: 'front', radius: 0.003, round },
        { edge: 'left', radius: 0.003, round },
        { edge: 'right', radius: 0.003, round },
      ])
      expect(facesOutward(g)).toBe(0)
    }
  })

  it('a radius the board cannot hold is held back so the pieces never cross', () => {
    const g = profiledGeometry({ x: 0.8, y: 0.006, z: 0.3 }, 'y', [{ edge: 'front', radius: 0.006, round: true }])
    const p = g.getAttribute('position')
    for (let i = 0; i < p.count; i++) expect(Number.isFinite(p.getZ(i))).toBe(true)
    expect(facesOutward(g)).toBe(0)
  })

  it('works for a piece whose thickness runs along x', () => {
    const g = profiledGeometry({ x: 0.018, y: 0.9, z: 0.3 }, 'x', [{ edge: 'top', radius: 0.003, round: false }])
    expect(facesOutward(g)).toBe(0)
  })
})
