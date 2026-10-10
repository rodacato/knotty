import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { resolveGeometry } from '../../design/resolve'
import { testCatalog } from '../fixtures/catalog.test-util'
import { testReferences } from '../fixtures/references.test-util'
import { buildCabinet, cabinetModule, DEFAULT_CONSTRUCTION, leafCells, pullsIn, type CabinetPlan, type PlanCell } from './cabinet'
import { addColumn, cellAt, cellLayout, cellPaths, chooseInCell, joinCells, joinSides, lineShare, moveLine, ONLY_COLUMN, removeColumn, splitCell } from './cabinetCells'
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

  it('reads as the cells it adds, each counted by what it holds', () => {
    expect(cabinetModule.describeChanges(sideboard, splitCell(sideboard, [0, 0], 'rows', 2)!)).toEqual(['2 puertas'])
    expect(cabinetModule.describeChanges(sideboard, splitCell(sideboard, [1, 0], 'columns', 3)!)).toEqual(['4 columnas', '3 huecos abiertos'])
    expect(cabinetModule.describeChanges(splitCell(sideboard, [0, 0], 'rows', 2)!, sideboard)).toEqual(['1 puerta'])
  })

  it('refuses a path that reaches no cell, or fewer than two parts', () => {
    const nested = splitCell(sideboard, [0, 1], 'columns', 2)!
    expect(splitCell(nested, [0, 1], 'rows', 2)).toBeNull()
    expect(splitCell(sideboard, [0, 0], 'rows', 1)).toBeNull()
    expect(splitCell(sideboard, [5, 0], 'rows', 2)).toBeNull()
  })
})

