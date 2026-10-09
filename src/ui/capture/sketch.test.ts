import { describe, expect, it } from 'vitest'
import { resolveGeometry } from '../../domain/design/resolve'
import { exampleDesign } from '../../domain/furniture/examples'
import { testBases } from '../../domain/furniture/fixtures/references.test-util'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { paintOrder, sketch } from './sketch'

const boxesOf = (id: string) => {
  const { design } = exampleDesign(testBases.find((b) => b.id === id)!, testCatalog)
  const geo = resolveGeometry(design, testCatalog)
  if (!geo.ok) throw new Error('does not resolve')
  return { design, boxes: geo.value.boxes }
}

describe('the sketch of a base', () => {
  it.each(testBases.map((b) => [b.name, b.id]))('%s: every piece is drawn once, three faces each, inside its frame', (_, id) => {
    const { design, boxes } = boxesOf(id)
    const { polygons, width, height } = sketch(boxes)
    expect(polygons).toHaveLength(3 * design.pieces.length)
    expect(width).toBeGreaterThan(0)
    expect(polygons.flatMap((p) => p.points).every(([x, y]) => x >= 0 && y >= 0 && x <= width + 1e-6 && y <= height + 1e-6)).toBe(true)
  })

  it('paints what is in front last: the doors over the sides and shelves behind them, the top over the sides it rests between', () => {
    const { design, boxes } = boxesOf('low-sideboard')
    const order = paintOrder(boxes)
    const at = (id: string) => order.indexOf(id)
    const ids = (role: string) => design.pieces.filter((p) => p.role === role).map((p) => p.id)
    const covers = (door: string, shelf: string) => boxes.get(door)!.x0 < boxes.get(shelf)!.x1 && boxes.get(shelf)!.x0 < boxes.get(door)!.x1
    for (const door of ids('door')) {
      const shelves = ids('shelf').filter((shelf) => covers(door, shelf))
      expect(shelves.length).toBeGreaterThan(0)
      for (const behind of [...shelves, 'back', 'side-left']) expect(at(door)).toBeGreaterThan(at(behind))
    }
    expect(at('top')).toBeGreaterThan(at('side-left'))
  })

  it('paints a bed\'s platform over the drawers under it, even where a drawer sits to the right of a divider', () => {
    const { design, boxes } = boxesOf('bed-with-drawers')
    const order = paintOrder(boxes)
    const drawers = design.pieces.filter((p) => p.group && p.role.startsWith('drawer'))
    expect(drawers.length).toBeGreaterThan(0)
    for (const drawer of drawers) expect(order.indexOf(drawer.id)).toBeLessThan(order.indexOf(drawer.id.startsWith('drawer-left') ? 'platform-left' : 'platform-right'))
  })
})
