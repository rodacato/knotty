import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { resolveGeometry } from '../../design/resolve'
import { testCatalog } from '../fixtures/catalog.test-util'
import { buildCabinet, DEFAULT_CONSTRUCTION, leafCells, type CabinetPlan, type PlanCell } from './cabinet'
import { cellAt, cellLayout, cellPaths, joinCells, joinSides, lineShare, moveLine, splitCell } from './cabinetCells'
import { FurniturePlan } from './plan'

const open = (height = 1, shelves = 0): PlanCell => ({ height, content: 'open', shelves, doors: null })
const drawer = (height = 1): PlanCell => ({ height, content: 'drawer', shelves: null, doors: null })
const door = (height = 1): PlanCell => ({ height, content: 'door', shelves: 0, doors: 1 })
const sideboard: CabinetPlan = {
  kind: 'cabinet',
  name: 'Aparador',
  dimensions: { width: 1200, height: 800, depth: 400 },
  material: 'T18',
  base: 'kick',
  legHeight: 150,
  wallMounted: true,
  construction: DEFAULT_CONSTRUCTION,
  columns: [
    { width: 1, cells: [door(0.7), drawer(0.3)] },
    { width: 1, cells: [open(1, 1)] },
  ],
}

/** The plan as the app would take it, built, and checked: an edit must never leave a plan Knotty cannot build. */
function built(plan: CabinetPlan) {
  const parsed = FurniturePlan.safeParse(plan)
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('\n'))
  const { design } = buildCabinet(parsed.data as CabinetPlan, testCatalog)
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
  const geo = resolveGeometry(design, testCatalog)
  if (!geo.ok) throw new Error('no geometry')
  return { design, boxes: geo.value.boxes, box: (id: string) => geo.value.boxes.get(id)! }
}

describe('cutting a cell', () => {
  it('into rows adds cells to its column that share its height', () => {
    const next = splitCell(sideboard, [0, 0], 'rows', 2)!
    expect(next.columns[0].cells.map((c) => [c.content, c.height])).toEqual([['door', 0.35], ['door', 0.35], ['drawer', 0.3]])
    built(next)
  })

  it('into columns, a column’s only cell splits the column itself, with a divider from the bottom to the top', () => {
    const next = splitCell(sideboard, [1, 0], 'columns', 2)!
    expect(next.columns.map((c) => c.width)).toEqual([1, 0.5, 0.5])
    const { box } = built(next)
    expect(box('div-2').y0).toBe(box('bottom').y1)
    expect(box('div-2').y1).toBe(box('top').y0)
  })

  it('into columns, any other cell becomes a split cell, with a divider only as tall as it', () => {
    const next = splitCell(sideboard, [0, 1], 'columns', 3)!
    expect(next.columns[0].cells[1].columns?.map((c) => c.cells.map((x) => x.content))).toEqual([['drawer'], ['drawer'], ['drawer']])
    const { box } = built(next)
    expect(box('c1-h2-div-1').y0).toBe(box('c1-sep-1').y1)
    expect(cellPaths(next)).toContainEqual([0, 1, 2, 0])
  })

  it('makes a void open, since a part of one could sit between two cells', () => {
    const hanging: CabinetPlan = { ...sideboard, columns: [{ width: 1, cells: [{ ...open(0.3), content: 'void' }, open(0.7)] }, { width: 1, cells: [open()] }] }
    expect(splitCell(hanging, [0, 0], 'rows', 2)!.columns[0].cells.map((c) => c.content)).toEqual(['open', 'open', 'open'])
  })

  it('refuses a path that reaches no cell, or fewer than two parts', () => {
    const nested = splitCell(sideboard, [0, 1], 'columns', 2)!
    expect(splitCell(nested, [0, 1], 'rows', 2)).toBeNull()
    expect(splitCell(sideboard, [0, 0], 'rows', 1)).toBeNull()
    expect(splitCell(sideboard, [5, 0], 'rows', 2)).toBeNull()
  })
})

