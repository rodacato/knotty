import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import type { Diseno } from '../diseno/esquema'
import type { CodigoRegla } from '../estructura/hallazgo'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { fixesFor } from './fixes'

const findings = (d: Diseno) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(a.errores[0].mensaje)
  return a.hallazgos
}
const finding = (d: Diseno, code: CodigoRegla) => findings(d).find((h) => h.codigo === code)!

describe('fixesFor', () => {
  it('a sagging shelf gets a support under its middle, and stops sagging', () => {
    const wide = { ...librero, dimensiones: { ...librero.dimensiones, ancho: 1100 } }
    const sag = finding(wide, 'R1_FLECHA')
    const fix = fixesFor(wide, catalogo, sag).find((f) => f.key === 'divisor-al-centro')!
    expect(fix.design.piezas.some((p) => p.id === `apoyo-${sag.piezas[0]}`)).toBe(true)
    expect(findings(fix.design).some((h) => h.codigo === 'R1_FLECHA' && h.piezas.includes(sag.piezas[0]))).toBe(false)
  })

  it('a wall cabinet gets its hanging rail', () => {
    const rail = finding(alacena, 'R10_USO')
    const [fix] = fixesFor(alacena, catalogo, rail)
    expect(fix.key).toBe('liston-colgar')
    expect(findings(fix.design).some((h) => h.codigo === 'R10_USO')).toBe(false)
  })

  it('a box that can rack gets a rigid rail with pocket screws, and is square', () => {
    const racking = finding(buro, 'R5_ESCUADRADO')
    const fix = fixesFor(buro, catalogo, racking).find((f) => f.key === 'faja-rigida')!
    expect(fix.design.uniones.filter((u) => u.tipo === 'bolsillo')).toHaveLength(2)
    expect(findings(fix.design).some((h) => h.codigo === 'R5_ESCUADRADO')).toBe(false)
  })

  it('a tall piece is anchored to the wall', () => {
    const loose = { ...librero, anclajeMuro: false }
    const [fix] = fixesFor(loose, catalogo, finding(loose, 'R4_VUELCO'))
    expect(fix.design.anclajeMuro).toBe(true)
  })
})
