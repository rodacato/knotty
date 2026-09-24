import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import { desde, entre, mm, pieza, ref, tramo, union } from '../diseno/construir'
import { diferencias } from '../diseno/diff'
import type { Diseno } from '../diseno/esquema'
import { normalizar } from '../diseno/normalizador'
import { resolver } from '../diseno/resolver'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { despiece } from '../materiales/despiece'
import { aplicar } from './aplicar'
import { Operacion } from './esquema'

const aplicado = (d: Diseno, ops: Operacion[]) => {
  const r = aplicar(d, ops.map((o) => Operacion.parse(o)), catalogo)
  if (!r.ok) throw new Error(JSON.stringify(r.errores))
  return r.valor
}
const cajas = (d: Diseno) => {
  const r = resolver(d, catalogo)
  if (!r.ok) throw new Error(JSON.stringify(r.errores))
  return r.valor.cajas
}
const valido = (d: Diseno) => {
  const a = analizar(d, catalogo)
  return a.valido ? [] : a.errores.map((e) => e.codigo)
}

const divisor = pieza({
  id: 'divisor',
  nombre: 'Divisor',
  rol: 'divisor',
  material: 'T18',
  normal: 'x',
  x: desde(entre('lat-izq.x1', 'lat-der.x0', 0.5, -9)),
  y: tramo(ref('piso.y1'), ref('techo.y0')),
  z: tramo(ref('trasera.z1'), ref('mueble.z1')),
})

describe('aplicar', () => {
  it('ensanchar estirando propaga a laterales y entrepaños y no toca lo demás', () => {
    const { diseno } = aplicado(librero, [{ op: 'cambiarDimensionGlobal', eje: 'x', valor: 900, regla: 'estirar' }])
    expect(valido(diseno)).toEqual([])
    const d = diferencias(librero, cajas(librero), diseno, cajas(diseno))
    expect(d.modificadas).toEqual(expect.arrayContaining(['lat-der', 'piso', 'techo', 'zoclo', 'trasera', 'entrepano-1']))
    expect(d.modificadas).not.toContain('lat-izq')
  })

  it('agregar un divisor exige partir los entrepaños que atraviesa', () => {
    const { diseno } = aplicado(librero, [{ op: 'agregarPieza', pieza: divisor }])
    expect(valido(diseno)).toContain('E_TRASLAPE')
  })

  it('divisor completo: partir entrepaños en dos con uniones, y queda válido', () => {
    const ops: Operacion[] = [{ op: 'cambiarDimensionGlobal', eje: 'x', valor: 900, regla: 'estirar' }, { op: 'agregarPieza', pieza: divisor }]
    ops.push(
      { op: 'agregarUnion', union: union('u-div-piso', 'divisor', 'piso', 'tope-tornillo') },
      { op: 'agregarUnion', union: union('u-div-techo', 'techo', 'divisor', 'tope-tornillo') },
    )
    for (let i = 1; i <= 4; i++) {
      const id = `entrepano-${i}`
      ops.push(
        { op: 'redimensionar', id, eje: 'x', extremo: 'hasta', cota: ref('divisor.x0') },
        { op: 'duplicarPieza', id, nuevoId: `${id}-der`, nombre: `Entrepaño ${i} derecho`, eje: 'x', cota: ref('divisor.x1') },
        { op: 'redimensionar', id: `${id}-der`, eje: 'x', extremo: 'hasta', cota: ref('lat-der.x0') },
        { op: 'eliminarUnion', id: `u-${id}-lat-der` },
        { op: 'agregarUnion', union: union(`u-${id}-div`, id, 'divisor', 'soporte-repisa') },
        { op: 'agregarUnion', union: union(`u-${id}-der-div`, `${id}-der`, 'divisor', 'soporte-repisa') },
      )
    }
    const { diseno } = aplicado(librero, ops)
    expect(valido(diseno)).toEqual([])
    const a = analizar(diseno, catalogo)
    if (!a.valido) throw new Error()
    expect(a.hallazgos.filter((h) => h.codigo === 'R1_FLECHA').map((h) => h.piezas[0])).toEqual(['piso'])
  })

  it('eliminar una pieza congela las cotas que la referían y avisa', () => {
    const { diseno, avisos } = aplicado(librero, [{ op: 'eliminarPieza', id: 'zoclo' }])
    expect(diseno.piezas.find((p) => p.id === 'piso')!.y.desde).toEqual(mm(70))
    expect(diseno.uniones.some((u) => u.a === 'zoclo' || u.b === 'zoclo')).toBe(false)
    expect(avisos[0].codigo).toBe('A_REFERENCIA_CONGELADA')
  })

  it('mover conserva el largo y un entrepaño bajado sigue válido', () => {
    const { diseno } = aplicado(librero, [{ op: 'mover', id: 'entrepano-1', eje: 'y', cota: mm(300) }])
    expect(cajas(diseno).get('entrepano-1')).toMatchObject({ y0: 300, y1: 318 })
    expect(valido(diseno)).toEqual([])
  })

  it('distribuir reparte con huecos iguales', () => {
    const conCinco = aplicado(librero, [
      { op: 'duplicarPieza', id: 'entrepano-4', nuevoId: 'entrepano-5', nombre: 'Entrepaño 5', eje: 'y', cota: mm(1700) },
      { op: 'distribuir', ids: ['entrepano-1', 'entrepano-2', 'entrepano-3', 'entrepano-4', 'entrepano-5'], eje: 'y', a: 'piso.y1', b: 'techo.y0' },
    ]).diseno
    const c = cajas(conCinco)
    const ys = ['piso', 'entrepano-1', 'entrepano-2', 'entrepano-3', 'entrepano-4', 'entrepano-5', 'techo'].map((id) => c.get(id)!)
    const huecos = ys.slice(1).map((caja, i) => caja.y0 - ys[i].y1)
    for (const h of huecos) expect(h).toBeCloseTo(huecos[0], 5)
    expect(conCinco.uniones.filter((u) => u.a === 'entrepano-5')).toHaveLength(2)
  })

  it('cambiar espesor recorre lo referido', () => {
    const { diseno } = aplicado(librero, [{ op: 'cambiarEspesor', ids: ['lat-izq', 'lat-der'], material: 'T15' }])
    expect(cajas(diseno).get('piso')).toMatchObject({ x0: 15, x1: 585 })
  })

  it('proporcional escala las cotas absolutas', () => {
    const conMm = aplicado(librero, [{ op: 'mover', id: 'entrepano-1', eje: 'y', cota: mm(400) }]).diseno
    const { diseno } = aplicado(conMm, [{ op: 'cambiarDimensionGlobal', eje: 'y', valor: 900, regla: 'proporcional' }])
    expect(cajas(diseno).get('entrepano-1')!.y0).toBe(200)
  })

  it('falla sin aplicar nada e indica la operación', () => {
    const r = aplicar(librero, [{ op: 'cambiarAnclajeMuro', valor: false }, { op: 'eliminarPieza', id: 'no-existe' }], catalogo)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0]).toMatchObject({ codigo: 'E_PIEZA_INEXISTENTE', datos: { operacion: 1 } })
    expect(librero.anclajeMuro).toBe(true)
  })

  it('no redimensiona en el eje del espesor', () => {
    const r = aplicar(librero, [{ op: 'redimensionar', id: 'piso', eje: 'y', extremo: 'hasta', cota: mm(200) }], catalogo)
    expect(r.ok || r.errores[0].codigo).toBe('E_OPERACION_INVALIDA')
  })
})

