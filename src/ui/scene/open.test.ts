import { describe, expect, it } from 'vitest'
import { analyze } from '../../domain/checks/analysis'
import { bounds, drawerGroups } from '../../domain/design/boxes'
import { slides as runsOnTracks } from '../../domain/design/doors'
import type { Box } from '../../domain/design/resolve'
import type { Design } from '../../domain/design/schema'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetPlan } from '../../domain/furniture/modules/cabinet'
import { exampleDesign } from '../../domain/furniture/examples'
import { exampleNightstand } from '../../domain/furniture/fixtures/nightstand'
import { exampleWallCabinet } from '../../domain/furniture/fixtures/wallCabinet'
import { testBases } from '../../domain/furniture/fixtures/references.test-util'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { opening, turnsOf } from './open'

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
  it.each(designs)('%s: only drawers and sliding leaves move along, only doors swing, and everything else stays', (_, design) => {
    const { result } = open(design)
    const drawers = new Set(drawerGroups(design))
    for (const p of design.pieces.filter((piece) => !runsOnTracks(design, piece.id))) {
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

describe('a lid lifts on the hinge along its back edge', () => {
  const headboard = (shelvesAbove: number): CabinetPlan => ({
    kind: 'cabinet',
    name: 'Librero de cabecera',
    dimensions: { width: 650, height: 1000, depth: 300 },
    material: 'T18',
    base: 'floor',
    legHeight: 150,
    wallMounted: true,
    construction: { ...DEFAULT_CONSTRUCTION, top: 'over', shelves: 'fixed' },
    columns: [{ width: 1, cells: [{ height: 0.5, content: 'chest', shelves: 1, doors: null }, { height: 0.5, content: 'open', shelves: shelvesAbove, doors: null }] }],
  })
  /** Where a point of the lid, as [y, z], lands when the scene turns it about x. */
  const lifted = ([y, z]: [number, number], pivot: [number, number], angle: number) => [pivot[0] + (y - pivot[0]) * Math.cos(angle) - (z - pivot[1]) * Math.sin(angle), pivot[1] + (y - pivot[0]) * Math.sin(angle) + (z - pivot[1]) * Math.cos(angle)]

  it('turns a quarter about the top of its back edge, so its front edge ends up over the hinge; it neither swings out nor slides', () => {
    const { boxes, result } = open(buildCabinet(headboard(0), testCatalog).design)
    const lid = boxes.get('c1-h1-lid')!
    const lift = result.lifts.get('c1-h1-lid')!
    expect(lift.pivot).toEqual([lid.y1, lid.z0])
    const [y, z] = lifted([lid.y1, lid.z1], lift.pivot, lift.angle)
    expect([y, z].map(Math.round)).toEqual([lid.y1 + (lid.z1 - lid.z0), lid.z0].map(Math.round))
    expect([result.swings.has('c1-h1-lid'), result.offsets.get('c1-h1-lid')]).toEqual([false, [0, 0, 0]])
    expect(result.bounds.y1).toBeGreaterThanOrEqual(y)
    expect(turnsOf(result).get('c1-h1-lid')).toEqual({ axis: 'x', ...lift })
  })

  it('stops against a shelf over it instead of going through', () => {
    const { boxes, result } = open(buildCabinet(headboard(3), testCatalog).design)
    const [lid, shelf] = [boxes.get('c1-h1-lid')!, boxes.get('c1-h2-shelf-1')!]
    const lift = result.lifts.get('c1-h1-lid')!
    expect(Math.abs(lift.angle)).toBeLessThan(Math.PI / 2)
    expect(lifted([lid.y1, lid.z1], lift.pivot, lift.angle)[0]).toBeCloseTo(shelf.y0)
  })
})

describe('sliding doors open along their tracks', () => {
  const rack = (leaves: number): CabinetPlan => ({
    kind: 'cabinet',
    name: 'Rack',
    dimensions: { width: 1000, height: 600, depth: 400 },
    material: 'T18',
    base: 'floor',
    legHeight: 150,
    wallMounted: false,
    construction: { ...DEFAULT_CONSTRUCTION, doors: 'sliding' },
    columns: [{ width: 1, cells: [{ height: 1, content: 'door', shelves: 0, doors: leaves }] }],
  })
  const moved = (leaves: number) => {
    const { design } = buildCabinet(rack(leaves), testCatalog)
    const { boxes, result } = open(design)
    return { boxes, result, x: (id: string) => result.offsets.get(id)![0] }
  }

  it('a single leaf runs from the side it closes against over the open half, and nothing swings', () => {
    const { boxes, result, x } = moved(1)
    const leaf = boxes.get('c1-h1-door')!
    expect(result.swings.size).toBe(0)
    expect(x('c1-h1-door')).toBe(leaf.x1 - leaf.x0 - 25)
    expect(leaf.x1 + x('c1-h1-door')).toBe(boxes.get('side-right')!.x0)
  })

  it('of two leaves only the one behind moves, until it is behind the other', () => {
    const { boxes, x } = moved(2)
    expect(x('c1-h1-door-right')).toBe(0)
    expect(boxes.get('c1-h1-door-left')!.x0 + x('c1-h1-door-left')).toBe(boxes.get('c1-h1-door-right')!.x0)
  })
})
