import { describe, expect, it } from 'vitest'
import { analyze } from '../checks/analysis'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../furniture/fixtures/bookcase'
import { applyOperations } from '../editing/operations/apply'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetPlan } from '../furniture/modules/cabinet'
import { afterCut, afterCutText, cutList } from './cutList'

describe('cut list names', () => {
  it('names every piece of a row, a run of numbers said once', () => {
    const r = applyOperations({ ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, depth: 500 } }, [
      { op: 'addDrawer', group: 'drawer-1', name: 'Cajón 1', left: 'side-left.x1', right: 'side-right.x0', bottom: 'bottom.y1', top: 'shelf-1.y0', front: 'furniture.z1', back: 'back.z1', material: 'T15', bottomMaterial: 'TR6' },
    ], testCatalog)
    if (!r.ok) throw new Error('no drawer')
    const names = cutList(r.value.design, analyze(r.value.design, testCatalog).geo!).map((row) => row.name)
    expect(names).toEqual(expect.arrayContaining(['Entrepaño 1 a 4', 'Lateral izquierdo, Lateral derecho', 'Costado izquierdo de cajón 1, Costado derecho de cajón 1', 'Contrafrente de cajón 1, Trasera de cajón 1']))
  })

  it('never drops the column of a piece when a row holds the shelves of two columns', () => {
    const cell = { height: 1, content: 'open', shelves: 5, doors: null } as const
    const { design } = buildCabinet({ kind: 'cabinet', name: 'Librero', dimensions: { width: 1200, height: 1800, depth: 300 }, material: 'T18', base: 'kick', legHeight: 150, wallMounted: true, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [cell] }, { width: 1, cells: [cell] }] }, testCatalog)
    const rows = cutList(design, analyze(design, testCatalog).geo!)
    expect(rows.find((row) => row.count === 10)?.name).toBe('Repisa 1 a 5 de la columna 1 y 2')
    expect(new Set(rows.map((row) => row.name)).size).toBe(rows.length)
  })
})

describe('what a line still needs once cut to size', () => {
  const sideboard = (more: Partial<CabinetPlan>): CabinetPlan => ({
    kind: 'cabinet', name: 'Aparador', dimensions: { width: 1200, height: 800, depth: 400 }, material: 'T18', base: 'legs', legHeight: 150, wallMounted: false, construction: DEFAULT_CONSTRUCTION,
    columns: [{ width: 1, cells: [{ height: 1, content: 'door', shelves: 1, doors: 1 }] }, { width: 1, cells: [{ height: 1, content: 'door', shelves: 1, doors: 1 }] }],
    ...more,
  })
  const said = (plan: CabinetPlan) => {
    const { design } = buildCabinet(plan, testCatalog)
    return Object.fromEntries(cutList(design, analyze(design, testCatalog).geo!).flatMap((line) => {
      const text = afterCutText(afterCut(design, line), line.count)
      return text ? [[line.name, text]] : []
    }))
  }

  it('says nothing of a furniture of plain rectangles', () => {
    expect(said(sideboard({}))).toEqual({})
  })

  it('names the diagonal on legs that lean, and on no other board', () => {
    const lines = said(sideboard({ legStyle: 'splayed' }))
    expect(Object.keys(lines).every((name) => /pata/i.test(name))).toBe(true)
    expect(new Set(Object.values(lines))).toEqual(new Set(['Después de cortarlas: corte diagonal']))
  })

  it('names the notch on the fronts that have one, and counts them when only some of a line do', () => {
    expect(said(sideboard({ construction: { ...DEFAULT_CONSTRUCTION, pulls: 'notch' } }))).toEqual({ 'Puerta de la columna 1 y 2': 'Después de cortarlas: saques o ranuras' })
    const [first, second] = sideboard({}).columns
    const oneNotched = sideboard({ columns: [{ ...first, cells: [{ ...first.cells[0], own: { pulls: 'notch' } }] }, second] })
    expect(said(oneNotched)).toEqual({ 'Puerta de la columna 1 y 2': 'Después de cortarlas: 1 de 2 con saques o ranuras' })
  })

  it('puts both on a single board that has both', () => {
    expect(afterCutText({ diagonal: 1, curved: 0, drilled: 0, routed: 1 }, 1)).toBe('Después de cortarla: corte diagonal · saques o ranuras')
    expect(afterCutText({ diagonal: 0, curved: 1, drilled: 1, routed: 0 }, 1)).toBe('Después de cortarla: esquinas redondeadas · barreno')
  })
})
