import { describe, expect, it } from 'vitest'
import { analyze } from '../../domain/checks/analysis'
import { hardwareParts } from '../../domain/design/hardware'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetPlan } from '../../domain/furniture/modules/cabinet'
import { opening } from './open'
import { stayElbow, type Stay } from './stay'

const headboard: CabinetPlan = {
  kind: 'cabinet',
  name: 'Librero de cabecera',
  dimensions: { width: 650, height: 1000, depth: 300 },
  material: 'T18',
  base: 'floor',
  legHeight: 150,
  wallMounted: true,
  construction: { ...DEFAULT_CONSTRUCTION, top: 'over' },
  columns: [{ width: 1, cells: [{ height: 0.5, content: 'chest', shelves: 1, doors: null }, { height: 0.5, content: 'open', shelves: 0, doors: null }] }],
}

function lidOf(plan: CabinetPlan) {
  const { design } = buildCabinet(plan, testCatalog)
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  const stay = hardwareParts(design, a.geo.boxes, testCatalog).find((p): p is Stay => p.kind === 'stay')!
  return { stay, lift: opening(design, a.geo.boxes).lifts.get(stay.owner)!, lid: a.geo.boxes.get(stay.owner)! }
}

const apart = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])

describe("a lid's stay", () => {
  it('keeps its two arms whole from closed to open: the elbow is one arm away from the wall and one from the lid', () => {
    const { stay, lift } = lidOf(headboard)
    for (const share of [0, 0.25, 0.5, 0.75, 1]) {
      const { onLid, elbow } = stayElbow(stay, lift.angle * share)
      expect([share, apart(elbow, stay.onWall), apart(elbow, onLid)].map((n) => Math.round(n * 1000) / 1000)).toEqual([share, stay.arm, stay.arm].map((n) => Math.round(n * 1000) / 1000))
    }
  })

  it('follows the lid up: closed its end is under the lid, open it is over the hinge, and the arms are almost straight', () => {
    const { stay, lift, lid } = lidOf(headboard)
    expect(stayElbow(stay, 0).onLid).toEqual([lid.y0, stay.onLid[1]])
    const open = stayElbow(stay, lift.angle).onLid
    expect(open[0]).toBeGreaterThan(lid.y1 + 100)
    expect(apart(open, stay.onWall)).toBeGreaterThan(1.9 * stay.arm)
  })

  it('folds into the chest, away from the hinge, and never through the lid', () => {
    const { stay, lid } = lidOf(headboard)
    const { elbow } = stayElbow(stay, 0)
    expect(elbow[0]).toBeLessThan(lid.y0)
    expect(elbow[1]).toBeGreaterThan(stay.pivot[1])
  })
})
