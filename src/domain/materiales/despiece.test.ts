import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { aplicar } from '../operaciones/aplicar'
import { despiece } from './despiece'

describe('cut list names', () => {
  it('names a row after what its pieces share, or after both when they only share the end', () => {
    const r = aplicar({ ...librero, dimensiones: { ...librero.dimensiones, fondo: 500 } }, [
      { op: 'agregarCajon', grupo: 'cajon-1', nombre: 'Cajón 1', izquierda: 'lat-izq.x1', derecha: 'lat-der.x0', abajo: 'piso.y1', arriba: 'entrepano-1.y0', frente: 'mueble.z1', fondo: 'trasera.z1', material: 'T15', materialFondo: 'TR6' },
    ], catalogo)
    if (!r.ok) throw new Error('no drawer')
    const names = despiece(r.valor.diseno, analizar(r.valor.diseno, catalogo).geo!).map((row) => row.nombre)
    expect(names).toEqual(expect.arrayContaining(['Entrepaño', 'Lateral', 'Costado de cajón 1', 'Contrafrente y trasera de cajón 1']))
  })
})