describe('joining cells', () => {
  it('undoes a cut into rows', () => {
    const cut = splitCell(sideboard, [0, 0], 'rows', 2)!
    expect(joinSides(cut, [0, 0])).toEqual(['up'])
    const joined = joinCells(cut, [0, 0], 'up')!
    expect(joined.path).toEqual([0, 0])
    expect(joined.plan.columns[0].cells.map((c) => [c.content, Number(c.height.toFixed(2))])).toEqual([['door', 0.7], ['drawer', 0.3]])
  })

  it('undoes a cut into columns of the furniture', () => {
    const cut = splitCell(sideboard, [1, 0], 'columns', 2)!
    const joined = joinCells(cut, [1, 0], 'right')!
    expect(joined.plan.columns.map((c) => c.width)).toEqual([1, 1])
    built(joined.plan)
  })

  it('leaves no split cell with a single column: its cells take its place', () => {
    const cut = splitCell(sideboard, [0, 1], 'columns', 2)!
    const joined = joinCells(cut, [0, 1, 0, 0], 'right')!
    expect(joined.plan.columns[0].cells.map((c) => [c.content, 'columns' in c])).toEqual([['door', false], ['drawer', false]])
    expect(joined.path).toEqual([0, 1])
    expect(cellAt(joined.plan, joined.path)?.content).toBe('drawer')
    built(joined.plan)
  })

  it('offers no side whose neighbour is split, or a neighbour that did not come out of the same cut', () => {
    const cut = splitCell(sideboard, [0, 1], 'columns', 2)!
    expect(joinSides(cut, [0, 0])).toEqual([])
    // The door shares its column with the drawer: joining it sideways would leave a cell across two columns of different cuts.
    expect(joinSides(sideboard, [0, 0])).toEqual(['up'])
    expect(joinCells(sideboard, [0, 0], 'right')).toBeNull()
  })
})

describe('moving a line', () => {
  it('trades size between the two parts beside it and keeps the rest', () => {
    const line = { axis: 'cells' as const, at: [0], index: 0 }
    expect(lineShare(sideboard, line)).toBeCloseTo(0.7)
    const next = moveLine(sideboard, line, 0.5)
    expect(next.columns[0].cells.map((c) => c.height)).toEqual([0.5, 0.5])
    expect(lineShare(next, line)).toBeCloseTo(0.5)
    built(next)
  })

  it('never makes a part smaller than the least share', () => {
    const line = { axis: 'columns' as const, at: [], index: 0 }
    const next = moveLine(sideboard, line, 0.99, 0.1)
    const [a, b] = next.columns.map((c) => c.width)
    expect(a).toBeCloseTo(1.8)
    expect(b).toBeCloseTo(0.2)
  })
})

describe('where the cells are', () => {
  it('matches the boards the cabinet builds, at every depth of splitting', () => {
    const plan = splitCell(splitCell(sideboard, [0, 1], 'columns', 2)!, [1, 0], 'rows', 2)!
    const { box, boxes } = built(plan)
    const layout = cellLayout(plan, boxes)!
    const at = (path: number[]) => layout.cells.find((c) => c.path.join('.') === path.join('.'))!
    expect(at([0, 0])).toMatchObject({ x0: box('side-left').x1, x1: box('div-1').x0, y0: box('bottom').y1, y1: box('c1-sep-1').y0 })
    expect(at([0, 1, 1, 0])).toMatchObject({ x0: box('c1-h2-div-1').x1, x1: box('div-1').x0, y0: box('c1-sep-1').y1, y1: box('top').y0 })
    expect(at([1, 1]).y0).toBe(box('c2-sep-1').y1)
    const divider = box('c1-h2-div-1')
    expect(layout.lines.find((l) => l.axis === 'columns' && l.at.length === 2)!.position).toBeCloseTo((divider.x0 + divider.x1) / 2)
    expect(layout.cells).toHaveLength(leafCells(plan.columns).length)
  })
})
