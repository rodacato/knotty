import { describe, expect, it } from 'vitest'
import { sheetLabels } from './sheetLabels'

describe('sheetLabels', () => {
  it('shows the name and the size when the piece has room for both', () => {
    expect(sheetLabels(1800, 400, 'Costado izquierdo', '1800 × 400')).toEqual({ name: 64, size: 52 })
  })

  it('hides a name longer than its piece but keeps the size', () => {
    expect(sheetLabels(400, 300, 'Puerta de la columna 2', '400 × 300')).toEqual({ name: null, size: 52 })
  })

  it('shows nothing on a piece too narrow or too short for a line', () => {
    expect(sheetLabels(120, 600, 'Divisor', '600 × 120')).toEqual({ name: null, size: null })
    expect(sheetLabels(900, 90, 'Zoclo', '900 × 90')).toEqual({ name: null, size: null })
  })
})
