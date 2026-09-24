import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import type { Diseno } from '../diseno/esquema'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { acomodar } from './acomodo'
import { cantidadPorUnion, estimarCompra, metrosDeCubrecanto } from './compra'

const geo = (d: Diseno) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(JSON.stringify(a.errores))
  return a.geo
}

describe('acomodo en hojas', () => {
  it.each([librero, buro, alacena])('coloca todo sin encimar, dentro de la hoja útil y con la veta respetada: $nombre', (d) => {
    const g = geo(d)
    for (const m of acomodar(d, g, catalogo)) {
      expect(m.sinLugar).toEqual([])
      const piezas = d.piezas.filter((p) => p.material === m.material)
      expect(m.hojas.flatMap((h) => h.colocadas).map((c) => c.id).sort()).toEqual(piezas.map((p) => p.id).sort())
      for (const h of m.hojas) {
        for (const c of h.colocadas) {
          expect(c.x + c.w).toBeLessThanOrEqual(m.util.largo)
          expect(c.y + c.h).toBeLessThanOrEqual(m.util.ancho)
          const p = piezas.find((x) => x.id === c.id)!
          if (p.veta === 'largo') expect(c.w).toBeGreaterThanOrEqual(c.h)
        }
        for (const [i, a] of h.colocadas.entries())
          for (const b of h.colocadas.slice(i + 1)) {
            const separadas = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
            expect(separadas, `${a.id} y ${b.id} se enciman`).toBe(true)
          }
        expect(h.desperdicio).toBeGreaterThan(0)
        expect(h.desperdicio).toBeLessThan(1)
      }
    }
  })

  it('el librero de 60 cm sale de una hoja de 18 mm y una de trasera', () => {
    const r = estimarCompra(librero, geo(librero), catalogo)
    expect(r.hojas.map((h) => [h.material.id, h.hojas])).toEqual([
      ['T18', 1],
      ['TR6', 1],
    ])
  })

  it('más ancho pide más hojas', () => {
    const ancho = { ...librero, dimensiones: { ...librero.dimensiones, ancho: 1100 } }
    const hojas = estimarCompra(ancho, geo(ancho), catalogo).hojas.find((h) => h.material.id === 'T18')!.hojas
    expect(hojas).toBe(2)
  })

  it('una pieza más grande que la hoja queda sin lugar y cuenta como hoja aparte', () => {
    const g = geo(librero)
    const enorme = { ...catalogo, materiales: catalogo.materiales.map((m) => (m.id === 'TR6' ? { ...m, hoja: { largo: 1500, ancho: 1220 } } : m)) }
    const tr6 = acomodar(librero, g, enorme).find((m) => m.material === 'TR6')!
    expect(tr6.sinLugar.map((p) => p.id)).toEqual(['trasera'])
  })
})

describe('herrajes y compra', () => {
  it('calcula tornillos y clavos por separación a lo largo de la junta', () => {
    const g = geo(librero)
    const union = (id: string) => librero.uniones.find((u) => u.id === id)!
    expect(cantidadPorUnion(union('u-piso-izq'), g)).toBe(2)
    expect(cantidadPorUnion(union('u-trasera-lat-izq'), g)).toBe(13)
  })

  it('suma el cubrecanto de los cantos marcados, con merma', () => {
    expect(metrosDeCubrecanto(librero, geo(librero))).toBeCloseTo(((1800 * 2 + 564 * 6) / 1000) * 1.1, 1)
  })

  it('arma la lista con paquetes y costo total', () => {
    const r = estimarCompra(alacena, geo(alacena), catalogo)
    const bisagras = r.herrajes.find((h) => h.herraje.id === 'bisagra-cazoleta-35-recta')!
    expect(bisagras).toMatchObject({ cantidad: 4, paquetes: 2 })
    expect(r.herrajes.some((h) => h.herraje.id === 'pegamento-blanco')).toBe(true)
    expect(r.costo.faltanPrecios).toEqual([])
    expect(r.costo.total).toBe(r.hojas.reduce((s, h) => s + h.costo!, 0) + r.herrajes.reduce((s, h) => s + h.costo!, 0))
  })

  it('avisa qué precios faltan', () => {
    const sinPrecio = { ...catalogo, materiales: catalogo.materiales.map((m) => ({ ...m, precio: null })) }
    const r = estimarCompra(librero, geo(librero), sinPrecio)
    expect(r.costo.faltanPrecios).toContain('Triplay de pino 18 mm')
  })
})
