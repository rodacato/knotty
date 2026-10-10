import { describe, expect, it } from 'vitest'
import { analyze } from '../../domain/checks/analysis'
import { counterLines } from '../../domain/estimate/counterList'
import { estimatePurchase } from '../../domain/estimate/purchase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { buildPlan, MODULES, type FurniturePlan } from '../../domain/furniture/modules/plan'
import { drawDiagram, spreadApart, VIEWS, type Angle, type Shape } from './diagram'

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

  it('covers a board with the one that sits on it or in front of it, however far the middle of each is: a long top over a divider at its near end, a side over the drawer behind it', () => {
    const boxes = new Map([
      ['top', { x0: 0, x1: 1600, y0: 700, y1: 718, z0: 0, z1: 400 }],
      ['divider', { x0: 1400, x1: 1418, y0: 0, y1: 700, z0: 0, z1: 400 }],
      ['side', { x0: 1582, x1: 1600, y0: 0, y1: 700, z0: 0, z1: 400 }],
      ['drawer side', { x0: 1440, x1: 1452, y0: 100, y1: 250, z0: 20, z1: 380 }],
    ])
    const order = drawDiagram(boxes, new Map(), new Map(), 'right').pieces.map((p) => p.id)
    expect(order.indexOf('top')).toBeGreaterThan(order.indexOf('divider'))
    expect(order.indexOf('side')).toBeGreaterThan(order.indexOf('drawer side'))
    expect(order.indexOf('drawer side')).toBeGreaterThan(order.indexOf('divider'))
  })

  it('marks the pieces a drawing is about and no other', () => {
    const box = (x: number) => ({ x0: x, x1: x + 18, y0: 0, y1: 500, z0: 0, z1: 300 })
    const marked = (set?: Set<string>) => drawDiagram(new Map([['old', box(0)], ['new', box(800)]]), new Map(), new Map(), 'right', { marked: set }).pieces.filter((p) => p.marked).map((p) => p.id)
    expect(marked(new Set(['new']))).toEqual(['new'])
    expect(marked()).toEqual([])
  })

  it('draws a board with a corner sawn off as what is left of it, not as its rectangle', () => {
    const box = { x0: 0, x1: 18, y0: 0, y1: 150, z0: 0, z1: 80 }
    const sawn: Shape = { normal: 'x', points: [[0, 0], [150, 40], [150, 80], [0, 80]] }
    const whole: Shape = { normal: 'x', points: [[0, 0], [150, 0], [150, 80], [0, 80]] }
    const faces = (shape?: Shape) => drawDiagram(new Map([['leg', box]]), new Map(), new Map(), 'right', { shapes: shape && new Map([['leg', shape]]) }).pieces[0].faces.map((f) => f.points.split(' ').sort().join(' ')).sort()
    expect(faces(whole)).toEqual(faces())
    expect(faces(sawn)).not.toEqual(faces())
  })

  it('says a number is out of sight when a nearer board covers its spot, and moves the number of a long board off the one in front of it', () => {
    const boxes = new Map([
      ['rail', { x0: 0, x1: 1600, y0: 0, y1: 60, z0: 0, z1: 18 }],
      ['leg', { x0: 780, x1: 820, y0: 0, y1: 60, z0: 18, z1: 58 }],
      ['hidden', { x0: 100, x1: 300, y0: 100, y1: 300, z0: 0, z1: 18 }],
      ['door', { x0: 0, x1: 400, y0: 61, y1: 400, z0: 18, z1: 36 }],
    ])
    const diagram = drawDiagram(boxes, new Map(), new Map([['rail', 1], ['leg', 2], ['hidden', 3], ['door', 4]]))
    const of = (id: string) => diagram.pieces.find((p) => p.id === id)!
    expect(diagram.pieces.filter((p) => !p.seen).map((p) => p.id)).toEqual(['hidden'])
    expect(Math.hypot(of('rail').badge[0] - of('leg').badge[0], of('rail').badge[1] - of('leg').badge[1])).toBeGreaterThanOrEqual(2 * diagram.dot)
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
    expect(drawDiagram(new Map(), new Map(), new Map())).toEqual({ width: 0, height: 0, dot: 0, pieces: [] })
  })
})
