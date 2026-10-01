import { describe, expect, it } from 'vitest'
import { outOfRange } from './PlanFields'

describe('outOfRange', () => {
  it('names the bounds a typed measure breaks, and nothing when it holds', () => {
    expect([99, 100, 300, 301].map((v) => outOfRange(v, 100, 300))).toEqual(['Entre 100 y 300 mm.', null, null, 'Entre 100 y 300 mm.'])
    expect(outOfRange(-1, 0)).toBe('Mínimo 0 mm.')
    expect(outOfRange(5000, undefined, 4000)).toBe('Máximo 4000 mm.')
    expect(outOfRange(7)).toBeNull()
  })
})
