import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { startAt, partway, mm, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import { differences } from '../diseno/diff'
import type { Design } from '../diseno/schema'
import { normalize } from '../diseno/normalize'
import { resolveGeometry } from '../diseno/resolve'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { cutList } from '../materiales/cutList'
import { applyOperations } from './apply'
import { Operation } from './schema'

const aplicado = (d: Design, ops: Operation[]) => {
  const r = applyOperations(d, ops.map((o) => Operation.parse(o)), testCatalog)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value
}
const cajas = (d: Design) => {
  const r = resolveGeometry(d, testCatalog)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value.boxes
}
const valido = (d: Design) => {
  const a = analyze(d, testCatalog)
  return a.valid ? [] : a.errors.map((e) => e.code)
}

const divisor = makePiece({
  id: 'divisor',
  nombre: 'Divisor',
  rol: 'divisor',
  material: 'T18',
  normal: 'x',
  x: startAt(partway('lat-izq.x1', 'lat-der.x0', 0.5, -9)),
  y: extent(ref('piso.y1'), ref('techo.y0')),
  z: extent(ref('trasera.z1'), ref('mueble.z1')),
})

describe('applyOperations', () => {
  it('stretching wider carries to the sides and shelves and leaves the rest alone', () => {
    const { design: diseno } = aplicado(exampleBookcase, [{ op: 'cambiarDimensionGlobal', eje: 'x', valor: 900, regla: 'estirar' }])
    expect(valido(diseno)).toEqual([])
    const d = differences(exampleBookcase, cajas(exampleBookcase), diseno, cajas(diseno))
    expect(d.changed).toEqual(expect.arrayContaining(['lat-der', 'piso', 'techo', 'zoclo', 'trasera', 'entrepano-1']))
    expect(d.changed).not.toContain('lat-izq')
  })

  it('adding a divider requires splitting the shelves it crosses', () => {
    const { design: diseno } = aplicado(exampleBookcase, [{ op: 'agregarPieza', pieza: divisor }])
    expect(valido(diseno)).toContain('E_TRASLAPE')
  })

  it('a full divider: shelves split in two with joints, and it stays valid', () => {
    const ops: Operation[] = [{ op: 'cambiarDimensionGlobal', eje: 'x', valor: 900, regla: 'estirar' }, { op: 'agregarPieza', pieza: divisor }]
    ops.push(
      { op: 'agregarUnion', union: makeJoint('u-div-piso', 'piso', 'divisor', 'tope-tornillo') },
      { op: 'agregarUnion', union: makeJoint('u-div-techo', 'techo', 'divisor', 'tope-tornillo') },
    )
    for (let i = 1; i <= 4; i++) {
      const id = `entrepano-${i}`
      ops.push(
        { op: 'redimensionar', id, eje: 'x', extremo: 'hasta', cota: ref('divisor.x0') },
        { op: 'duplicarPieza', id, nuevoId: `${id}-der`, nombre: `Entrepaño ${i} derecho`, eje: 'x', cota: ref('divisor.x1') },
        { op: 'redimensionar', id: `${id}-der`, eje: 'x', extremo: 'hasta', cota: ref('lat-der.x0') },
        { op: 'eliminarUnion', id: `u-${id}-lat-der` },
        { op: 'agregarUnion', union: makeJoint(`u-${id}-div`, id, 'divisor', 'soporte-repisa') },
        { op: 'agregarUnion', union: makeJoint(`u-${id}-der-div`, `${id}-der`, 'divisor', 'soporte-repisa') },
      )
    }
    const { design: diseno } = aplicado(exampleBookcase, ops)
    expect(valido(diseno)).toEqual([])
    const a = analyze(diseno, testCatalog)
    if (!a.valid) throw new Error()
    expect(a.findings.filter((h) => h.code === 'R1_FLECHA').map((h) => h.pieces[0])).toEqual(['piso'])
  })

  it('removing a piece freezes the cotas that referred to it and warns', () => {
    const { design: diseno, warnings: avisos } = aplicado(exampleBookcase, [{ op: 'eliminarPieza', id: 'zoclo' }])
    expect(diseno.piezas.find((p) => p.id === 'piso')!.y.desde).toEqual(mm(70))
    expect(diseno.uniones.some((u) => u.a === 'zoclo' || u.b === 'zoclo')).toBe(false)
    expect(avisos[0].code).toBe('A_REFERENCIA_CONGELADA')
  })

  it('moving keeps the length and a lowered shelf stays valid', () => {
    const { design: diseno } = aplicado(exampleBookcase, [{ op: 'mover', id: 'entrepano-1', eje: 'y', cota: mm(300) }])
    expect(cajas(diseno).get('entrepano-1')).toMatchObject({ y0: 300, y1: 318 })
    expect(valido(diseno)).toEqual([])
  })

  it('distributing spaces evenly', () => {
    const conCinco = aplicado(exampleBookcase, [
      { op: 'duplicarPieza', id: 'entrepano-4', nuevoId: 'entrepano-5', nombre: 'Entrepaño 5', eje: 'y', cota: mm(1700) },
      { op: 'distribuir', ids: ['entrepano-1', 'entrepano-2', 'entrepano-3', 'entrepano-4', 'entrepano-5'], eje: 'y', a: 'piso.y1', b: 'techo.y0' },
    ]).design
    const c = cajas(conCinco)
    const ys = ['piso', 'entrepano-1', 'entrepano-2', 'entrepano-3', 'entrepano-4', 'entrepano-5', 'techo'].map((id) => c.get(id)!)
    const huecos = ys.slice(1).map((caja, i) => caja.y0 - ys[i].y1)
    for (const h of huecos) expect(h).toBeCloseTo(huecos[0], 5)
    expect(conCinco.uniones.filter((u) => u.a === 'entrepano-5')).toHaveLength(2)
  })

  it('changing thickness carries to what refers to it', () => {
    const { design: diseno } = aplicado(exampleBookcase, [{ op: 'cambiarEspesor', ids: ['lat-izq', 'lat-der'], material: 'T15' }])
    expect(cajas(diseno).get('piso')).toMatchObject({ x0: 15, x1: 585 })
  })

  it('proportional scales the absolute cotas', () => {
    const conMm = aplicado(exampleBookcase, [{ op: 'mover', id: 'entrepano-1', eje: 'y', cota: mm(400) }]).design
    const { design: diseno } = aplicado(conMm, [{ op: 'cambiarDimensionGlobal', eje: 'y', valor: 900, regla: 'proporcional' }])
    expect(cajas(diseno).get('entrepano-1')!.y0).toBe(200)
  })

  it('fails without applying anything and names the operation', () => {
    const r = applyOperations(exampleBookcase, [{ op: 'cambiarAnclajeMuro', valor: false }, { op: 'eliminarPieza', id: 'no-existe' }], testCatalog)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatchObject({ code: 'E_PIEZA_INEXISTENTE', data: { operacion: 1 } })
    expect(exampleBookcase.anclajeMuro).toBe(true)
  })

  it('does not resize along the thickness axis', () => {
    const r = applyOperations(exampleBookcase, [{ op: 'redimensionar', id: 'piso', eje: 'y', extremo: 'hasta', cota: mm(200) }], testCatalog)
    expect(r.ok || r.errors[0].code).toBe('E_OPERACION_INVALIDA')
  })
})

describe('normalize', () => {
  it('ties absolute cotas to nearby faces without moving them and makes the model parametric', () => {
    const plano = structuredClone(exampleBookcase)
    const actuales = cajas(exampleBookcase)
    for (const p of plano.piezas) {
      const c = actuales.get(p.id)!
      p.x = p.normal === 'x' ? startAt(mm(c.x0)) : extent(mm(c.x0), mm(c.x1))
      p.y = p.normal === 'y' ? startAt(mm(c.y0)) : extent(mm(c.y0), mm(c.y1))
      p.z = p.normal === 'z' ? startAt(mm(c.z0)) : extent(mm(c.z0), mm(c.z1))
    }
    const normal = normalize(plano, testCatalog)
    expect(cajas(normal)).toEqual(actuales)
    const ancho = aplicado(normal, [{ op: 'cambiarDimensionGlobal', eje: 'x', valor: 900, regla: 'estirar' }]).design
    expect(valido(ancho)).toEqual([])
    expect(cajas(ancho).get('entrepano-3')).toMatchObject({ x0: 18, x1: 882 })
  })
})

describe('cutList', () => {
  it('groups equal pieces', () => {
    const r = resolveGeometry(exampleBookcase, testCatalog)
    if (!r.ok) throw new Error()
    const lista = cutList(exampleBookcase, r.value)
    expect(lista.find((l) => l.ids.includes('entrepano-1'))).toMatchObject({ name: 'Entrepaño', count: 4, length: 564, width: 294, thickness: 18 })
    expect(lista.find((l) => l.ids.includes('lat-izq'))).toMatchObject({ count: 2, length: 1800, width: 294 })
  })
})
