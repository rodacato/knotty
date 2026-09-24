import { describe, expect, it } from 'vitest'
import { desde, mm, pieza, ref, tramo, union } from '../diseno/construir'
import type { Diseno } from '../diseno/esquema'
import { resolver } from '../diseno/resolver'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { validarGeometria } from './geometria'

const validar = (d: Diseno) => {
  const r = resolver(d, catalogo)
  if (!r.ok) throw new Error(JSON.stringify(r.errores))
  return validarGeometria(d, r.valor, catalogo)
}
const codigos = (d: Diseno) => validar(d).errores.map((e) => e.codigo)

describe('validarGeometria', () => {
  it.each([librero, buro, alacena])('los fixtures no tienen errores ni avisos: $nombre', (d) => {
    const { errores, avisos } = validar(d)
    expect(errores).toEqual([])
    expect(avisos).toEqual([])
  })

  it('detecta piezas encimadas', () => {
    const d = structuredClone(librero)
    d.piezas.push(pieza({ id: 'divisor', nombre: 'Divisor', rol: 'divisor', material: 'T18', normal: 'x', x: desde(mm(291)), y: tramo(ref('piso.y1'), ref('techo.y0')), z: tramo(ref('trasera.z1'), ref('mueble.z1')) }))
    d.uniones.push(union('u-div-piso', 'divisor', 'piso', 'tope-tornillo'))
    expect(codigos(d)).toContain('E_TRASLAPE')
  })

  it('permite el traslape de un canal declarado', () => {
    const d = structuredClone(librero)
    const piso = d.piezas.find((p) => p.id === 'piso')!
    piso.x = tramo(ref('lat-izq.x1', -6), ref('lat-der.x0', 6))
    d.uniones = d.uniones.map((u) => (u.b === 'piso' && u.a.startsWith('lat') ? { ...u, tipo: 'canal', penetracion: 6 } : u))
    expect(codigos(d)).toEqual([])
  })

  it('detecta piezas flotantes y uniones sin contacto', () => {
    const d = structuredClone(librero)
    d.piezas.push(pieza({ id: 'repisa-suelta', nombre: 'Repisa suelta', rol: 'entrepano', material: 'T18', normal: 'y', x: tramo(mm(100), mm(400)), y: desde(mm(900)), z: tramo(mm(100), mm(200)) }))
    d.uniones.push(union('u-suelta', 'repisa-suelta', 'lat-izq', 'tope-tornillo'))
    expect(codigos(d)).toEqual(expect.arrayContaining(['E_FLOTANTE', 'E_UNION_SIN_CONTACTO']))
  })

  it('detecta piezas que se salen de la medida global', () => {
    const d = structuredClone(librero)
    d.piezas.find((p) => p.id === 'lat-izq')!.x = desde(mm(-20))
    expect(codigos(d)).toContain('E_MEDIDA_GLOBAL')
  })

  it('detecta piezas más grandes que la hoja útil', () => {
    const d = structuredClone(librero)
    d.dimensiones.alto = 2500
    expect(codigos(d)).toContain('E_NO_CABE_EN_HOJA')
  })

  it('avisa de contactos sin unión', () => {
    const d = structuredClone(librero)
    d.uniones = d.uniones.filter((u) => u.id !== 'u-zoclo-piso')
    expect(validar(d).avisos.map((a) => a.datos)).toEqual([{ a: 'zoclo', b: 'piso' }])
  })
})
