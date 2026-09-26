import { describe, expect, it } from 'vitest'
import { exampleBookcase } from './fixtures/bookcase'
import { sideboardPlan } from './examples'
import { MODULES } from './modules/plan'
import { kindChange, kindOf, planForKind, settleKind, startingKind, type KnownKind } from './kind'

const k = (kind: KnownKind['kind'], source: KnownKind['source']): KnownKind => ({ kind, source })
const table = MODULES.table.benchVariants()[0][1]

describe('which kind a design keeps', () => {
  it('nothing overrides the person but the person', () => {
    expect(settleKind(k('bookcase', 'person'), k('bed', 'plan'))).toEqual(k('bookcase', 'person'))
    expect(settleKind(k('bookcase', 'person'), k('wardrobe', 'example'))).toEqual(k('bookcase', 'person'))
    expect(settleKind(k('bookcase', 'person'), k('wardrobe', 'person'))).toEqual(k('wardrobe', 'person'))
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

  it('a table’s use is its kind; other plans do not say their use', () => {
    expect(planForKind(table, 'desk')).toMatchObject({ use: 'desk' })
    expect(planForKind(table, 'bookcase')).toBe(table)
    expect(planForKind(sideboardPlan, 'tvStand')).toBe(sideboardPlan)
  })
})
