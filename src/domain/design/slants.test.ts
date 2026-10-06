import { describe, expect, it } from 'vitest'
import { outline, outlineArea } from './slants'
import type { Slant } from './schema'

const leg = { x0: 0, x1: 18, y0: 0, y1: 200, z0: 0, z1: 100 }
const corner = (y: 'start' | 'end', z: 'start' | 'end', along: number, across: number): Slant => ({ x: null, y: { from: y, length: along }, z: { from: z, length: across } })

describe('slants', () => {
  it('a piece without slants keeps its four corners', () => {
    expect(outline(leg, 'x', [])).toEqual([[0, 0], [200, 0], [200, 100], [0, 100]])
  })

  it('a slant takes a triangle off its corner and leaves the others alone', () => {
    const tapered = outline(leg, 'x', [corner('start', 'end', 120, 40)])
    expect(tapered).toEqual([[0, 0], [200, 0], [200, 100], [120, 100], [0, 60]])
    expect(outlineArea(tapered)).toBe(200 * 100 - (120 * 40) / 2)
  })

  it('a slant along the whole edge ends at the next corner instead of adding a point', () => {
    expect(outline(leg, 'x', [corner('start', 'end', 200, 40)])).toEqual([[0, 0], [200, 0], [200, 100], [0, 60]])
  })

  it('a slant longer than the piece stops at its end, so a piece made shorter keeps a shape that can be cut', () => {
    expect(outline(leg, 'x', [corner('start', 'end', 500, 400)])).toEqual([[0, 0], [200, 0], [200, 100]])
  })

  it('a slant that leaves a stretch straight follows the piece: a leg tapers from under its apron whatever its height', () => {
    const taper: Slant = { x: null, y: { from: 'start', leave: 80 }, z: { from: 'end', length: 40 } }
    expect(outline(leg, 'x', [taper])).toEqual([[0, 0], [200, 0], [200, 100], [120, 100], [0, 60]])
    expect(outline({ ...leg, y1: 300 }, 'x', [taper])).toEqual([[0, 0], [300, 0], [300, 100], [220, 100], [0, 60]])
    expect(outline({ ...leg, y1: 80 }, 'x', [taper])).toEqual([[0, 0], [80, 0], [80, 100], [0, 100]])
  })

  it('two slants that would cross on an edge share it, so the outline never folds over itself', () => {
    const blade = outline(leg, 'x', [corner('start', 'start', 200, 80), corner('start', 'end', 200, 80)])
    expect(blade).toEqual([[0, 50], [200, 0], [200, 100]])
  })

  it('the corners are on the two axes of the face, whichever the thickness axis is', () => {
    const shelf = { x0: 0, x1: 300, y0: 0, y1: 18, z0: 0, z1: 100 }
    const slant: Slant = { x: { from: 'end', length: 50 }, y: null, z: { from: 'end', length: 30 } }
    expect(outline(shelf, 'y', [slant])).toEqual([[0, 0], [300, 0], [300, 70], [250, 100], [0, 100]])
  })
})
