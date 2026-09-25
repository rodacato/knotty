import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { applyOperations } from '../operaciones/apply'
import { cutList } from './cutList'

describe('cut list names', () => {
  it('names a row after what its pieces share, or after both when they only share the end', () => {
    const r = applyOperations({ ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, depth: 500 } }, [
      { op: 'addDrawer', group: 'cajon-1', name: 'Cajón 1', left: 'lat-izq.x1', right: 'lat-der.x0', bottom: 'piso.y1', top: 'entrepano-1.y0', front: 'mueble.z1', back: 'trasera.z1', material: 'T15', bottomMaterial: 'TR6' },
    ], testCatalog)
    if (!r.ok) throw new Error('no drawer')
    const names = cutList(r.value.design, analyze(r.value.design, testCatalog).geo!).map((row) => row.name)
    expect(names).toEqual(expect.arrayContaining(['Entrepaño', 'Lateral', 'Costado de cajón 1', 'Contrafrente y trasera de cajón 1']))
  })
})
