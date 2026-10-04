import { describe, expect, it } from 'vitest'
import { testCatalog } from '../fixtures/catalog.test-util'
import type { FieldSpec } from './fields'
import type { FurnitureModule } from './module'
import { partName } from './parts'
import { FURNITURE_KINDS, MODULES, type FurniturePlan } from './plan'

const keys = (fields: FieldSpec<FurniturePlan>[]): string[] =>
  fields.flatMap((f) => (f.type === 'section' || f.type === 'numbers' ? keys(f.fields as FieldSpec<FurniturePlan>[]) : 'key' in f ? [f.key] : []))

describe.each(FURNITURE_KINDS)('the parts of %s', (kind) => {
  const module = MODULES[kind] as unknown as FurnitureModule<FurniturePlan>
  const variants = module.benchVariants()

  it('gather every field of its form, each in one part only; a cabinet’s columns are the interior view’s', () => {
    const form = keys(module.fields)
    const gathered = module.parts.list.flatMap((p) => p.fields)
    expect(gathered.filter((k) => !form.includes(k))).toEqual([])
    expect(form.filter((k) => !gathered.includes(k))).toEqual(kind === 'cabinet' ? ['columns'] : [])
    expect(new Set(gathered).size).toBe(gathered.length)
  })

  it('give every piece a part it opens, but a cabinet’s boards inside, which the interior view edits', () => {
    const ids = new Set(module.parts.list.map((p) => p.id))
    const inside = (role: string) => kind === 'cabinet' && ['shelf', 'divider', 'bottom', 'top', 'other'].includes(role)
    const wrong = variants.flatMap(([name, plan]) =>
      module
        .build(plan, testCatalog)
        .design.pieces.filter((piece) => {
          const part = module.parts.ofPiece(piece)
          return part === null ? !inside(piece.role) : !ids.has(part)
        })
        .map((piece) => `${name}: ${piece.id}`),
    )
    expect(wrong).toEqual([])
  })

  it('say how each part is now, for every variant', () => {
    for (const [, plan] of variants) for (const part of module.parts.list) expect(`${partName(part, plan)}: ${part.summary(plan, 'Barniz')}`).not.toMatch(/undefined|NaN|: $/)
  })
})

describe('how a part reads', () => {
  it('agrees with how many there are', () => {
    const cabinet = MODULES.cabinet
    const [, plan] = cabinet.benchVariants().find(([name]) => name === 'alacena')!
    const doors = cabinet.parts.list.find((p) => p.id === 'doors')!
    const one = { ...plan, columns: [{ width: 1, cells: [{ height: 1, content: 'door' as const, shelves: 0, doors: 1 }] }] }
    expect(doors.summary(one, '')).toBe('1 puerta sobrepuesta')
    expect(doors.summary({ ...one, columns: [...one.columns, ...one.columns] }, '')).toBe('2 puertas sobrepuestas')
  })
})

describe('the parts a touch opens', () => {
  const opened = (kind: keyof typeof MODULES, id: string, role = 'side') => (MODULES[kind] as unknown as FurnitureModule<FurniturePlan>).parts.ofPiece({ id, role } as never)
  it('follow what the piece is part of', () => {
    expect(opened('cabinet', 'c1-h1-door', 'door')).toBe('doors')
    expect(opened('cabinet', 'leg-front-left-1', 'divider')).toBe('base')
    expect(opened('cabinet', 'top', 'top')).toBe('body')
    expect(opened('cabinet', 'c1-sep-1', 'shelf')).toBeNull()
    expect(opened('bed', 'head-shelf-1', 'shelf')).toBe('headboard')
    expect(opened('bed', 'kick-left-1', 'kick')).toBe('drawers')
    expect(opened('bed', 'platform', 'bottom')).toBe('mattress')
    expect(opened('table', 'top', 'top')).toBe('top')
    expect(opened('table', 'ped-div', 'divider')).toBe('under')
    expect(opened('table', 'leg-front-left-1', 'divider')).toBe('legs')
    expect(opened('shoeRack', 'kick', 'kick')).toBe('base')
    expect(opened('shoeRack', 'c1-h1-shelf-1', 'shelf')).toBe('shoes')
  })
})
