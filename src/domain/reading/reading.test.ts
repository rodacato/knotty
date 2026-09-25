import { describe, expect, it } from 'vitest'
import { mergeReadings, photoKey, type PhotoReading } from './reading'

const reading = (r: Partial<PhotoReading>): PhotoReading => ({
  kind: 'librero',
  confidence: 'high',
  description: 'Un librero',
  proportions: null,
  base: null,
  topOverhangs: null,
  columns: null,
  details: [],
  doubts: [],
  ...r,
})
const twoColumns = [
  { width: 0.5, cells: [{ height: 1, content: 'open' as const, shelves: 3, doors: null }] },
  { width: 0.5, cells: [{ height: 1, content: 'door' as const, shelves: 2, doors: 1 }] },
]

describe('mergeReadings', () => {
  it('takes the layout from the front and the depth from the side', () => {
    const merged = mergeReadings([
      { angle: 'side', reading: reading({ proportions: { height: 3, width: 1, depth: 0.4 }, doubts: ['¿Trasera clavada?'] }) },
      { angle: 'front', reading: reading({ proportions: { height: 3.1, width: 1, depth: null }, columns: twoColumns, base: 'kick', details: ['cubrecanto'] }) },
    ])
    expect(merged?.columns).toEqual(twoColumns)
    expect(merged?.proportions).toEqual({ height: 3.1, width: 1, depth: 0.4 })
    expect(merged?.base).toBe('kick')
    expect(merged?.doubts).toEqual(['¿Trasera clavada?'])
  })

  it('prefers a confident view over a doubtful one', () => {
    const merged = mergeReadings([
      { angle: 'front', reading: reading({ confidence: 'low', kind: 'alacena' }) },
      { angle: 'three-quarter', reading: reading({ confidence: 'high', kind: 'librero' }) },
    ])
    expect(merged?.kind).toBe('librero')
  })

  it('is null without readings', () => {
    expect(mergeReadings([])).toBeNull()
  })
})

describe('photoKey', () => {
  it('changes with the note and with the photo, not between calls', () => {
    const photo = 'A'.repeat(5000) + 'B'
    expect(photoKey(photo, '')).toBe(photoKey(photo, ''))
    expect(photoKey(photo, 'la de abajo es puerta')).not.toBe(photoKey(photo, ''))
    expect(photoKey(photo.replace(/^A{7}/, 'C'.repeat(7)), '')).not.toBe(photoKey(photo, ''))
  })
})
