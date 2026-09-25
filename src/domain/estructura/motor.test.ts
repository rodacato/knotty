import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import type { Diseno } from '../diseno/esquema'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { criticosNuevos } from './motor'
import { claroMaximo, flecha, severidadFlecha } from './reglas/flecha'

const hallazgos = (d: Diseno) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(JSON.stringify(a.errores))
  return a.hallazgos
}

describe('R1 flecha de entrepaños', () => {
  it('reproduce los números de la propuesta (18 mm, fondo 300, libros, veta paralela)', () => {
    expect(flecha(600, 300, 18, 'pesada', 6000)).toBeCloseTo(1.28, 1)
    expect(flecha(900, 300, 18, 'pesada', 6000)).toBeCloseTo(6.47, 1)
    expect(flecha(441, 300, 18, 'pesada', 6000)).toBeCloseTo(0.37, 1)
    expect(flecha(600, 300, 15, 'pesada', 6000)).toBeCloseTo(2.21, 1)
  })

  it('clasifica según el claro', () => {
    expect(severidadFlecha(1.28, 600)).toBeNull()
    expect(severidadFlecha(2.21, 600)).toBe('recomendacion')
    expect(severidadFlecha(6.47, 900)).toBe('critico')
  })

  it('el claro máximo deja la flecha justo en el límite recomendado', () => {
    const claro = claroMaximo(300, 18, 'pesada', 6000)
    expect(flecha(claro, 300, 18, 'pesada', 6000)).toBeCloseTo(claro / 360, 5)
  })

  it('el librero ensanchado a 90 cm marca crítico y propone el divisor al centro', () => {
    const ancho = { ...librero, dimensiones: { ...librero.dimensiones, ancho: 900 } }
    const r1 = hallazgos(ancho).filter((h) => h.codigo === 'R1_FLECHA')
    expect(r1.map((h) => h.piezas[0]).sort()).toEqual(['entrepano-1', 'entrepano-2', 'entrepano-3', 'entrepano-4', 'piso'])
    expect(r1.every((h) => h.severidad === 'critico')).toBe(true)
    const divisor = r1[0].alternativas.find((a) => a.clave === 'divisor-al-centro')!
    expect(divisor.datos.flecha).toBeLessThan(1)
  })

  it('usa el módulo menor si la veta corre a lo ancho', () => {
    const d = structuredClone(librero)
    d.dimensiones.ancho = 800
    const conVeta = hallazgos(d).find((h) => h.piezas[0] === 'entrepano-1')
    d.piezas.find((p) => p.id === 'entrepano-1')!.veta = 'ancho'
    const contraVeta = hallazgos(d).find((h) => h.piezas[0] === 'entrepano-1')!
    expect(Number(contraVeta.datos.flecha)).toBeGreaterThan(Number(conVeta?.datos.flecha ?? 0))
  })
})

describe('R2 espesor por unión', () => {
  it('pide al menos 15 mm para tarugo y 15 mm para recibir tornillo al canto', () => {
    const d = structuredClone(buro)
    for (const p of d.piezas) if (p.rol === 'lateral') p.material = 'T12'
    const r2 = hallazgos(d).filter((h) => h.codigo === 'R2_ESPESOR_UNION')
    const porUnion = Object.fromEntries(r2.map((h) => [h.datos.union, h.severidad]))
    expect(porUnion['u-entrepano-izq']).toBe('critico')
    expect(porUnion['u-techo-izq']).toBe('recomendacion')
    expect(r2[0].alternativas[0].datos.material).toBe('T15')
  })

  it('no acepta tornillos en una trasera de 3 mm', () => {
    const d = structuredClone(buro)
    d.uniones = d.uniones.map((u) => (u.id === 'u-trasera-piso' ? { ...u, tipo: 'tope-tornillo' } : u))
    expect(hallazgos(d).some((h) => h.codigo === 'R2_ESPESOR_UNION' && h.datos.pieza === 'trasera')).toBe(true)
  })
})

describe('R5 escuadrado', () => {
  it('los fixtures con trasera de 6 mm fijada están bien', () => {
    expect(hallazgos(librero)).toEqual([])
    expect(hallazgos(alacena).filter((h) => h.codigo === 'R5_ESCUADRADO')).toEqual([])
  })

  it('el buró con trasera de 3 mm clavada es recomendación por ser bajo', () => {
    expect(hallazgos(buro).map((h) => [h.codigo, h.severidad])).toEqual([['R5_ESCUADRADO', 'recomendacion']])
  })

  it('es crítico en un mueble alto', () => {
    const d = structuredClone(librero)
    d.piezas.find((p) => p.id === 'trasera')!.material = 'TR3'
    expect(hallazgos(d).find((h) => h.codigo === 'R5_ESCUADRADO')?.severidad).toBe('critico')
  })
})

describe('criticosNuevos', () => {
  it('solo cuenta los que no estaban antes', () => {
    const antes = hallazgos({ ...librero, dimensiones: { ...librero.dimensiones, ancho: 900 } })
    const despues = hallazgos({ ...librero, dimensiones: { ...librero.dimensiones, ancho: 1000 } })
    expect(criticosNuevos(antes, despues)).toEqual([])
    expect(criticosNuevos([], despues).length).toBe(5)
  })
})
