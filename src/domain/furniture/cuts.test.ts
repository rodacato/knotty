import { describe, expect, it } from 'vitest'
import { analyze } from '../checks/analysis'
import { ASSUMPTIONS } from '../assumptions'
import { drawerSides } from '../design/drawers'
import type { Design } from '../design/schema'
import type { Box } from '../design/resolve'
import { cutList } from '../estimate/cutList'
import { slidesOf } from '../materials/catalog'
import { testCatalog } from './fixtures/catalog.test-util'
import { exampleDesign, exampleOf } from './examples'
import { testReferences } from './fixtures/references.test-util'

// What a person cuts is what the list prints, not the exact geometry: a ficha has to work as printed.

const built = testReferences.all().filter((r) => r.plan).map((r) => {
  const { design } = exampleDesign(exampleOf(r), testCatalog)
  const analysis = analyze(design, testCatalog)
  if (!analysis.valid) throw new Error(`${r.code} is not valid`)
  return { code: r.code, design, geo: analysis.geo }
})

/** The gap each drawer leaves on each side when its box is cut to the measures of the cut list. */
function printedDrawerGaps(design: Design, boxes: Map<string, Box>, printed: (id: string, exact: number) => number) {
  const sides = drawerSides(design, boxes)
  return [...new Set(sides.map((s) => s.group))].flatMap((group) => {
    const [left, right] = sides.filter((s) => s.group === group)
    const cross = design.pieces.find((p) => p.group === group && p.role === 'drawer-side' && p.normal === 'z')
    if (!left.support || !right.support || !cross) return []
    const [l, r, c] = [boxes.get(left.side.id)!, boxes.get(right.side.id)!, boxes.get(cross.id)!]
    const opening = r.x1 + right.support.distance - (l.x0 - left.support.distance)
    const box = printed(cross.id, c.x1 - c.x0) + (l.x1 - l.x0) + (r.x1 - r.x0)
    return [{ group, gap: (opening - box) / 2 }]
  })
}

describe('the cuts of the fichas', () => {
  it('every drawer box, cut as printed, leaves each slide the gap it takes: what it asks or up to its tolerance more', () => {
    const asks = Math.max(...slidesOf(testCatalog).map((s) => s.sideClearance))
    const { over, under } = ASSUMPTIONS.drawers.runnerTolerance
    const drawers = built.flatMap(({ code, design, geo }) => {
      const lines = cutList(design, geo)
      const printed = (id: string, exact: number) => {
        const line = lines.find((l) => l.ids.includes(id))!
        return Math.abs(line.length - exact) <= Math.abs(line.width - exact) ? line.length : line.width
      }
      return printedDrawerGaps(design, geo.boxes, printed).map((d) => ({ code, ...d }))
    })
    expect(drawers.length).toBeGreaterThan(60)
    expect(drawers.filter((d) => d.gap < asks - under - 1e-9 || d.gap > asks + over + 1e-9).map((d) => `${d.code} ${d.group}: ${Math.round(d.gap * 100) / 100} mm`)).toEqual([])
  })
})
