import { describe, expect, it } from 'vitest'
import { ALPHA, fisherP, repeatsToTell } from './significance'

const p = (a: [number, number], b: [number, number]) => fisherP({ failed: a[0], counted: a[1] }, { failed: b[0], counted: b[1] })

describe('fisherP', () => {
  it('matches the exact tables', () => {
    expect(p([0, 3], [3, 3])).toBeCloseTo(0.1, 6)
    expect(p([0, 4], [4, 4])).toBeCloseTo(2 / 70, 6)
    expect(p([1, 6], [4, 6])).toBeCloseTo(0.2424, 3)
  })

  it('is 1 when the runs are the same or nothing failed or everything did', () => {
    expect(p([2, 6], [2, 6])).toBeCloseTo(1, 9)
    expect(p([0, 6], [0, 6])).toBe(1)
    expect(p([6, 6], [6, 6])).toBe(1)
  })

  it('does not depend on which side is which', () => {
    expect(p([1, 5], [4, 6])).toBeCloseTo(p([4, 6], [1, 5]), 10)
  })

  it('is 1 with an empty side', () => {
    expect(p([0, 0], [1, 3])).toBe(1)
  })
})

describe('repeatsToTell', () => {
  it('is the fewest repeats at which a clean base against a failing candidate clears the alpha', () => {
    expect(repeatsToTell()).toBe(4)
    expect(p([0, 3], [3, 3])).toBeGreaterThan(ALPHA)
  })
})
