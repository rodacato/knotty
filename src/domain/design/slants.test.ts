import { describe, expect, it } from 'vitest'
import { holeOutline, outline, outlineArea } from './slants'
import type { Round, Slant } from './schema'

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

describe('rounded corners', () => {
  const top = { x0: 0, x1: 1200, y0: 732, y1: 750, z0: 0, z1: 800 }
  const round = (x: 'start' | 'end', z: 'start' | 'end', radius: number): Round => ({ x, y: null, z, radius })
  const everyCorner = (radius: number) => [round('start', 'start', radius), round('end', 'start', radius), round('end', 'end', radius), round('start', 'end', radius)]

  it('a round takes its corner off along an arc that starts and ends a radius away, and every point of it is a radius from its center', () => {
    const rounded = outline(top, 'y', [], [round('end', 'end', 40)])
    expect(rounded.slice(0, 4)).toEqual([[0, 0], [1200, 0], [1200, 760], expect.anything()])
    expect(rounded.at(-2)).toEqual([1160, 800])
    expect(rounded.at(-1)).toEqual([0, 800])
    const arc = rounded.slice(2, -1)
    expect(arc.length).toBeGreaterThan(4)
    for (const [x, z] of arc) expect(Math.hypot(x - 1160, z - 760)).toBeCloseTo(40)
  })

  it('takes less than the square corner did: what a 40 mm round removes is the corner square less a quarter circle', () => {
    const area = outlineArea(outline(top, 'y', [], [round('start', 'start', 40)]))
    expect(1200 * 800 - area).toBeGreaterThan(0)
    expect((1200 * 800 - area) / (40 * 40 * (1 - Math.PI / 4))).toBeCloseTo(1, 1)
  })

  it('four rounds as long as the face leave an ellipse inside it, and a circle on a square', () => {
    const ellipse = outline(top, 'y', [], everyCorner(600))
    for (const [x, z] of ellipse) expect(((x - 600) / 600) ** 2 + ((z - 400) / 400) ** 2).toBeCloseTo(1)
    const circle = outline({ ...top, x1: 800 }, 'y', [], everyCorner(400))
    for (const [x, z] of circle) expect(Math.hypot(x - 400, z - 400)).toBeCloseTo(400)
  })

  it('stays convex, so the mesh that fans it out from one corner covers it', () => {
    const points = outline(top, 'y', [], everyCorner(40))
    const turns = points.map((p, i) => {
      const [q, r] = [points[(i + 1) % points.length], points[(i + 2) % points.length]]
      return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0])
    })
    expect(turns.every((t) => t > 0)).toBe(true)
  })
})

describe('a round hole', () => {
  const back = { x0: 100, x1: 700, y0: 50, y1: 450, z0: 0, z1: 3 }

  it('is a rim a radius from its center, which is measured from the start of the piece on the two axes of its face', () => {
    const rim = holeOutline(back, 'z', { x: 300, y: 100, z: null, diameter: 60 })
    expect(rim.length).toBeGreaterThan(12)
    for (const [x, y] of rim) expect(Math.hypot(x - 400, y - 150)).toBeCloseTo(30)
    expect(outlineArea(rim) / (Math.PI * 30 * 30)).toBeCloseTo(1, 1)
  })

  it('goes round counterclockwise, as the outline of the piece does', () => {
    const rim = holeOutline(back, 'z', { x: 300, y: 100, z: null, diameter: 60 })
    expect(rim.reduce((sum, [u, v], i) => sum + u * rim[(i + 1) % rim.length][1] - rim[(i + 1) % rim.length][0] * v, 0)).toBeGreaterThan(0)
  })
})
