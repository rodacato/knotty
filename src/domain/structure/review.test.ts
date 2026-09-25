import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import type { Diseno } from '../diseno/esquema'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { newCriticals } from './review'
import { maxSpan, deflection, deflectionSeverity } from './rules/deflection'

const findings = (d: Diseno) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(JSON.stringify(a.errores))
  return a.hallazgos
}

describe('R1 shelf sag', () => {
  it('reproduces the numbers of the proposal (18 mm, 300 deep, books, grain along)', () => {
    expect(deflection(600, 300, 18, 'pesada', 6000)).toBeCloseTo(1.28, 1)
    expect(deflection(900, 300, 18, 'pesada', 6000)).toBeCloseTo(6.47, 1)
    expect(deflection(441, 300, 18, 'pesada', 6000)).toBeCloseTo(0.37, 1)
    expect(deflection(600, 300, 15, 'pesada', 6000)).toBeCloseTo(2.21, 1)
  })

  it('grades by span', () => {
    expect(deflectionSeverity(1.28, 600)).toBeNull()
    expect(deflectionSeverity(2.21, 600)).toBe('recomendacion')
    expect(deflectionSeverity(6.47, 900)).toBe('critico')
  })

  it('the longest span leaves the sag right at the recommended limit', () => {
    const claro = maxSpan(300, 18, 'pesada', 6000)
    expect(deflection(claro, 300, 18, 'pesada', 6000)).toBeCloseTo(claro / 360, 5)
  })

  it('the bookcase widened to 90 cm is critical and proposes a center divider', () => {
    const ancho = { ...librero, dimensiones: { ...librero.dimensiones, ancho: 900 } }
    const r1 = findings(ancho).filter((h) => h.code === 'R1_FLECHA')
    expect(r1.map((h) => h.pieces[0]).sort()).toEqual(['entrepano-1', 'entrepano-2', 'entrepano-3', 'entrepano-4', 'piso'])
    expect(r1.every((h) => h.severity === 'critico')).toBe(true)
    const divisor = r1[0].alternatives.find((a) => a.key === 'divisor-al-centro')!
    expect(divisor.data.flecha).toBeLessThan(1)
  })

  it('takes the lower modulus when the grain runs across', () => {
    const d = structuredClone(librero)
    d.dimensiones.ancho = 800
    const conVeta = findings(d).find((h) => h.pieces[0] === 'entrepano-1')
    d.piezas.find((p) => p.id === 'entrepano-1')!.veta = 'ancho'
    const contraVeta = findings(d).find((h) => h.pieces[0] === 'entrepano-1')!
    expect(Number(contraVeta.data.flecha)).toBeGreaterThan(Number(conVeta?.data.flecha ?? 0))
  })
})

describe('R2 thickness per joint', () => {
  it('asks for at least 15 mm for a dowel and 15 mm to take an edge screw', () => {
    const d = structuredClone(buro)
    for (const p of d.piezas) if (p.rol === 'lateral') p.material = 'T12'
    const r2 = findings(d).filter((h) => h.code === 'R2_ESPESOR_UNION')
    const porUnion = Object.fromEntries(r2.map((h) => [h.data.union, h.severity]))
    expect(porUnion['u-entrepano-izq']).toBe('critico')
    expect(porUnion['u-techo-izq']).toBe('recomendacion')
    expect(r2[0].alternatives[0].data.material).toBe('T15')
  })

  it('does not take screws in a 3 mm back', () => {
    const d = structuredClone(buro)
    d.uniones = d.uniones.map((u) => (u.id === 'u-trasera-piso' ? { ...u, tipo: 'tope-tornillo' } : u))
    expect(findings(d).some((h) => h.code === 'R2_ESPESOR_UNION' && h.data.pieza === 'trasera')).toBe(true)
  })
})

describe('R5 racking', () => {
  it('the fixtures with a fixed 6 mm back are fine', () => {
    expect(findings(librero)).toEqual([])
    expect(findings(alacena).filter((h) => h.code === 'R5_ESCUADRADO')).toEqual([])
  })

  it('the nightstand with a nailed 3 mm back is a recommendation because it is low', () => {
    expect(findings(buro).map((h) => [h.code, h.severity])).toEqual([['R5_ESCUADRADO', 'recomendacion']])
  })

  it('is critical in a tall piece', () => {
    const d = structuredClone(librero)
    d.piezas.find((p) => p.id === 'trasera')!.material = 'TR3'
    expect(findings(d).find((h) => h.code === 'R5_ESCUADRADO')?.severity).toBe('critico')
  })
})

describe('newCriticals', () => {
  it('counts only those that were not there before', () => {
    const antes = findings({ ...librero, dimensiones: { ...librero.dimensiones, ancho: 900 } })
    const despues = findings({ ...librero, dimensiones: { ...librero.dimensiones, ancho: 1000 } })
    expect(newCriticals(antes, despues)).toEqual([])
    expect(newCriticals([], despues).length).toBe(5)
  })
})
