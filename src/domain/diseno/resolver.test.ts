import { describe, expect, it } from 'vitest'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { desde, mm, pieza, ref, tramo } from './construir'
import { Diseno, type Diseno as TDiseno } from './esquema'
import { resolver, type Geometria } from './resolver'

const resuelto = (d: TDiseno): Geometria => {
  const r = resolver(d, catalogo)
  if (!r.ok) throw new Error(JSON.stringify(r.errores))
  return r.valor
}

describe('resolver', () => {
  it.each([librero, buro, alacena])('los fixtures cumplen el esquema y se resuelven: $nombre', (d) => {
    expect(Diseno.safeParse(d).success).toBe(true)
    expect(resuelto(d).cajas.size).toBe(d.piezas.length)
  })

  it('resuelve referencias, espesores y cotas proporcionales del librero', () => {
    const { cajas } = resuelto(librero)
    expect(cajas.get('lat-izq')).toEqual({ x0: 0, x1: 18, y0: 0, y1: 1800, z0: 6, z1: 300 })
    expect(cajas.get('lat-der')).toMatchObject({ x0: 582, x1: 600 })
    expect(cajas.get('piso')).toMatchObject({ x0: 18, x1: 582, y0: 70, y1: 88 })
    expect(cajas.get('techo')).toMatchObject({ y0: 1782, y1: 1800 })
    const huecos = [cajas.get('piso')!, ...[1, 2, 3, 4].map((i) => cajas.get(`entrepano-${i}`)!), cajas.get('techo')!]
      .slice(1)
      .map((c, i, arr) => c.y0 - (i === 0 ? cajas.get('piso')!.y1 : arr[i - 1].y1))
    for (const h of huecos) expect(h).toBeCloseTo(huecos[0], 5)
  })

  it('propaga un cambio de ancho a todo lo referido', () => {
    const { cajas } = resuelto({ ...librero, dimensiones: { ...librero.dimensiones, ancho: 900 } })
    expect(cajas.get('lat-der')).toMatchObject({ x0: 882, x1: 900 })
    expect(cajas.get('entrepano-2')).toMatchObject({ x0: 18, x1: 882 })
  })

  it('usa el espesor del catálogo en el eje normal', () => {
    const d = structuredClone(librero)
    d.piezas.find((p) => p.id === 'lat-izq')!.material = 'T15'
    expect(resuelto(d).cajas.get('piso')).toMatchObject({ x0: 15 })
  })

  it('reporta referencias a piezas inexistentes y ejes cruzados', () => {
    const d = structuredClone(librero)
    d.piezas.push(pieza({ id: 'extra', nombre: 'Extra', rol: 'otro', material: 'T18', normal: 'y', x: tramo(ref('fantasma.x1'), ref('mueble.x1')), y: desde(mm(500)), z: tramo(ref('mueble.y0'), ref('mueble.z1')) }))
    const r = resolver(d, catalogo)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores.map((e) => e.codigo).sort()).toEqual(['E_REF_EJE', 'E_REF_INEXISTENTE'])
  })

  it('detecta ciclos de referencias', () => {
    const d = structuredClone(librero)
    const lat = d.piezas.find((p) => p.id === 'lat-izq')!
    lat.x = desde(ref('piso.x0', -18))
    const r = resolver(d, catalogo)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0].codigo).toBe('E_CICLO')
  })

  it('rechaza tramos con largo cero o negativo y materiales fuera del catálogo', () => {
    const d = structuredClone(librero)
    d.dimensiones.ancho = 30
    d.piezas.find((p) => p.id === 'techo')!.material = 'T25'
    const r = resolver(d, catalogo)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(new Set(r.errores.map((e) => e.codigo))).toEqual(new Set(['E_TRAMO_INVALIDO', 'E_ESPESOR_CATALOGO']))
  })

  it('acepta desde + largo y hasta + largo en los ejes de la cara', () => {
    const { cajas } = resuelto(librero)
    expect(cajas.get('zoclo')).toMatchObject({ y0: 0, y1: 70, z0: 252, z1: 270 })
  })
})
