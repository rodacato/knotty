import { describe, expect, it } from 'vitest'
import type { Box } from './resolve'
import { doorMount } from './doors'

const box = (x0: number, x1: number, z0: number, z1: number): Box => ({ x0, x1, y0: 0, y1: 700, z0, z1 })
/** An 18 mm side from x 0 to 18, 300 deep. */
const side = box(0, 18, 0, 300)

describe('doorMount', () => {
  it('in front of the upright over most of its edge: overlay (straight hinge)', () => {
    expect(doorMount(box(2, 400, 300, 318), side)).toBe('overlay')
  })

  it('in front over about half its edge, the other half for the next door: half-overlay (cranked hinge)', () => {
    expect(doorMount(box(10, 400, 300, 318), side)).toBe('half-overlay')
  })

  it('inside the opening, beside the upright: inset (super-cranked hinge)', () => {
    expect(doorMount(box(20, 400, 282, 300), side)).toBe('inset')
  })

  it('a door that opens toward the back reads the same', () => {
    expect(doorMount(box(2, 400, -18, 0), side)).toBe('overlay')
  })

  it('in front but not reaching the upright, it does not say', () => {
    expect(doorMount(box(40, 400, 300, 318), side)).toBeNull()
  })
})
