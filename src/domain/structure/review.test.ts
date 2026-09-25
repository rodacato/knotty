import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import type { Diseno } from '../diseno/esquema'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { newCriticals } from './review'
import { maxSpan, deflection, deflectionSeverity } from './rules/deflection'

const hallazgos = (d: Diseno) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(JSON.stringify(a.errores))
  return a.hallazgos
}

describe('R1 flecha de entrepaños', () => {
  it('reproduce los números de la propuesta (18 mm, fondo 300, libros, veta paralela)', () => {
    expect(deflection(600, 300, 18, 'pesada', 6000)).toBeCloseTo(1.28, 1)
    expect(deflection(900, 300, 18, 'pesada', 6000)).toBeCloseTo(6.47, 1)
    expect(deflection(441, 300, 18, 'pesada', 6000)).toBeCloseTo(0.37, 1)
    expect(deflection(600, 300, 15, 'pesada', 6000)).toBeCloseTo(2.21, 1)
  })

  it('clasifica según el claro', () => {
    expect(deflectionSeverity(1.28, 600)).toBeNull()
    expect(deflectionSeverity(2.21, 600)).toBe('recomendacion')
    expect(deflectionSeverity(6.47, 900)).toBe('critico')
  })

  it('el claro máximo deja la flecha justo en el límite recomendado', () => {
    const claro = maxSpan(300, 18, 'pesada', 6000)
    expect(deflection(claro, 300, 18, 'pesada', 6000)).toBeCloseTo(claro / 360, 5)
  })

  it('el librero ensanchado a 90 cm marca crítico y propone el divisor al centro', () => {
    const ancho = { ...librero, dimensiones: { ...librero.dimensiones, ancho: 900 } }
    const r1 = hallazgos(ancho).filter((h) => h.code === 'R1_FLECHA')
    expect(r1.map((h) => h.pieces[0]).sort()).toEqual(['entrepano-1', 'entrepano-2', 'entrepano-3', 'entrepano-4', 'piso'])
    expect(r1.every((h) => h.severity === 'critico')).toBe(true)
    const divisor = r1[0].alternatives.find((a) => a.key === 'divisor-al-centro')!
    expect(divisor.data.flecha).toBeLessThan(1)
  })

  it('usa el módulo menor si la veta corre a lo ancho', () => {
    const d = structuredClone(librero)
    d.dimensiones.ancho = 800
    const conVeta = hallazgos(d).find((h) => h.pieces[0] === 'entrepano-1')
    d.piezas.find((p) => p.id === 'entrepano-1')!.veta = 'ancho'
    const contraVeta = hallazgos(d).find((h) => h.pieces[0] === 'entrepano-1')!
    expect(Number(contraVeta.data.flecha)).toBeGreaterThan(Number(conVeta?.data.flecha ?? 0))
  })
})

describe('R2 espesor por unión', () => {
  it('pide al menos 15 mm para tarugo y 15 mm para recibir tornillo al canto', () => {
    const d = structuredClone(buro)
    for (const p of d.piezas) if (p.rol === 'lateral') p.material = 'T12'
    const r2 = hallazgos(d).filter((h) => h.code === 'R2_ESPESOR_UNION')
    const porUnion = Object.fromEntries(r2.map((h) => [h.data.union, h.severity]))
    expect(porUnion['u-entrepano-izq']).toBe('critico')
    expect(porUnion['u-techo-izq']).toBe('recomendacion')
    expect(r2[0].alternatives[0].data.material).toBe('T15')
  })

  it('no acepta tornillos en una trasera de 3 mm', () => {
    const d = structuredClone(buro)
    d.uniones = d.uniones.map((u) => (u.id === 'u-trasera-piso' ? { ...u, tipo: 'tope-tornillo' } : u))
    expect(hallazgos(d).some((h) => h.code === 'R2_ESPESOR_UNION' && h.data.pieza === 'trasera')).toBe(true)
  })
})

describe('R5 escuadrado', () => {
  it('los fixtures con trasera de 6 mm fijada están bien', () => {
    expect(hallazgos(librero)).toEqual([])
    expect(hallazgos(alacena).filter((h) => h.code === 'R5_ESCUADRADO')).toEqual([])
  })

  it('el buró con trasera de 3 mm clavada es recomendación por ser bajo', () => {
    expect(hallazgos(buro).map((h) => [h.code, h.severity])).toEqual([['R5_ESCUADRADO', 'recomendacion']])
  })

  it('es crítico en un mueble alto', () => {
    const d = structuredClone(librero)
    d.piezas.find((p) => p.id === 'trasera')!.material = 'TR3'
    expect(hallazgos(d).find((h) => h.code === 'R5_ESCUADRADO')?.severity).toBe('critico')
  })
})

describe('criticosNuevos', () => {
  it('solo cuenta los que no estaban antes', () => {
    const antes = hallazgos({ ...librero, dimensiones: { ...librero.dimensiones, ancho: 900 } })
    const despues = hallazgos({ ...librero, dimensiones: { ...librero.dimensiones, ancho: 1000 } })
    expect(newCriticals(antes, despues)).toEqual([])
    expect(newCriticals([], despues).length).toBe(5)
  })
})
