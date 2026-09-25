import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import type { Diseno } from '../diseno/esquema'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import type { Catalog } from '../materiales/catalog'
import { estimatePurchase } from '../materiales/purchase'
import { worst, reviewViability } from './viability'

function revisar(diseno: Diseno, c: Catalog = catalogo) {
  const a = analizar(diseno, catalogo)
  if (!a.valido) throw new Error(a.errores[0].message)
  return reviewViability({ design: diseno, geo: a.geo, catalog: c, purchase: estimatePurchase(diseno, a.geo, c), findings: a.hallazgos, unmet: [] })
}
const estado = (v: ReturnType<typeof revisar>, id: string) => v.comprobaciones.find((c) => c.id === id)!

describe('reviewViability', () => {
  it.each([librero, buro, alacena])('the examples add up and fit the sheet: $nombre', (diseno) => {
    const v = revisar(diseno)
    expect(estado(v, 'medidas').estado).toBe('ok')
    expect(estado(v, 'hoja').estado).toBe('ok')
    expect(v.veredicto).not.toBe('no-viable')
  })

  it('with more trim, a long piece stops fitting and the design is not viable', async () => {
    const alto = { ...librero, dimensiones: { ...librero.dimensiones, alto: 2400 } }
    const holgado = revisar(alto)
    expect(estado(holgado, 'hoja').estado).toBe('ok')
    const v = revisar(alto, { ...catalogo, acomodo: { ...catalogo.acomodo, refilado: 50 } })
    expect(estado(v, 'hoja')).toMatchObject({ estado: 'falla', imposible: true })
    expect(estado(v, 'hoja').detalle).toContain('2340')
    expect(v.veredicto).toBe('no-viable')
  })

  it('when the pieces do not add up to the furniture measures, it is not viable', () => {
    const a = analizar(librero, catalogo)
    if (!a.valido) throw new Error()
    const dice = { ...librero, dimensiones: { ...librero.dimensiones, ancho: 650 } }
    const v = reviewViability({ design: dice, geo: a.geo, catalog: catalogo, purchase: estimatePurchase(librero, a.geo, catalogo), findings: [], unmet: [] })
    expect(estado(v, 'medidas')).toMatchObject({ estado: 'falla', imposible: true, pedido: 'Haz que las piezas cierren exacto en 1800 × 650 × 300 mm' })
    expect(v.veredicto).toBe('no-viable')
  })

  it('the carpenter can harden the verdict but not soften it', () => {
    expect(worst('viable', 'con-cambios')).toBe('con-cambios')
    expect(worst('no-viable', 'viable')).toBe('no-viable')
  })
})
