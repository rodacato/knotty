import { describe, expect, it } from 'vitest'
import { analyze } from '../checks/analysis'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../furniture/fixtures/bookcase'
import { buildCabinet, DEFAULT_CONSTRUCTION } from '../furniture/modules/cabinet'
import { applyOperations } from '../editing/operations/apply'
import { hardwareParts } from './hardware'

describe('hardware to draw', () => {
  it('puts a runner in the gap beside each drawer side, as long as the side', () => {
    const r = applyOperations({ ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, depth: 500 } }, [
      { op: 'addDrawer', group: 'drawer-1', name: 'Cajón 1', left: 'side-left.x1', right: 'side-right.x0', bottom: 'bottom.y1', top: 'shelf-1.y0', front: 'furniture.z1', back: 'back.z1', material: 'T15', bottomMaterial: 'TR6' },
    ], testCatalog)
    if (!r.ok) throw new Error('no drawer')
    const geo = analyze(r.value.design, testCatalog).geo!
    const runners = hardwareParts(r.value.design, geo.boxes).filter((h) => h.kind === 'runner')
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
    const hinges = hardwareParts(design, geo.boxes).filter((h) => h.kind === 'hinge')
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
    const plugs = hardwareParts(plugged, geo.boxes).filter((h) => h.kind === 'plug')
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
})
