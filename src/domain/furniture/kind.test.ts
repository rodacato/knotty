import { describe, expect, it } from 'vitest'
import { exampleBookcase } from './fixtures/bookcase'
import { sideboardPlan, testReferences } from './fixtures/references.test-util'
import { valueFields } from './modules/fields'
import { FurniturePlan, MODULES } from './modules/plan'
import { tableModule, type TablePlan } from './modules/table'
import { kindChange, kindOf, planForKind, settleKind, startingKind, type KnownKind } from './kind'

const k = (kind: KnownKind['kind'], source: KnownKind['source']): KnownKind => ({ kind, source })
const table = MODULES.table.benchVariants()[0][1]

describe('which kind a design keeps', () => {
  it('nothing overrides the person but the person', () => {
    expect(settleKind(k('bookcase', 'person'), k('bed', 'plan'))).toEqual(k('bookcase', 'person'))
    expect(settleKind(k('bookcase', 'person'), k('wardrobe', 'example'))).toEqual(k('bookcase', 'person'))
    expect(settleKind(k('bookcase', 'person'), k('wardrobe', 'person'))).toEqual(k('wardrobe', 'person'))
  })

  it('the person may choose the module’s own word over a use', () => {
    expect(settleKind(k('bookcase', 'example'), k('cabinet', 'person'))).toEqual(k('cabinet', 'person'))
    expect(settleKind(k('desk', 'plan'), k('table', 'person'))).toEqual(k('table', 'person'))
    expect(startingKind({ person: 'cabinet', built: k('cabinet', 'plan'), photo: null, words: 'Un librero' })).toEqual(k('cabinet', 'person'))
  })

  it('an example or a plan beats the photo, and the photo beats the words', () => {
    expect(settleKind(k('bookcase', 'photo'), k('nightstand', 'example'))).toEqual(k('nightstand', 'example'))
    expect(settleKind(k('bookcase', 'words'), k('wardrobe', 'photo'))).toEqual(k('wardrobe', 'photo'))
    expect(settleKind(k('wardrobe', 'photo'), k('bookcase', 'words'))).toEqual(k('wardrobe', 'photo'))
  })

  it('within one module a use refines the module’s own word, whoever said it', () => {
    expect(settleKind(k('cabinet', 'plan'), k('bookcase', 'words'))).toEqual(k('bookcase', 'words'))
    expect(settleKind(k('bookcase', 'words'), k('cabinet', 'plan'))).toEqual(k('bookcase', 'words'))
    expect(settleKind(k('cabinet', 'person'), k('bookcase', 'words'))).toEqual(k('cabinet', 'person'))
  })

  it('at the start the person wins, then the plan, then the photo, then the words', () => {
    const all = { built: k('cabinet', 'plan'), photo: 'clóset', words: 'Un librero para la sala' }
    expect(startingKind({ ...all, person: 'sideboard' })).toEqual(k('sideboard', 'person'))
    expect(startingKind({ ...all, person: null })).toEqual(k('wardrobe', 'photo'))
    expect(startingKind({ ...all, photo: null, person: null })).toEqual(k('bookcase', 'words'))
    expect(startingKind({ person: null, built: k('bed', 'plan'), photo: 'librero', words: '' })).toEqual(k('bed', 'plan'))
    expect(startingKind({ person: null, built: null, photo: null, words: 'Un exhibidor escalonado' })).toBeNull()
  })

  it('a design that does not say is known by its name, or unknown', () => {
    expect(kindOf({ name: 'Aparador' })).toEqual(k('sideboard', 'words'))
    expect(kindOf({ name: 'Exhibidor' })).toEqual({ kind: 'unknown', source: null })
    expect(kindOf({ name: 'Mueble', kind: 'bed' })).toEqual(k('bed', 'plan'))
  })
})

describe('changing the kind', () => {
  it('keeps the plan within its module, needs a new design across modules, and fits anything without a plan', () => {
    const cabinet = { ...exampleBookcase, kind: undefined }
    expect(kindChange(cabinet, sideboardPlan, 'wardrobe')).toBe('in-place')
    expect(kindChange(cabinet, sideboardPlan, 'bed')).toBe('redo')
    expect(kindChange(cabinet, sideboardPlan, 'bench')).toBe('redo')
    expect(kindChange(cabinet, null, 'bed')).toBe('in-place')
    expect(kindChange({ ...cabinet, kind: 'wardrobe', kindSource: 'person' }, sideboardPlan, 'wardrobe')).toBe('same')
  })

  it('a bench has no module, and a table becomes one in place: its plan says the use', () => {
    expect(kindChange({ ...exampleBookcase, kind: 'diningTable' }, table, 'bench')).toBe('in-place')
    expect(planForKind(table, 'bench')).toMatchObject({ use: 'seat', name: 'Banco' })
    expect(kindChange({ ...exampleBookcase, kind: 'bench' }, planForKind(table, 'bench'), 'bench')).toBe('in-place')
    expect(kindChange({ ...exampleBookcase, kind: 'bench' }, planForKind(table, 'bench'), 'bookcase')).toBe('redo')
  })

  it('a table’s use is its kind; other plans do not say their use', () => {
    expect(planForKind(table, 'desk')).toMatchObject({ use: 'desk' })
    expect(planForKind(table, 'bookcase')).toBe(table)
    expect(planForKind(sideboardPlan, 'tvStand')).toBe(sideboardPlan)
  })
})

describe('changing what a table is for', () => {
  const useField = valueFields(tableModule.fields).find((f) => f.key === 'use')!
  const byUso = (plan: TablePlan, use: TablePlan['use']) => useField.set(plan, use as never)
  const byKind = (plan: TablePlan, kind: Parameters<typeof planForKind>[1]) => planForKind(plan, kind) as TablePlan
  const oakDesk = testReferences.latest('KC-ESC-07')!.plan as TablePlan

  it('«Uso» and «Tipo de mueble» give the same plan: a desk made a dining table loses its pedestal either way, and the plan holds', () => {
    const desk = MODULES.table.benchVariants().find(([name]) => name === 'escritorio con 3 cajones a la izquierda')![1]
    const dining = byKind(desk, 'diningTable')
    expect(dining).toEqual(byUso(desk, 'dining'))
    expect(dining).toMatchObject({ use: 'dining', name: 'Escritorio con cajonera', pedestal: { side: 'none', drawers: 0 } })
    expect(FurniturePlan.safeParse(dining).success).toBe(true)
  })

  it('a coffee table made a desk loses its low shelf either way', () => {
    const coffee = MODULES.table.benchVariants().find(([name]) => name === 'centro')![1]
    expect(coffee.shelf).toBe(true)
    expect(byKind(coffee, 'desk')).toEqual(byUso(coffee, 'desk'))
    expect(byKind(coffee, 'desk').shelf).toBe(false)
  })

  it('a ficha keeps its own name through a change of use and back', () => {
    expect(oakDesk.name).not.toBe('Escritorio')
    const there = byUso(oakDesk, 'dining')
    expect(there.name).toBe(oakDesk.name)
    expect(byKind(there, 'desk').name).toBe(oakDesk.name)
  })

  it('a table still called by the plain name of its use takes the name of the new one', () => {
    expect(table).toMatchObject({ use: 'dining', name: 'Mesa de comedor' })
    expect(byUso(table, 'desk').name).toBe('Escritorio')
    expect(byKind(table, 'coffeeTable').name).toBe('Mesa de centro')
  })
})
