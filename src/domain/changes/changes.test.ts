import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import type { Diseno } from '../diseno/esquema'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { applyOperations } from '../operaciones/apply'
import type { Operation } from '../operaciones/schema'
import { describeChange, restorePieces } from './changes'

const apply = (d: Diseno, ops: Operation[]) => {
  const r = applyOperations(d, ops, catalogo)
  if (!r.ok) throw new Error(r.errors[0].message)
  return r.value.design
}
const box = (d: Diseno, id: string) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(a.errores[0].message)
  return a.geo.boxes.get(id)!
}

describe('describeChange', () => {
  it('lists removed pieces as direct changes', () => {
    const after = apply(librero, [{ op: 'eliminarPieza', id: 'entrepano-2' }, { op: 'eliminarPieza', id: 'entrepano-3' }])
    expect(describeChange(librero, after, catalogo).direct.map((c) => [c.kind, c.name])).toEqual([['removed', 'Entrepaño 2'], ['removed', 'Entrepaño 3']])
  })

  it('a wider piece of furniture is a size change; the pieces only follow along', () => {
    const after = apply(librero, [{ op: 'cambiarDimensionGlobal', eje: 'x', valor: 800, regla: 'estirar' }])
    const change = describeChange(librero, after, catalogo)
    expect(change.dimensions).toBe('600 → 800 mm de ancho')
    expect(change.direct).toEqual([])
    expect(change.followed).toContain('Entrepaño 1')
  })

  it('says how a changed piece changed', () => {
    const after = apply(librero, [{ op: 'cambiarEspesor', ids: ['entrepano-1'], material: 'T15' }])
    expect(describeChange(librero, after, catalogo).direct).toEqual([{ id: 'entrepano-1', name: 'Entrepaño 1', kind: 'changed', detail: '18 → 15 mm de espesor' }])
  })
})

describe('restorePieces', () => {
  it('brings back removed shelves with their supports, and keeps what came after', () => {
    const removed = apply(librero, [{ op: 'eliminarPieza', id: 'entrepano-2' }, { op: 'eliminarPieza', id: 'entrepano-3' }])
    const later = apply(removed, [{ op: 'cambiarEspesor', ids: ['entrepano-1'], material: 'T15' }])
    const r = restorePieces(later, librero, ['entrepano-2'], catalogo)
    if (!r.ok) throw new Error(r.errors[0].message)
    expect(r.design.piezas.some((p) => p.id === 'entrepano-2')).toBe(true)
    expect(r.design.piezas.some((p) => p.id === 'entrepano-3')).toBe(false)
    expect(r.design.uniones.filter((u) => u.a === 'entrepano-2').map((u) => u.tipo)).toEqual(['soporte-repisa', 'soporte-repisa'])
    expect(box(r.design, 'entrepano-1').y1 - box(r.design, 'entrepano-1').y0).toBe(15)
  })

  it('reverts a changed piece and removes an added one', () => {
    const moved = apply(librero, [{ op: 'cambiarEspesor', ids: ['entrepano-1'], material: 'T15' }, { op: 'duplicarPieza', id: 'entrepano-4', nuevoId: 'entrepano-5', nombre: 'Entrepaño 5', eje: 'y', cota: { tipo: 'mm', mm: 1500 } }])
    const r = restorePieces(moved, librero, ['entrepano-1', 'entrepano-5'], catalogo)
    if (!r.ok) throw new Error(r.errors[0].message)
    expect(box(r.design, 'entrepano-1').y1 - box(r.design, 'entrepano-1').y0).toBe(18)
    expect(r.design.piezas.some((p) => p.id === 'entrepano-5')).toBe(false)
    expect(analizar(r.design, catalogo).valido).toBe(true)
  })
})