describe('normalizar', () => {
  it('ancla cotas absolutas a las caras cercanas sin moverlas y vuelve paramétrico el modelo', () => {
    const plano = structuredClone(librero)
    const actuales = cajas(librero)
    for (const p of plano.piezas) {
      const c = actuales.get(p.id)!
      p.x = p.normal === 'x' ? desde(mm(c.x0)) : tramo(mm(c.x0), mm(c.x1))
      p.y = p.normal === 'y' ? desde(mm(c.y0)) : tramo(mm(c.y0), mm(c.y1))
      p.z = p.normal === 'z' ? desde(mm(c.z0)) : tramo(mm(c.z0), mm(c.z1))
    }
    const normal = normalizar(plano, catalogo)
    expect(cajas(normal)).toEqual(actuales)
    const ancho = aplicado(normal, [{ op: 'cambiarDimensionGlobal', eje: 'x', valor: 900, regla: 'estirar' }]).diseno
    expect(valido(ancho)).toEqual([])
    expect(cajas(ancho).get('entrepano-3')).toMatchObject({ x0: 18, x1: 882 })
  })
})

describe('despiece', () => {
  it('agrupa piezas iguales', () => {
    const r = resolver(librero, catalogo)
    if (!r.ok) throw new Error()
    const lista = despiece(librero, r.valor)
    expect(lista.find((l) => l.ids.includes('entrepano-1'))).toMatchObject({ nombre: 'Entrepaño', cantidad: 4, largo: 564, ancho: 294, espesor: 18 })
    expect(lista.find((l) => l.ids.includes('lat-izq'))).toMatchObject({ cantidad: 2, largo: 1800, ancho: 294 })
  })
})
