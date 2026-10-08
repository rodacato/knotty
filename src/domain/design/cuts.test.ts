import { describe, expect, it } from 'vitest'
import { cutBox, cutGrid, holeCuts, woodLeft } from './cuts'

const board = { x0: 0, x1: 100, y0: 0, y1: 60, z0: 0, z1: 18 }
const volume = (b: typeof board) => (b.x1 - b.x0) * (b.y1 - b.y0) * (b.z1 - b.z0)

describe('cuts', () => {
  it('a span is measured from the start, the end or the middle of the piece, and follows it when it grows', () => {
    const cut = { x: { from: 'center' as const, offset: 0, length: 20 }, y: { from: 'end' as const, offset: 0, length: 10 }, z: { from: 'end' as const, offset: 0, length: 6 } }
    expect(cutBox(board, cut)).toEqual({ x0: 40, x1: 60, y0: 50, y1: 60, z0: 12, z1: 18 })
    expect(cutBox({ ...board, x1: 200, y1: 100 }, cut)).toMatchObject({ x0: 90, x1: 110, y0: 90, y1: 100 })
    expect(cutBox(board, { ...cut, x: { from: 'start', offset: 5, length: 3 } })).toMatchObject({ x0: 5, x1: 8 })
  })

  it('the wood left is the box less the cuts, and a cut that sticks out of it takes only what was inside', () => {
    const groove = { x0: 10, x1: 16, y0: -1, y1: 61, z0: 12, z1: 19 }
    expect(woodLeft(board, [groove])).toBe(volume(board) - 6 * 60 * 6)
    expect(woodLeft(board, [groove, { ...groove, x0: 30, x1: 36 }])).toBe(volume(board) - 2 * 6 * 60 * 6)
    expect(woodLeft(board, [{ x0: 200, x1: 210, y0: 0, y1: 10, z0: 0, z1: 5 }])).toBe(volume(board))
  })

  it('two cuts that cross take their union once', () => {
    const a = { x0: 10, x1: 30, y0: 10, y1: 30, z0: 0, z1: 18 }
    const b = { x0: 20, x1: 40, y0: 20, y1: 40, z0: 0, z1: 18 }
    expect(woodLeft(board, [a, b])).toBe(volume(board) - (20 * 20 + 20 * 20 - 10 * 10) * 18)
  })

  it('neighbouring cells of wood are known, so the faces between them are not drawn', () => {
    const grid = cutGrid(board, [{ x0: 40, x1: 60, y0: 30, y1: 70, z0: 6, z1: 18 }])
    const [xs, ys, zs] = grid.planes
    expect(xs).toEqual([0, 40, 60, 100])
    expect(ys).toEqual([0, 30, 60])
    expect(zs).toEqual([0, 6, 18])
    expect(grid.solid(1, 1, 1)).toBe(false)
    expect(grid.solid(1, 1, 0)).toBe(true)
    expect(grid.solid(-1, 0, 0)).toBe(false)
  })
})

describe('a round hole', () => {
  const back = { x0: 100, x1: 700, y0: 50, y1: 450, z0: 0, z1: 3 }
  const strips = holeCuts(back, 'z', [400, 150], 60).map((cut) => cutBox(back, cut))

  it('goes through the whole thickness and stays inside the square its diameter draws around its center', () => {
    expect(strips.every((s) => s.z0 === 0 && s.z1 === 3)).toBe(true)
    expect([Math.min(...strips.map((s) => s.x0)), Math.max(...strips.map((s) => s.x1))]).toEqual([370, 430])
    expect(strips.every((s) => s.y0 >= 120 && s.y1 <= 180 && (s.y0 + s.y1) / 2 === 150)).toBe(true)
  })

  it('takes out about what a circle would, with nothing left over where two strips meet', () => {
    const gone = volume(back) - woodLeft(back, strips)
    expect(gone / (Math.PI * 30 * 30 * 3)).toBeCloseTo(1, 1)
    expect(gone).toBeCloseTo(strips.reduce((sum, s) => sum + volume(s), 0))
  })
})
