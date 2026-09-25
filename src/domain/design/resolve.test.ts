import { describe, expect, it } from 'vitest'
import { exampleWallCabinet } from '../fixtures/wallCabinet'
import { exampleNightstand } from '../fixtures/nightstand'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { startAt, mm, makePiece, ref, extent } from './builders'
import { Design, type Design as TDiseno } from './schema'
import { resolveGeometry, type Geometry } from './resolve'

const resolved = (d: TDiseno): Geometry => {
  const r = resolveGeometry(d, testCatalog)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value
}

describe('resolveGeometry', () => {
  it.each([exampleBookcase, exampleNightstand, exampleWallCabinet])('the fixtures match the schema and resolve: $name', (d) => {
    expect(Design.safeParse(d).success).toBe(true)
    expect(resolved(d).boxes.size).toBe(d.pieces.length)
  })

  it('resolves references, thicknesses and proportional positions of the bookcase', () => {
    const { boxes } = resolved(exampleBookcase)
    expect(boxes.get('side-left')).toEqual({ x0: 0, x1: 18, y0: 0, y1: 1800, z0: 6, z1: 300 })
    expect(boxes.get('side-right')).toMatchObject({ x0: 582, x1: 600 })
    expect(boxes.get('bottom')).toMatchObject({ x0: 18, x1: 582, y0: 70, y1: 88 })
    expect(boxes.get('top')).toMatchObject({ y0: 1782, y1: 1800 })
    const gaps = [boxes.get('bottom')!, ...[1, 2, 3, 4].map((i) => boxes.get(`shelf-${i}`)!), boxes.get('top')!]
      .slice(1)
      .map((c, i, arr) => c.y0 - (i === 0 ? boxes.get('bottom')!.y1 : arr[i - 1].y1))
    for (const h of gaps) expect(h).toBeCloseTo(gaps[0], 5)
  })

  it('carries a change of width to everything that refers to it', () => {
    const { boxes } = resolved({ ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 900 } })
    expect(boxes.get('side-right')).toMatchObject({ x0: 882, x1: 900 })
    expect(boxes.get('shelf-2')).toMatchObject({ x0: 18, x1: 882 })
  })

  it('takes the catalog thickness along the normal axis', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.find((p) => p.id === 'side-left')!.material = 'T15'
    expect(resolved(d).boxes.get('bottom')).toMatchObject({ x0: 15 })
  })

  it('reports references to missing pieces and crossed axes', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.push(makePiece({ id: 'extra', name: 'Extra', role: 'other', material: 'T18', normal: 'y', x: extent(ref('fantasma.x1'), ref('furniture.x1')), y: startAt(mm(500)), z: extent(ref('furniture.y0'), ref('furniture.z1')) }))
    const r = resolveGeometry(d, testCatalog)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.map((e) => e.code).sort()).toEqual(['E_REF_AXIS', 'E_UNKNOWN_REF'])
  })

  it('finds reference cycles', () => {
    const d = structuredClone(exampleBookcase)
    const side = d.pieces.find((p) => p.id === 'side-left')!
    side.x = startAt(ref('bottom.x0', -18))
    const r = resolveGeometry(d, testCatalog)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0].code).toBe('E_CYCLE')
  })

  it('rejects extents with zero or negative length and materials outside the catalog', () => {
    const d = structuredClone(exampleBookcase)
    d.dimensions.width = 30
    d.pieces.find((p) => p.id === 'top')!.material = 'T25'
    const r = resolveGeometry(d, testCatalog)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(new Set(r.errors.map((e) => e.code))).toEqual(new Set(['E_INVALID_EXTENT', 'E_UNKNOWN_MATERIAL']))
  })

  it('accepts start + length and end + length across the face', () => {
    const { boxes } = resolved(exampleBookcase)
    expect(boxes.get('kick')).toMatchObject({ y0: 0, y1: 70, z0: 252, z1: 270 })
  })
})