describe('a choice of a cell', () => {
  it('is kept with the cell, and going back to the furniture’s removes it, with nothing left over', () => {
    const p = sideboard
    const chosen = chooseInCell(p, [0, 0], 'pulls', 'handle')!
    expect(cellAt(chosen, [0, 0])!.own).toEqual({ pulls: 'handle' })
    const both = chooseInCell(chosen, [0, 0], 'fronts', 'grooved')!
    expect(cellAt(chooseInCell(both, [0, 0], 'pulls', undefined)!, [0, 0])!.own).toEqual({ fronts: 'grooved' })
    expect(cellAt(chooseInCell(chosen, [0, 0], 'pulls', undefined)!, [0, 0])).not.toHaveProperty('own')
    expect(cellAt(p, [0, 0])!.own).toBeUndefined()
  })

  it('choosing what the furniture already has leaves the cell following it, so a later change to the whole piece reaches it', () => {
    const p = sideboard
    expect(p.construction.fronts).toBe('flat')
    const same = chooseInCell(p, [0, 0], 'fronts', 'flat')!
    expect(cellAt(same, [0, 0])).not.toHaveProperty('own')
    const back = chooseInCell(chooseInCell(p, [0, 0], 'fronts', 'grooved')!, [0, 0], 'fronts', 'flat')!
    expect(cellAt(back, [0, 0])).not.toHaveProperty('own')
    const grooved = { ...same, construction: { ...same.construction, fronts: 'grooved' as const } }
    expect(JSON.stringify(built(grooved).design)).toBe(JSON.stringify(built({ ...p, construction: grooved.construction }).design))
    expect(JSON.stringify(built(grooved).design)).not.toBe(JSON.stringify(built(p).design))
    expect(cellAt(chooseInCell(p, [0, 0], 'fronts', 'grooved')!, [0, 0])!.own).toEqual({ fronts: 'grooved' })
  })

  it('a pull the furniture does not say is the one the cell’s front takes: choosing that one pins nothing, another one does', () => {
    const p = sideboard
    expect(p.construction.pulls).toBeUndefined()
    expect([pullsIn(p.construction, cellAt(p, [0, 0])!), pullsIn(p.construction, cellAt(p, [0, 1])!)]).toEqual(['none', 'notch'])
    expect(cellAt(chooseInCell(p, [0, 0], 'pulls', 'none')!, [0, 0])).not.toHaveProperty('own')
    const drawerNotch = chooseInCell(p, [0, 1], 'pulls', 'notch')!
    expect(cellAt(drawerNotch, [0, 1])).not.toHaveProperty('own')
    expect(cellAt(chooseInCell(p, [0, 0], 'pulls', 'notch')!, [0, 0])!.own).toEqual({ pulls: 'notch' })
    expect(cellAt(chooseInCell(p, [0, 1], 'pulls', 'none')!, [0, 1])!.own).toEqual({ pulls: 'none' })
    const handles = { ...drawerNotch, construction: { ...drawerNotch.construction, pulls: 'handle' as const } }
    expect(pullsIn(handles.construction, cellAt(handles, [0, 1])!)).toBe('handle')
    expect(JSON.stringify(built(handles).design)).toBe(JSON.stringify(built({ ...p, construction: handles.construction }).design))
    expect(JSON.stringify(built(handles).design)).not.toBe(JSON.stringify(built(p).design))
  })

  it('a door that goes sliding closes with two leaves, since one would cover half its opening; going back keeps them', () => {
    const p = sideboard
    expect(cellAt(p, [0, 0])).toMatchObject({ content: 'door', doors: 1 })
    const sliding = chooseInCell(p, [0, 0], 'doors', 'sliding')!
    expect(cellAt(sliding, [0, 0])).toMatchObject({ doors: 2, own: { doors: 'sliding' } })
    expect(cellAt(chooseInCell(sliding, [0, 0], 'doors', undefined)!, [0, 0])!.doors).toBe(2)
    expect(cellAt(chooseInCell(p, [0, 0], 'pulls', 'handle')!, [0, 0])!.doors).toBe(1)
  })

  it('refuses a path that reaches no cell', () => {
    expect(chooseInCell(sideboard, [9, 9], 'pulls', 'handle')).toBeNull()
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

/** The plan a shipped cabinet ficha builds from. */
const shipped = (code: string) => {
  const plan = testReferences.latest(code)?.plan
  if (plan?.kind !== 'cabinet') throw new Error(`${code} is not a shipped cabinet`)
  return plan
}
const widths = (plan: CabinetPlan) => plan.columns.map((c) => c.width)
const share = (plan: CabinetPlan, i: number) => plan.columns[i].width / widths(plan).reduce((s, v) => s + v, 0)

describe('a whole column of the furniture', () => {
  const sideboardFicha = shipped('KC-APA-01')

  it.each([['left', 1], ['right', 2]] as const)('is added to the %s of a column with several cells, open and from the bottom to the top', (side, at) => {
    expect(sideboardFicha.columns[1].cells.length).toBeGreaterThan(1)
    const added = addColumn(sideboardFicha, [1, 1], side)!
    expect(added.path).toEqual([at, 0])
    expect(added.plan.columns).toHaveLength(sideboardFicha.columns.length + 1)
    expect(added.plan.columns[at]).toEqual({ width: 1, cells: [{ height: 1, content: 'open', shelves: 0, doors: null }] })
    expect(added.plan.columns.filter((_, i) => i !== at)).toEqual(sideboardFicha.columns)
    const { box, boxes } = built(added.plan)
    const layout = cellLayout(added.plan, boxes)!
    const row = added.plan.columns.map((_, i) => layout.cells.find((c) => c.path[0] === i && c.y0 === box('bottom').y1)!)
    expect(row[0].x0).toBe(box('side-left').x1)
    expect(row.at(-1)!.x1).toBe(box('side-right').x0)
    const board = box('side-left').x1 - box('side-left').x0
    row.slice(1).forEach((c, i) => expect(c.x0 - row[i].x1).toBeCloseTo(board))
    expect(row[at].y1).toBe(box('top').y0)
  })

  it('takes the average width, and the others shrink in proportion', () => {
    const bookcase = shipped('KC-LIB-02')
    expect(new Set(widths(bookcase)).size).toBeGreaterThan(1)
    const { plan } = addColumn(bookcase, [0, 0], 'right')!
    const n = bookcase.columns.length
    expect(share(plan, 1)).toBeCloseTo(1 / (n + 1))
    bookcase.columns.forEach((_, i) => expect(share(plan, i < 1 ? i : i + 1)).toBeCloseTo((share(bookcase, i) * n) / (n + 1)))
    const uneven = addColumn(shipped('KC-OTR-02'), [0, 0], 'left')!.plan
    expect(uneven.columns[0].width).toBe(0.333)
    built(plan)
  })

  it('is removed, and the others keep their proportions', () => {
    const bookcase = shipped('KC-LIB-02')
    const removed = removeColumn(bookcase, [1, 2])
    if (!removed || 'refused' in removed) throw new Error('refused')
    expect(removed.plan.columns).toEqual(bookcase.columns.filter((_, i) => i !== 1))
    expect(share(removed.plan, 0) / share(removed.plan, 2)).toBeCloseTo(share(bookcase, 0) / share(bookcase, 3))
    expect(removed.path).toEqual([0, 0])
    expect(removeColumn(bookcase, [0, 0])).toMatchObject({ path: [0, 0] })
    built(removed.plan)
  })

  it('added and then removed leaves the plan as it was, number by number: the other widths are never rewritten', () => {
    for (const side of ['left', 'right'] as const) {
      const added = addColumn(sideboardFicha, [2, 0], side)!
      expect(removeColumn(added.plan, added.path)).toMatchObject({ plan: sideboardFicha })
    }
  })

  it('is the one that holds the cell, when the cell sits inside a split cell', () => {
    const tower = shipped('KC-OTR-04')
    const inner = cellPaths(tower).find((p) => p.length > 2 && p[0] === 0)!
    const added = addColumn(tower, inner, 'right')!
    expect(added.path).toEqual([1, 0])
    expect([added.plan.columns[0], added.plan.columns[2]]).toEqual(tower.columns)
    const removed = removeColumn(tower, inner)
    expect(removed).toMatchObject({ plan: { columns: [tower.columns[1]] }, path: [0, 0] })
    const left = removeColumn(tower, [1, 0])
    expect(left && 'path' in left && cellAt(left.plan, left.path)).toBeTruthy()
    expect(left && 'path' in left && left.path.length).toBeGreaterThan(2)
  })

  it('is not removed when it is the only one, or when what is left breaks a rule of the cabinet', () => {
    expect(removeColumn(shipped('KC-BUR-01'), [0, 0])).toEqual({ refused: ONLY_COLUMN })
    const raised = shipped('KC-LIB-09')
    expect(raised.columns[1].cells[0].content).toBe('void')
    expect(removeColumn(raised, [0, 0])).toEqual({ refused: expect.stringMatching(/al menos una columna llega al piso/) })
    expect(removeColumn(raised, [1, 1])).toMatchObject({ plan: { columns: [raised.columns[0]] } })
    expect(removeColumn(raised, [1, 0, 0])).toBeNull()
    expect(addColumn(raised, [7, 0], 'left')).toBeNull()
  })

  it('can be added beside every column of every shipped cabinet, but one whose top is the lid of its chest and the two too narrow to take one more', () => {
    const refused: string[] = []
    for (const code of new Set(testReferences.all().map((r) => r.code))) {
      const plan = testReferences.latest(code)!.plan
      if (plan?.kind !== 'cabinet') continue
      plan.columns.forEach((_, i) => {
        for (const side of ['left', 'right'] as const) {
          try {
            built(addColumn(plan, cellPaths(plan).find((p) => p[0] === i)!, side)!.plan)
          } catch (e) {
            refused.push(`${code} ${i} ${side}: ${(e as Error).message}`)
          }
        }
      })
    }
    const narrow = refused.filter((r) => /: No cupo: una columna quedaría con menos de 100 mm libres/.test(r))
    expect(new Set(narrow.map((r) => r.split(' ')[0]))).toEqual(new Set(['GN-COC-07', 'KC-REP-03']))
    expect(refused.filter((r) => !narrow.includes(r))).toEqual(['left', 'right'].map((side) => expect.stringMatching(new RegExp(`^GN-BAU-01 0 ${side}: Un baúl va debajo de un hueco abierto`))))
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
