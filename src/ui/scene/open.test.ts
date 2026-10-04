import { describe, expect, it } from 'vitest'
import { analyze } from '../../domain/checks/analysis'
import { drawerGroups } from '../../domain/design/boxes'
import type { Design } from '../../domain/design/schema'
import { exampleDesign } from '../../domain/furniture/examples'
import { exampleNightstand } from '../../domain/furniture/fixtures/nightstand'
import { exampleWallCabinet } from '../../domain/furniture/fixtures/wallCabinet'
import { testBases } from '../../domain/furniture/fixtures/references.test-util'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { opening } from './open'

const designs: [string, Design][] = [
  ...[exampleNightstand, exampleWallCabinet].map((d) => [d.name, d] as [string, Design]),
  ...testBases.map((b) => [b.name, exampleDesign(b, testCatalog).design] as [string, Design]),
]

function open(design: Design) {
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return { boxes: a.geo.boxes, result: opening(design, a.geo.boxes) }
}

describe('the furniture open', () => {
  it.each(designs)('%s: only drawers slide and only doors swing, and everything else stays', (_, design) => {
    const { result } = open(design)
    const drawers = new Set(drawerGroups(design))
    for (const p of design.pieces) {
      const slides = !!p.group && drawers.has(p.group)
      const offset = result.offsets.get(p.id)!
      expect([p.id, offset.some((d) => d !== 0)]).toEqual([p.id, slides])
    }
    expect([...result.swings.keys()].filter((id) => design.pieces.find((p) => p.id === id)!.role !== 'door')).toEqual([])
  })

  it.each(designs)('%s: a drawer comes out of its front and a door turns open away from the furniture', (_, design) => {
    const { boxes, result } = open(design)
    for (const group of drawerGroups(design)) {
      const face = design.pieces.find((p) => p.group === group && p.role === 'drawer-front')!
      const offset = result.offsets.get(face.id)!
      const axis = { x: 0, y: 1, z: 2 }[face.normal]
      expect(Math.abs(offset[axis])).toBeGreaterThan(0)
      expect(offset.filter((_, i) => i !== axis).every((d) => d === 0)).toBe(true)
    }
    // A turn about y carries +x to (cos, −sin): where the free edge lands along z, to compare with the face that shows.
    const landed = [...result.swings].map(([id, swing]) => {
      const box = boxes.get(id)!
      const toFree = swing.pivot[0] === box.x0 ? 1 : -1
      return Math.sign(-Math.sin(swing.angle) * toFree) === (swing.pivot[1] === box.z0 ? 1 : -1)
    })
    expect(landed.every(Boolean)).toBe(true)
  })

  it('the box around it holds every drawer pulled out and every door swung', () => {
    const { boxes, result } = open(exampleNightstand)
    for (const group of drawerGroups(exampleNightstand)) {
      const face = exampleNightstand.pieces.find((p) => p.group === group && p.role === 'drawer-front')!
      const b = boxes.get(face.id)!
      const [dx, , dz] = result.offsets.get(face.id)!
      expect(result.bounds.z0).toBeLessThanOrEqual(b.z0 + dz)
      expect(result.bounds.z1).toBeGreaterThanOrEqual(b.z1 + dz)
      expect(result.bounds.x1).toBeGreaterThanOrEqual(b.x1 + dx)
    }
  })
})
