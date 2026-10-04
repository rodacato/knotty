import { describe, expect, it } from 'vitest'
import { testCatalog } from '../fixtures/catalog.test-util'
import { buildCabinet, cabinetModule, DEFAULT_CONSTRUCTION, type CabinetPlan } from './cabinet'
import { CABINET_PARTS, partOfPiece } from './cabinetParts'
import type { FieldSpec } from './fields'

const sideboard: CabinetPlan = {
  kind: 'cabinet',
  name: 'Aparador',
  dimensions: { width: 1200, height: 800, depth: 400 },
  material: 'T18',
  base: 'legs',
  legHeight: 150,
  wallMounted: true,
  construction: DEFAULT_CONSTRUCTION,
  columns: [
    { width: 1, cells: [{ height: 0.7, content: 'door', shelves: 1, doors: 1 }, { height: 0.3, content: 'drawer', shelves: null, doors: null }] },
    { width: 1, cells: [{ height: 1, content: 'open', shelves: 1, doors: null }] },
  ],
}

const keys = (fields: FieldSpec<CabinetPlan>[]): string[] =>
  fields.flatMap((f) => (f.type === 'section' || f.type === 'numbers' ? keys(f.fields as FieldSpec<CabinetPlan>[]) : 'key' in f ? [f.key] : []))

describe('the parts of a cabinet', () => {
  it('give every piece seen from outside a part, and leave the boards inside to the interior view', () => {
    const { design } = buildCabinet(sideboard, testCatalog)
    const by = (part: string | null) => design.pieces.filter((p) => partOfPiece(p) === part).map((p) => p.id)
    expect(by('doors')).toEqual(['c1-h1-door'])
    expect(by('base')).toContain('leg-front-left-1')
    expect(by('base')).toContain('apron-front')
    expect(by('body')).toEqual(expect.arrayContaining(['side-left', 'side-right', 'top', 'bottom', 'back']))
    expect(by('drawers').every((id) => id.startsWith('drawer-1'))).toBe(true)
    expect(by(null)).toEqual(expect.arrayContaining(['div-1', 'c1-sep-1', 'c1-h1-shelf-1']))
  })

  it('gather every field of the cabinet’s form, each in one part only; the columns are the interior view’s', () => {
    const form = keys(cabinetModule.fields as FieldSpec<CabinetPlan>[])
    const gathered = Object.values(CABINET_PARTS).flatMap((p) => p.fields)
    expect(gathered.filter((k) => !form.includes(k))).toEqual([])
    expect(form.filter((k) => !gathered.includes(k))).toEqual(['columns'])
    expect(new Set(gathered).size).toBe(gathered.length)
  })
})
