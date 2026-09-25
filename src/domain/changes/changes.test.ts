import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import type { Design } from '../diseno/schema'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { applyOperations } from '../operaciones/apply'
import type { Operation } from '../operaciones/schema'
import { describeChange, restorePieces } from './changes'

const apply = (d: Design, ops: Operation[]) => {
  const r = applyOperations(d, ops, testCatalog)
  if (!r.ok) throw new Error(r.errors[0].message)
  return r.value.design
}
const box = (d: Design, id: string) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return a.geo.boxes.get(id)!
}

describe('describeChange', () => {
  it('lists removed pieces as direct changes', () => {
    const after = apply(exampleBookcase, [{ op: 'removePiece', id: 'entrepano-2' }, { op: 'removePiece', id: 'entrepano-3' }])
    expect(describeChange(exampleBookcase, after, testCatalog).direct.map((c) => [c.kind, c.name])).toEqual([['removed', 'Entrepaño 2'], ['removed', 'Entrepaño 3']])
  })

  it('a wider piece of furniture is a size change; the pieces only follow along', () => {
    const after = apply(exampleBookcase, [{ op: 'resizeFurniture', axis: 'x', value: 800, rule: 'stretch' }])
    const change = describeChange(exampleBookcase, after, testCatalog)
    expect(change.dimensions).toBe('600 → 800 mm de ancho')
    expect(change.direct).toEqual([])
    expect(change.followed).toContain('Entrepaño 1')
  })

  it('says how a changed piece changed', () => {
    const after = apply(exampleBookcase, [{ op: 'changeMaterial', ids: ['entrepano-1'], material: 'T15' }])
    expect(describeChange(exampleBookcase, after, testCatalog).direct).toEqual([{ id: 'entrepano-1', name: 'Entrepaño 1', kind: 'changed', detail: '18 → 15 mm de espesor' }])
  })
})

describe('restorePieces', () => {
  it('brings back removed shelves with their supports, and keeps what came after', () => {
    const removed = apply(exampleBookcase, [{ op: 'removePiece', id: 'entrepano-2' }, { op: 'removePiece', id: 'entrepano-3' }])
    const later = apply(removed, [{ op: 'changeMaterial', ids: ['entrepano-1'], material: 'T15' }])
    const r = restorePieces(later, exampleBookcase, ['entrepano-2'], testCatalog)
    if (!r.ok) throw new Error(r.errors[0].message)
    expect(r.design.pieces.some((p) => p.id === 'entrepano-2')).toBe(true)
    expect(r.design.pieces.some((p) => p.id === 'entrepano-3')).toBe(false)
    expect(r.design.joints.filter((u) => u.a === 'entrepano-2').map((u) => u.type)).toEqual(['shelf-pin', 'shelf-pin'])
    expect(box(r.design, 'entrepano-1').y1 - box(r.design, 'entrepano-1').y0).toBe(15)
  })

  it('reverts a changed piece and removes an added one', () => {
    const moved = apply(exampleBookcase, [{ op: 'changeMaterial', ids: ['entrepano-1'], material: 'T15' }, { op: 'duplicatePiece', id: 'entrepano-4', newId: 'entrepano-5', name: 'Entrepaño 5', axis: 'y', at: { type: 'mm', mm: 1500 } }])
    const r = restorePieces(moved, exampleBookcase, ['entrepano-1', 'entrepano-5'], testCatalog)
    if (!r.ok) throw new Error(r.errors[0].message)
    expect(box(r.design, 'entrepano-1').y1 - box(r.design, 'entrepano-1').y0).toBe(18)
    expect(r.design.pieces.some((p) => p.id === 'entrepano-5')).toBe(false)
    expect(analyze(r.design, testCatalog).valid).toBe(true)
  })
})
