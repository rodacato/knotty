import { describe, expect, it } from 'vitest'
import { analyze } from '../../domain/checks/analysis'
import { bounds, drawerGroups } from '../../domain/design/boxes'
import type { Box } from '../../domain/design/resolve'
import type { Design } from '../../domain/design/schema'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetPlan } from '../../domain/furniture/modules/cabinet'
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
    const all = bounds([...boxes.values()])
    const landed = [...result.swings].map(([id, swing]) => {
      const box = boxes.get(id)!
      const toFree = swing.pivot[0] === box.x0 ? 1 : -1
      const outward = (box.z0 + box.z1) / 2 >= (all.z0 + all.z1) / 2 ? 1 : -1
      return Math.sign(-Math.sin(swing.angle) * toFree) === outward
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

describe('a door that opens clears the furniture, hung inset or overlay', () => {
  const door = (doors: number | null = 1) => ({ height: 1, content: 'door' as const, shelves: null, doors })
  const plan = (hung: 'overlay' | 'inset', hinges: 'outside' | 'inside', leaves: number): CabinetPlan => ({
    kind: 'cabinet',
    name: 'Alacena',
    dimensions: { width: 900, height: 700, depth: 350 },
    material: 'T18',
    base: 'floor',
    legHeight: 150,
    wallMounted: false,
    construction: { ...DEFAULT_CONSTRUCTION, doors: hung, hinges },
    columns: [{ width: 1, cells: [door(leaves)] }],
  })

  /** Where the door's footprint (x, z) falls when it turns by `angle` about `pivot`. */
  const swept = (box: Box, pivot: [number, number], angle: number) =>
    Array.from({ length: 21 * 5 }, (_, i) => {
      const [u, v] = [box.x0 + ((i % 21) / 20) * (box.x1 - box.x0), box.z0 + (Math.floor(i / 21) / 4) * (box.z1 - box.z0)]
      const [dx, dz] = [u - pivot[0], v - pivot[1]]
      return [pivot[0] + dx * Math.cos(angle) + dz * Math.sin(angle), pivot[1] - dx * Math.sin(angle) + dz * Math.cos(angle)]
    })

  const cases = (['overlay', 'inset'] as const).flatMap((hung) => (['outside', 'inside'] as const).flatMap((hinges) => [1, 2].map((leaves) => [`${hung} · ${hinges} · ${leaves} leaves`, hung, hinges, leaves] as const)))
  it.each(cases)('%s: no point of the open door is inside the carcass', (_, hung, hinges, leaves) => {
    const { design } = buildCabinet(plan(hung, hinges, leaves), testCatalog)
    const { boxes, result } = open(design)
    expect(result.swings.size).toBeGreaterThan(0)
    for (const [id, swing] of result.swings) {
      const box = boxes.get(id)!
      const others = design.pieces.filter((p) => p.id !== id && p.role !== 'door' && boxes.get(p.id)!.y1 > box.y0 && boxes.get(p.id)!.y0 < box.y1).map((p) => ({ id: p.id, box: boxes.get(p.id)! }))
      const inside = swept(box, swing.pivot, swing.angle).flatMap(([x, z]) => others.filter((o) => x > o.box.x0 + 1 && x < o.box.x1 - 1 && z > o.box.z0 + 1 && z < o.box.z1 - 1).map((o) => o.id))
      expect([id, [...new Set(inside)]]).toEqual([id, []])
    }
  })
})
