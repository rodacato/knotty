import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { applyOperations } from '../operaciones/apply'
import { cutList } from './cutList'

describe('cut list names', () => {
  it('names a row after what its pieces share, or after both when they only share the end', () => {
    const r = applyOperations({ ...exampleBookcase, dimensiones: { ...exampleBookcase.dimensiones, fondo: 500 } }, [
      { op: 'agregarCajon', grupo: 'cajon-1', nombre: 'Cajón 1', izquierda: 'lat-izq.x1', derecha: 'lat-der.x0', abajo: 'piso.y1', arriba: 'entrepano-1.y0', frente: 'mueble.z1', fondo: 'trasera.z1', material: 'T15', materialFondo: 'TR6' },
    ], testCatalog)
    if (!r.ok) throw new Error('no drawer')
    const names = cutList(r.value.design, analyze(r.value.design, testCatalog).geo!).map((row) => row.name)
    expect(names).toEqual(expect.arrayContaining(['Entrepaño', 'Lateral', 'Costado de cajón 1', 'Contrafrente y trasera de cajón 1']))
  })
})
