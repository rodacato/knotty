import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { cutBox, woodLeft } from '../../design/cuts'
import { estimatePurchase } from '../../materials/purchase'
import { testCatalog } from '../fixtures/catalog.test-util'
import type { Cell } from '../reading/reading'
import { withFrontCuts } from './fronts'
import { buildCabinet, CabinetPlan, DEFAULT_CONSTRUCTION, type CabinetConstruction } from './cabinet'

const cell = (content: Cell['content'], height = 1, extra: Partial<Cell> = {}): Cell => ({ height, content, shelves: null, doors: null, ...extra })
const plan = (construction: Partial<CabinetConstruction>): CabinetPlan => ({
  kind: 'cabinet',
  name: 'Aparador bajo',
  dimensions: { width: 1500, height: 700, depth: 390 },
  material: 'T18',
  base: 'floor',
  legHeight: 150,
  wallMounted: true,
  construction: { ...DEFAULT_CONSTRUCTION, ...construction },
  columns: [
    { width: 1, cells: [cell('door', 1, { doors: 1 })] },
    { width: 1, cells: [cell('open')] },
    { width: 1, cells: [cell('drawer', 0.5), cell('door', 0.5, { doors: 1 })] },
  ],
})

const built = (construction: Partial<CabinetConstruction>) => {
  const { design } = buildCabinet(plan(construction), testCatalog)
  const analysis = analyze(design, testCatalog)
  if (!analysis.valid) throw new Error(analysis.errors.map((e) => e.message).join('\n'))
  return { design, analysis }
}
const fronts = (design: ReturnType<typeof built>['design']) => design.pieces.filter((p) => p.role === 'door' || p.role === 'drawer-front')

describe('front cuts', () => {
  it('smooth fronts with no notch have no cuts at all', () => {
    expect(built({}).design.pieces.filter((p) => p.cuts)).toEqual([])
  })

  it('grooved fronts get ribs on every door and drawer front, and nothing else does', () => {
    const { design, analysis } = built({ fronts: 'grooved' })
    const withCuts = design.pieces.filter((p) => p.cuts)
    expect(withCuts.map((p) => p.id).sort()).toEqual(fronts(design).map((p) => p.id).sort())
    const door = design.pieces.find((p) => p.id === 'c1-h1-door')!
    const box = analysis.geo!.boxes.get(door.id)!
    const grooves = door.cuts!.map((c) => cutBox(box, c))
    // Grooves are 6 mm wide, a third of the board deep, cut from the front face, and evenly spread with a smooth border.
    expect(grooves.every((g) => g.x1 - g.x0 === 6 && g.z0 === box.z1 - 6)).toBe(true)
    expect(Math.round(grooves[0].x0 - box.x0)).toBe(Math.round(box.x1 - grooves.at(-1)!.x1))
    expect(grooves.length).toBeGreaterThan(10)
    expect(woodLeft(box, grooves)).toBeLessThan((box.x1 - box.x0) * (box.y1 - box.y0) * (box.z1 - box.z0))
  })

  it('the notch of a drawer is on its top edge in the middle, and a door has it on the edge away from its hinge', () => {
    const { design, analysis } = built({ pulls: 'notch' })
    const boxes = analysis.geo!.boxes
    const drawer = design.pieces.find((p) => p.role === 'drawer-front')!
    const notch = cutBox(boxes.get(drawer.id)!, drawer.cuts![0])
    const drawerBox = boxes.get(drawer.id)!
    expect(notch.y1).toBeGreaterThan(drawerBox.y1)
    expect((notch.x0 + notch.x1) / 2).toBeCloseTo((drawerBox.x0 + drawerBox.x1) / 2)
    for (const door of design.pieces.filter((p) => p.role === 'door')) {
      const box = boxes.get(door.id)!
      const hinge = design.joints.find((u) => u.type === 'cup-hinge' && u.a === door.id)!
      const upright = boxes.get(hinge.b)!
      const hangsLeft = (upright.x0 + upright.x1) / 2 < (box.x0 + box.x1) / 2
      const cut = cutBox(box, door.cuts![0])
      // The free edge is the one the notch opens.
      expect(hangsLeft ? cut.x1 > box.x1 : cut.x0 < box.x0).toBe(true)
    }
  })

  it('the cuts change neither the purchase, the cut list nor what the checks find', () => {
    const plain = built({})
    const cut = built({ fronts: 'grooved', pulls: 'notch' })
    const buy = (x: ReturnType<typeof built>) => estimatePurchase(x.design, x.analysis.geo!, testCatalog)
    expect(buy(cut).hardware.map((h) => [h.hardware.id, h.count])).toEqual(buy(plain).hardware.map((h) => [h.hardware.id, h.count]))
    expect(buy(cut).sheets.map((s) => [s.material.id, s.sheets])).toEqual(buy(plain).sheets.map((s) => [s.material.id, s.sheets]))
    expect(buy(cut).layout).toEqual(buy(plain).layout)
    expect(cut.analysis.findings).toEqual(plain.analysis.findings)
  })

  it('a front too narrow for a rib gets none', () => {
    const { design } = built({})
    const door = design.pieces.find((p) => p.id === 'c1-h1-door')!
    const narrow = { x0: 0, x1: 30, y0: 0, y1: 500, z0: 0, z1: 18 }
    const cut = withFrontCuts({ ...design, pieces: [door], joints: [] }, new Map([[door.id, narrow]]), { notch: false, grooved: true })
    expect(cut.pieces[0].cuts).toBeUndefined()
  })
})
