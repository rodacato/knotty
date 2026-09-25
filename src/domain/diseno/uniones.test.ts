import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import type { Diseno } from './esquema'
import { completarUniones } from './uniones'

const firma = (d: Diseno) => d.uniones.map((u) => `${u.a} → ${u.b} ${u.tipo}`).sort()
const criticos = (d: Diseno) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(a.errores[0].mensaje)
  return a.hallazgos.filter((h) => h.severidad === 'critico')
}

describe('completarUniones', () => {
  it('sin uniones, reconstruye las de los ejemplos hechos a mano salvo las especiales', () => {
    expect(firma(completarUniones({ ...alacena, uniones: [] }, catalogo))).toEqual(firma(alacena))
    // El zoclo del ejemplo va con tornillo de bolsillo y el entrepaño del buró con tarugos: eso lo declara el experto.
    const sinZoclo = firma(librero).filter((u) => !u.startsWith('zoclo → lat'))
    expect(firma(completarUniones({ ...librero, uniones: [] }, catalogo))).toEqual([...sinZoclo, 'lat-der → zoclo tope-tornillo', 'lat-izq → zoclo tope-tornillo'].sort())
    const sinTarugos = firma(buro).filter((u) => !u.includes('tarugo'))
    expect(firma(completarUniones({ ...buro, uniones: [] }, catalogo))).toEqual([...sinTarugos, 'lat-der → entrepano tope-tornillo', 'lat-izq → entrepano tope-tornillo'].sort())
  })

  it.each([librero, buro, alacena])('lo inferido pasa la revisión estructural sin críticos: $nombre', (diseno) => {
    expect(criticos(completarUniones({ ...diseno, uniones: [] }, catalogo))).toEqual([])
  })

  it('respeta las uniones que declaró el experto y elige tornillo que agarre 25 mm en el canto', () => {
    const conBolsillo = librero.uniones.filter((u) => u.b === 'lat-izq' && u.a === 'zoclo')
    const d = completarUniones({ ...librero, uniones: conBolsillo }, catalogo)
    expect(d.uniones.filter((u) => [u.a, u.b].sort().join() === 'lat-izq,zoclo')).toEqual(conBolsillo)
    expect(d.uniones.find((u) => u.a === 'lat-izq' && u.b === 'piso')?.herrajes).toEqual([{ herrajeId: 'tornillo-8x2', cantidad: null }])
  })

  it('con el diseño previo, no revive una unión que se quitó a propósito', () => {
    const sinUna = { ...librero, uniones: librero.uniones.filter((u) => u.id !== 'u-trasera-techo') }
    expect(completarUniones(sinUna, catalogo, librero).uniones).toHaveLength(sinUna.uniones.length)
    expect(completarUniones(sinUna, catalogo).uniones).toHaveLength(librero.uniones.length)
  })

  it('es determinista', () => {
    const vacio = { ...librero, uniones: [] }
    expect(completarUniones(vacio, catalogo)).toEqual(completarUniones(structuredClone(vacio), catalogo))
  })
})
