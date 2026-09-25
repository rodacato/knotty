import { describe, expect, it } from 'vitest'
import { bytesFromBase64, reducedDimensions, LONG_SIDE } from './canvas'

describe('photo reduction', () => {
  it('a large photo ends up with its long side at 1568 and keeps its proportions', () => {
    expect(reducedDimensions(4032, 3024, LONG_SIDE)).toEqual({ ancho: 1568, alto: 1176 })
    expect(reducedDimensions(3000, 4000, LONG_SIDE)).toEqual({ ancho: 1176, alto: 1568 })
  })

  it('a small photo is not enlarged', () => {
    expect(reducedDimensions(800, 600, LONG_SIDE)).toEqual({ ancho: 800, alto: 600 })
  })

  it('counts the real bytes of the base64', () => {
    expect(bytesFromBase64(btoa('abc'))).toBe(3)
    expect(bytesFromBase64(btoa('abcd'))).toBe(4)
    expect(bytesFromBase64(btoa('abcde'))).toBe(5)
  })
})
