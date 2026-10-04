import { describe, expect, it } from 'vitest'
import { analyze } from '../checks/analysis'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../furniture/fixtures/bookcase'
import { buildCabinet, DEFAULT_CONSTRUCTION } from '../furniture/modules/cabinet'
import { applyOperations } from '../editing/operations/apply'
import { exampleNightstand } from '../furniture/fixtures/nightstand'
import { estimatePurchase } from '../materials/purchase'
import { hardwareParts } from './hardware'

describe('hardware to draw', () => {
  it('puts a runner in the gap beside each drawer side, as long as the side', () => {
    const r = applyOperations({ ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, depth: 500 } }, [
      { op: 'addDrawer', group: 'drawer-1', name: 'Cajón 1', left: 'side-left.x1', right: 'side-right.x0', bottom: 'bottom.y1', top: 'shelf-1.y0', front: 'furniture.z1', back: 'back.z1', material: 'T15', bottomMaterial: 'TR6' },
    ], testCatalog)
    if (!r.ok) throw new Error('no drawer')
    const geo = analyze(r.value.design, testCatalog).geo!
    const runners = hardwareParts(r.value.design, geo.boxes, testCatalog).filter((h) => h.kind === 'runner')
    expect(runners).toHaveLength(2)
    const left = runners[0] as Extract<(typeof runners)[number], { kind: 'runner' }>
    const side = geo.boxes.get('drawer-1-side-left')!
    expect(left.owner).toBe('drawer-1-side-left')
    expect(left.box.x0).toBe(18)
    expect(left.box.x1).toBeCloseTo(side.x0, 5)
    expect([left.box.z0, left.box.z1]).toEqual([side.z0, side.z1])
  })
  it('puts two hinge cups on the inside of each door of a short cabinet, at the edge with the hinge', () => {
    const { design } = buildCabinet(
      { kind: 'cabinet', name: 'Alacena', dimensions: { width: 760, height: 720, depth: 320 }, material: 'T18', base: 'floor', legHeight: 150, wallMounted: true, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [{ height: 1, content: 'door', shelves: 1, doors: 2 }] }] },
      testCatalog,
    )
    const geo = analyze(design, testCatalog).geo!
    const hinges = hardwareParts(design, geo.boxes, testCatalog).filter((h) => h.kind === 'hinge')
    expect(hinges).toHaveLength(4)
    for (const h of hinges) {
      if (h.kind !== 'hinge') continue
      const door = geo.boxes.get(h.owner)!
      expect(h.center[2]).toBe(door.z0)
      expect(Math.min(h.center[0] - door.x0, door.x1 - h.center[0])).toBeCloseTo(22.5, 5)
    }
  })
  it('puts the plugs of a plugged dowel on the outside face of the piece it goes through, spaced along the joint', () => {
    const { design } = buildCabinet(
      { kind: 'cabinet', name: 'Cajonera', dimensions: { width: 500, height: 900, depth: 450 }, material: 'T18', base: 'floor', legHeight: 150, wallMounted: false, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [{ height: 1, content: 'open', shelves: 1, doors: null }] }] },
      testCatalog,
    )
    const body = design.joints.find((u) => u.type === 'butt-screw' && design.pieces.find((p) => p.id === u.a)?.role === 'side')!
    const plugged = { ...design, joints: design.joints.map((u) => (u.id === body.id ? { ...u, type: 'plugged-dowel' as const } : u)) }
    const geo = analyze(plugged, testCatalog).geo!
    const plugs = hardwareParts(plugged, geo.boxes, testCatalog).filter((h) => h.kind === 'plug')
    expect(plugs.length).toBeGreaterThanOrEqual(2)
    const side = geo.boxes.get(body.a)!
    const other = geo.boxes.get(body.b)!
    const sideIsLeft = (side.x0 + side.x1) / 2 < (other.x0 + other.x1) / 2
    for (const p of plugs) {
      if (p.kind !== 'plug') continue
      expect(p.owner).toBe(body.a)
      expect(p.axis).toBe('x')
      expect(p.outward).toBe(sideIsLeft ? -1 : 1)
      expect(p.center[0]).toBe(sideIsLeft ? side.x0 : side.x1)
      expect(p.center[1]).toBeGreaterThanOrEqual(Math.max(side.y0, other.y0))
      expect(p.center[1]).toBeLessThanOrEqual(Math.min(side.y1, other.y1))
    }
    const along = plugs.map((p) => (p.kind === 'plug' ? p.center[2] : 0))
    expect(new Set(along).size).toBe(plugs.length)
  })

  it('puts no plug where two boards are glued face to face, as the layers of a leg', () => {
    const { design } = buildCabinet(
      { kind: 'cabinet', name: 'Buró', dimensions: { width: 500, height: 600, depth: 350 }, material: 'T18', base: 'legs', legHeight: 150, wallMounted: false, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [{ height: 1, content: 'open', shelves: 1, doors: null }] }] },
      testCatalog,
    )
    const plugged = { ...design, joints: design.joints.map((u) => (u.type === 'butt-screw' || u.type === 'glue-nail' ? { ...u, type: 'plugged-dowel' as const } : u)) }
    const geo = analyze(plugged, testCatalog).geo!
    const owners = new Set(hardwareParts(plugged, geo.boxes, testCatalog).flatMap((h) => (h.kind === 'plug' ? [h.owner] : [])))
    expect([...owners].filter((id) => id.startsWith('leg-'))).toEqual([])
    expect(owners.size).toBeGreaterThan(0)
  })

  it('draws as many screws, dowels and shelf pins as the shopping list counts', () => {
    for (const design of [exampleBookcase, exampleNightstand]) {
      const geo = analyze(design, testCatalog).geo!
      const parts = hardwareParts(design, geo.boxes, testCatalog)
      const bought = (role: string) => estimatePurchase(design, geo, testCatalog).hardware.filter((line) => line.hardware.role === role).reduce((n, line) => n + line.count, 0)
      expect(parts.filter((p) => p.kind === 'screw')).toHaveLength(bought('screw'))
      expect(parts.filter((p) => p.kind === 'dowel')).toHaveLength(bought('dowel'))
      expect(parts.filter((p) => p.kind === 'shelf-pin')).toHaveLength(bought('shelf-pin'))
      expect(parts.filter((p) => p.kind === 'hole')).toHaveLength(bought('screw') + bought('dowel'))
    }
  })
  it('runs a screw from the outside face of the piece it goes through into the other, and marks its hole there', () => {
    const geo = analyze(exampleBookcase, testCatalog).geo!
    const u = exampleBookcase.joints.find((j) => j.type === 'butt-screw' && geo.boxes.get(j.a)!.x1 - geo.boxes.get(j.a)!.x0 < 30)!
    const [through, into] = [geo.boxes.get(u.a)!, geo.boxes.get(u.b)!]
    const parts = hardwareParts({ ...exampleBookcase, joints: [u] }, geo.boxes, testCatalog)
    const screws = parts.filter((p) => p.kind === 'screw')
    const length = testCatalog.hardware.find((h) => h.id === u.hardware[0].hardwareId)!.length!
    expect(screws.length).toBeGreaterThanOrEqual(2)
    for (const s of screws) {
      if (s.kind !== 'screw') continue
      expect(s.owner).toBe(u.a)
      expect(s.axis).toBe('x')
      expect(s.length).toBe(length)
      const [head, tip] = [s.center[0] + (s.outward * length) / 2, s.center[0] - (s.outward * length) / 2]
      expect(head).toBeCloseTo(s.outward === 1 ? through.x1 : through.x0, 5)
      expect(tip).toBeGreaterThan(into.x0)
      expect(tip).toBeLessThan(into.x1)
    }
    const holes = parts.filter((p) => p.kind === 'hole')
    expect(holes).toHaveLength(screws.length)
    for (const h of holes) {
      if (h.kind !== 'hole') continue
      expect(h.owner).toBe(u.b)
      expect([into.x0, into.x1]).toContain(h.center[0])
    }
  })
  it('leaves a dowel in the piece that takes it, sticking out no deeper than two thirds of the board it enters', () => {
    const geo = analyze(exampleNightstand, testCatalog).geo!
    const u = exampleNightstand.joints.find((j) => j.id === 'j-shelf-left')!
    const [shelf, side] = [geo.boxes.get(u.a)!, geo.boxes.get(u.b)!]
    const parts = hardwareParts({ ...exampleNightstand, joints: [u] }, geo.boxes, testCatalog)
    const dowels = parts.filter((p) => p.kind === 'dowel')
    expect(dowels).toHaveLength(3)
    for (const d of dowels) {
      if (d.kind !== 'dowel') continue
      expect(d.owner).toBe(u.b)
      const [lo, hi] = [d.center[0] - d.length / 2, d.center[0] + d.length / 2]
      expect(lo).toBeGreaterThanOrEqual(side.x0 + (side.x1 - side.x0) / 3 - 1e-6)
      expect(hi).toBeGreaterThan(shelf.x0)
      expect(d.center[1]).toBeCloseTo((shelf.y0 + shelf.y1) / 2, 5)
      expect(d.center[2]).toBeGreaterThan(shelf.z0)
      expect(d.center[2]).toBeLessThan(shelf.z1)
    }
    expect(parts.filter((p) => p.kind === 'hole' && p.owner === u.a)).toHaveLength(3)
  })
  it('puts the pins of a movable shelf in the side, just under the shelf', () => {
    const geo = analyze(exampleBookcase, testCatalog).geo!
    const u = exampleBookcase.joints.find((j) => j.type === 'shelf-pin')!
    const [shelf, side] = [geo.boxes.get(u.a)!, geo.boxes.get(u.b)!]
    const pins = hardwareParts({ ...exampleBookcase, joints: [u] }, geo.boxes, testCatalog)
    expect(pins).toHaveLength(2)
    for (const p of pins) {
      if (p.kind !== 'shelf-pin') throw new Error('not a pin')
      expect(p.owner).toBe(u.b)
      expect(p.center[1] + p.diameter / 2).toBeCloseTo(shelf.y0, 5)
      const [lo, hi] = [p.center[0] - p.length / 2, p.center[0] + p.length / 2]
      expect(lo < side.x1 && hi > side.x0).toBe(true)
      expect(lo < shelf.x1 && hi > shelf.x0).toBe(true)
    }
  })
})
