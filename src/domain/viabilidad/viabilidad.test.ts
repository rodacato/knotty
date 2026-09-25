import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import type { Diseno } from '../diseno/esquema'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import type { Catalogo } from '../materiales/catalogo'
import { estimarCompra } from '../materiales/compra'
import { peor, revisarViabilidad } from './viabilidad'

function revisar(diseno: Diseno, c: Catalogo = catalogo) {
  const a = analizar(diseno, catalogo)
  if (!a.valido) throw new Error(a.errores[0].mensaje)
  return revisarViabilidad({ diseno, geo: a.geo, catalogo: c, compra: estimarCompra(diseno, a.geo, c), hallazgos: a.hallazgos, incumplidos: [] })
}
const estado = (v: ReturnType<typeof revisar>, id: string) => v.comprobaciones.find((c) => c.id === id)!

describe('revisarViabilidad', () => {
  it.each([librero, buro, alacena])('los ejemplos cierran sus medidas y caben en la hoja: $nombre', (diseno) => {
    const v = revisar(diseno)
    expect(estado(v, 'medidas').estado).toBe('ok')
    expect(estado(v, 'hoja').estado).toBe('ok')
    expect(v.veredicto).not.toBe('no-viable')
  })

  it('con más refilado, una pieza larga deja de caber y el diseño no es viable', async () => {
    const alto = { ...librero, dimensiones: { ...librero.dimensiones, alto: 2400 } }
    const holgado = revisar(alto)
    expect(estado(holgado, 'hoja').estado).toBe('ok')
    const v = revisar(alto, { ...catalogo, acomodo: { ...catalogo.acomodo, refilado: 50 } })
    expect(estado(v, 'hoja')).toMatchObject({ estado: 'falla', imposible: true })
    expect(estado(v, 'hoja').detalle).toContain('2340')
    expect(v.veredicto).toBe('no-viable')
  })

  it('si las piezas no suman la medida del mueble, no es viable', () => {
    const a = analizar(librero, catalogo)
    if (!a.valido) throw new Error()
    const dice = { ...librero, dimensiones: { ...librero.dimensiones, ancho: 650 } }
    const v = revisarViabilidad({ diseno: dice, geo: a.geo, catalogo, compra: estimarCompra(librero, a.geo, catalogo), hallazgos: [], incumplidos: [] })
    expect(estado(v, 'medidas')).toMatchObject({ estado: 'falla', imposible: true, pedido: 'Haz que las piezas cierren exacto en 1800 × 650 × 300 mm' })
    expect(v.veredicto).toBe('no-viable')
  })

  it('el carpintero puede endurecer el veredicto pero no suavizarlo', () => {
    expect(peor('viable', 'con-cambios')).toBe('con-cambios')
    expect(peor('no-viable', 'viable')).toBe('no-viable')
  })
})
