import { describe, expect, it } from 'vitest'
import { analyze } from '../../domain/checks/analysis'
import { counterLines } from '../../domain/estimate/counterList'
import { estimatePurchase } from '../../domain/estimate/purchase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { buildPlan, MODULES, type FurniturePlan } from '../../domain/furniture/modules/plan'
import { drawDiagram, spreadApart, VIEWS, type Angle } from './diagram'

const variant = (kind: keyof typeof MODULES, name: string) => (MODULES[kind].benchVariants() as [string, FurniturePlan][]).find(([n]) => n === name)![1]

const ANGLES = Object.keys(VIEWS) as Angle[]

function drawn(plan: FurniturePlan, angle: Angle = 'right') {
  const { design } = buildPlan(plan, testCatalog)
  const analysis = analyze(design, testCatalog)
  if (!analysis.valid) throw new Error('the variant does not build')
  const blocks = counterLines(design, analysis.geo, estimatePurchase(design, analysis.geo, testCatalog))
  const numbers = new Map(blocks.flatMap((b) => b.lines.flatMap((l) => l.ids.map((id) => [id, l.number] as const))))
  return { design, numbers, diagram: drawDiagram(analysis.geo.boxes, spreadApart(analysis.geo.boxes, 1.6), numbers, angle) }
}

const PIECES: [string, FurniturePlan][] = [
  ['a bookcase', variant('cabinet', 'librero')],
  ['a chest of drawers', variant('cabinet', 'cajonera')],
  ['a dining table', variant('table', 'comedor')],
  ['a bed', variant('bed', 'individual, sin cabecera, sin cajones')],
]

describe('the pieces apart, as a drawing to take away', () => {
  it.each(PIECES)('draws every piece of %s once from each angle, with the number of its line in the cut list', (_, plan) => {
    for (const angle of ANGLES) {
      const { design, numbers, diagram } = drawn(plan, angle)
      expect(diagram.pieces.map((p) => p.id).sort()).toEqual(design.pieces.map((p) => p.id).sort())
      expect(diagram.pieces.filter((p) => p.number === null || p.number !== numbers.get(p.id)).map((p) => p.id)).toEqual([])
    }
  })

  it.each(PIECES)('keeps %s inside the drawing from each angle', (_, plan) => {
    for (const angle of ANGLES) {
      const { diagram } = drawn(plan, angle)
      const points = diagram.pieces.flatMap((p) => [...p.faces.flatMap((f) => f.points.split(' ').map((xy) => xy.split(',').map(Number))), p.badge])
      expect(points.every(([x, y]) => x >= 0 && y >= 0 && x <= diagram.width && y <= diagram.height)).toBe(true)
    }
  })

  it('shows a board on the left to the left from the front and to the right from behind', () => {
    const box = (x: number) => ({ x0: x, x1: x + 18, y0: 0, y1: 500, z0: 0, z1: 300 })
    const boxes = new Map([['left', box(0)], ['right', box(800)]])
    const across = (angle: Angle) => Object.fromEntries(drawDiagram(boxes, new Map(), new Map(), angle).pieces.map((p) => [p.id, p.badge[0]]))
    for (const angle of ['right', 'left', 'front', 'top'] as const) expect(across(angle).left).toBeLessThan(across(angle).right)
    expect(across('back').left).toBeGreaterThan(across('back').right)
  })

  it('draws what is nearer last, so it covers what is behind: the front one from the front, the back one from behind', () => {
    const box = (z: number) => ({ x0: 0, x1: 100, y0: 0, y1: 100, z0: z, z1: z + 18 })
    const order = (angle: Angle) => drawDiagram(new Map([['front', box(300)], ['back', box(0)]]), new Map(), new Map(), angle).pieces.map((p) => p.id)
    for (const angle of ['right', 'left', 'front'] as const) expect(order(angle)).toEqual(['back', 'front'])
    expect(order('back')).toEqual(['front', 'back'])
  })

  it('puts air between two doors that touch, and between a top and the side under it', () => {
    const boxes = new Map([
      ['left door', { x0: 0, x1: 400, y0: 0, y1: 700, z0: 300, z1: 318 }],
      ['right door', { x0: 400, x1: 800, y0: 0, y1: 700, z0: 300, z1: 318 }],
      ['side', { x0: 0, x1: 18, y0: 0, y1: 700, z0: 0, z1: 300 }],
      ['top', { x0: 0, x1: 800, y0: 700, y1: 718, z0: 0, z1: 318 }],
    ])
    const apart = spreadApart(boxes, 1.6)
    const at = (id: string, side: 'x0' | 'x1' | 'y0' | 'y1', axis: 0 | 1) => boxes.get(id)![side] + apart.get(id)![axis]
    expect(at('right door', 'x0', 0) - at('left door', 'x1', 0)).toBeGreaterThan(100)
    expect(at('top', 'y0', 1) - at('side', 'y1', 1)).toBeGreaterThan(100)
    expect([...spreadApart(boxes, 1).values()].flat().every((moved) => moved === 0)).toBe(true)
  })

  it('leaves a piece no line cuts without a number, and an empty design without a drawing', () => {
    const box = { x0: 0, x1: 100, y0: 0, y1: 100, z0: 0, z1: 18 }
    expect(drawDiagram(new Map([['loose', box]]), new Map(), new Map()).pieces[0].number).toBeNull()
    expect(drawDiagram(new Map(), new Map(), new Map())).toEqual({ width: 0, height: 0, pieces: [] })
  })
})
