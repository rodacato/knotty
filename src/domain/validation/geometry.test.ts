import { describe, expect, it } from 'vitest'
import { startAt, mm, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { Diseno } from '../diseno/esquema'
import { resolveGeometry } from '../diseno/resolve'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { validateGeometry } from './geometry'

const validate = (d: Diseno) => {
  const r = resolveGeometry(d, catalogo)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return validateGeometry(d, r.value, catalogo)
}
const codes = (d: Diseno) => validate(d).errors.map((e) => e.code)

describe('validateGeometry', () => {
  it.each([librero, buro, alacena])('the fixtures have no errors or warnings: $nombre', (d) => {
    const { errors, warnings } = validate(d)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('finds overlapping pieces', () => {
    const d = structuredClone(librero)
    d.piezas.push(makePiece({ id: 'divisor', nombre: 'Divisor', rol: 'divisor', material: 'T18', normal: 'x', x: startAt(mm(291)), y: extent(ref('piso.y1'), ref('techo.y0')), z: extent(ref('trasera.z1'), ref('mueble.z1')) }))
    d.uniones.push(makeJoint('u-div-piso', 'divisor', 'piso', 'tope-tornillo'))
    expect(codes(d)).toContain('E_TRASLAPE')
  })

  it('lets a declared groove overlap', () => {
    const d = structuredClone(librero)
    const piso = d.piezas.find((p) => p.id === 'piso')!
    piso.x = extent(ref('lat-izq.x1', -6), ref('lat-der.x0', 6))
    d.uniones = d.uniones.map((u) => (u.b === 'piso' && u.a.startsWith('lat') ? { ...u, tipo: 'canal', penetracion: 6 } : u))
    expect(codes(d)).toEqual([])
  })

  it('finds floating pieces and joints between pieces that do not touch', () => {
    const d = structuredClone(librero)
    d.piezas.push(makePiece({ id: 'repisa-suelta', nombre: 'Repisa suelta', rol: 'entrepano', material: 'T18', normal: 'y', x: extent(mm(100), mm(400)), y: startAt(mm(900)), z: extent(mm(100), mm(200)) }))
    d.uniones.push(makeJoint('u-suelta', 'repisa-suelta', 'lat-izq', 'tope-tornillo'))
    expect(codes(d)).toEqual(expect.arrayContaining(['E_FLOTANTE', 'E_UNION_SIN_CONTACTO']))
  })

  it('finds pieces outside the overall measures', () => {
    const d = structuredClone(librero)
    d.piezas.find((p) => p.id === 'lat-izq')!.x = startAt(mm(-20))
    expect(codes(d)).toContain('E_MEDIDA_GLOBAL')
  })

  it('finds pieces larger than the usable sheet', () => {
    const d = structuredClone(librero)
    d.dimensiones.alto = 2500
    expect(codes(d)).toContain('E_NO_CABE_EN_HOJA')
  })

  it('warns about touching pieces with no joint', () => {
    const d = structuredClone(librero)
    d.uniones = d.uniones.filter((u) => u.id !== 'u-zoclo-piso')
    expect(validate(d).warnings.map((a) => a.data)).toEqual([{ a: 'zoclo', b: 'piso' }])
  })
})
