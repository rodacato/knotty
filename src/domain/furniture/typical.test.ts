import { describe, expect, it } from 'vitest'
import { DESIGN_KINDS } from '../design/kind'
import type { Dimensions } from '../design/schema'
import { DEFAULT_DIMENSIONS, MEASURE_RANGE, TYPICAL_DIMENSIONS, typicalDimensions } from './typical'

const inCaptureRange = (d: Dimensions) => (Object.keys(MEASURE_RANGE) as (keyof Dimensions)[]).every((k) => d[k] >= MEASURE_RANGE[k][0] && d[k] <= MEASURE_RANGE[k][1])

describe('typicalDimensions', () => {
  it('gives every kind a size that Capture accepts', () => {
    expect(DESIGN_KINDS.filter((kind) => !inCaptureRange(TYPICAL_DIMENSIONS[kind]))).toEqual([])
  })

  it('without a kind, starts where Capture always started', () => {
    expect(typicalDimensions(null)).toEqual(DEFAULT_DIMENSIONS)
    expect(inCaptureRange(DEFAULT_DIMENSIONS)).toBe(true)
  })
})
