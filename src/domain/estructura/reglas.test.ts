import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import { mm, ref, tramo } from '../diseno/construir'
import type { Diseno } from '../diseno/esquema'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'

const hallazgos = (d: Diseno, codigo: string) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(JSON.stringify(a.errores))
  return a.hallazgos.filter((h) => h.codigo === codigo)
}

describe('R3 tornillos', () => {
  it('pide un tornillo más largo si no entra 25 mm en la pieza que lo recibe', () => {
    const d = structuredClone(librero)
    d.uniones = d.uniones.map((u) => (u.id === 'u-piso-izq' ? { ...u, herrajes: [{ herrajeId: 'tornillo-8x1-1/4', cantidad: null }] } : u))
    const [h] = hallazgos(d, 'R3_TORNILLOS')
    expect(h).toMatchObject({ severidad: 'recomendacion', datos: { union: 'u-piso-izq' } })
    expect(h.alternativas[0].datos.herrajeId).toBe('tornillo-8x2')
  })

  it('avisa si el tornillo de bolsillo se asoma en triplay delgado', () => {
    const d = structuredClone(librero)
    d.piezas.find((p) => p.id === 'zoclo')!.material = 'T15'
    expect(hallazgos(d, 'R3_TORNILLOS').map((h) => h.datos.union)).toEqual(['u-zoclo-izq', 'u-zoclo-der'])
  })

  it('avisa si dos tornillos quedan pegados al extremo de una junta corta', () => {
    const d = structuredClone(librero)
    const zoclo = d.piezas.find((p) => p.id === 'zoclo')!
    zoclo.y = tramo(ref('mueble.y0'), null, 50)
    d.uniones = d.uniones.map((u) => (u.id === 'u-zoclo-izq' ? { ...u, tipo: 'tope-tornillo', herrajes: [{ herrajeId: 'tornillo-8x2', cantidad: 2 }] } : u))
    expect(hallazgos(d, 'R3_TORNILLOS').some((h) => h.datos.junta === 50)).toBe(true)
  })
})

describe('R4 vuelco', () => {
  it('un librero alto sin anclaje es crítico; anclado, nada', () => {
    expect(hallazgos({ ...librero, anclajeMuro: false }, 'R4_VUELCO')[0].severidad).toBe('critico')
    expect(hallazgos(librero, 'R4_VUELCO')).toEqual([])
  })

  it('uno más bajo es recomendación', () => {
    const bajo = { ...librero, anclajeMuro: false, dimensiones: { ...librero.dimensiones, alto: 1000 } }
    expect(hallazgos(bajo, 'R4_VUELCO')[0].severidad).toBe('recomendacion')
  })
})

describe('R6 puertas', () => {
  it('una puerta alta con dos bisagras pide más', () => {
    const alta = { ...alacena, dimensiones: { ...alacena.dimensiones, alto: 1600 } }
    const r6 = hallazgos(alta, 'R6_PUERTAS')
    expect(r6.map((h) => [h.piezas[0], h.severidad, h.datos.necesarias])).toEqual([
      ['puerta-izq', 'critico', 4],
      ['puerta-der', 'critico', 4],
    ])
  })

  it('una puerta de más de 60 cm sugiere dividirla', () => {
    const ancha = { ...buro, dimensiones: { ...buro.dimensiones, ancho: 700 } }
    expect(hallazgos(ancha, 'R6_PUERTAS').map((h) => h.alternativas[0].clave)).toEqual(['dos-puertas'])
  })
})

describe('R7 base', () => {
  it('un piso elevado sin zoclo y con claro largo pide apoyo; con zoclo corrido no', () => {
    const d = { ...structuredClone(librero), dimensiones: { ...librero.dimensiones, ancho: 1000 } }
    expect(hallazgos(d, 'R7_BASE')).toEqual([])
    d.piezas = d.piezas.filter((p) => p.id !== 'zoclo')
    d.uniones = d.uniones.filter((u) => u.a !== 'zoclo' && u.b !== 'zoclo')
    d.piezas.find((p) => p.id === 'piso')!.y = { desde: mm(70), hasta: null, largo: null }
    expect(hallazgos(d, 'R7_BASE').map((h) => h.datos.claro)).toEqual([964])
  })
})

describe('R8 veta', () => {
  it('marca como detalle la veta a lo ancho en piezas largas', () => {
    const d = structuredClone(librero)
    d.piezas.find((p) => p.id === 'lat-izq')!.veta = 'ancho'
    expect(hallazgos(d, 'R8_VETA').map((h) => [h.piezas[0], h.severidad])).toEqual([['lat-izq', 'detalle']])
  })
})

describe('fixtures', () => {
  it.each([librero, alacena])('$nombre no tiene observaciones', (d) => {
    const a = analizar(d, catalogo)
    expect(a.valido && a.hallazgos).toEqual([])
  })
})
