import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { mm, ref, extent } from '../diseno/builders'
import type { Design } from '../diseno/schema'
import { exampleWallCabinet } from '../fixtures/wallCabinet'
import { exampleNightstand } from '../fixtures/nightstand'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'

const findings = (d: Design, codigo: string) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(JSON.stringify(a.errors))
  return a.findings.filter((h) => h.code === codigo)
}

describe('R3 screws', () => {
  it('asks for a longer screw when it does not go 25 mm into the piece that takes it', () => {
    const d = structuredClone(exampleBookcase)
    d.uniones = d.uniones.map((u) => (u.id === 'u-piso-izq' ? { ...u, herrajes: [{ herrajeId: 'tornillo-8x1-1/4', cantidad: null }] } : u))
    const [h] = findings(d, 'R3_TORNILLOS')
    expect(h).toMatchObject({ severity: 'recomendacion', data: { union: 'u-piso-izq' } })
    expect(h.alternatives[0].data.herrajeId).toBe('tornillo-8x2')
  })

  it('warns when a pocket screw pokes out of thin plywood', () => {
    const d = structuredClone(exampleBookcase)
    d.piezas.find((p) => p.id === 'zoclo')!.material = 'T15'
    expect(findings(d, 'R3_TORNILLOS').map((h) => h.data.union)).toEqual(['u-zoclo-izq', 'u-zoclo-der'])
  })

  it('warns when two screws sit at the ends of a short joint', () => {
    const d = structuredClone(exampleBookcase)
    const zoclo = d.piezas.find((p) => p.id === 'zoclo')!
    zoclo.y = extent(ref('mueble.y0'), null, 50)
    d.uniones = d.uniones.map((u) => (u.id === 'u-zoclo-izq' ? { ...u, a: 'lat-izq', b: 'zoclo', tipo: 'tope-tornillo', herrajes: [{ herrajeId: 'tornillo-8x2', cantidad: 2 }] } : u))
    expect(findings(d, 'R3_TORNILLOS').some((h) => h.data.junta === 50)).toBe(true)
  })
})

describe('R4 tipping', () => {
  it('a tall bookcase without anchoring is critical; anchored, nothing', () => {
    expect(findings({ ...exampleBookcase, anclajeMuro: false }, 'R4_VUELCO')[0].severity).toBe('critico')
    expect(findings(exampleBookcase, 'R4_VUELCO')).toEqual([])
  })

  it('a lower one is a recommendation', () => {
    const bajo = { ...exampleBookcase, anclajeMuro: false, dimensiones: { ...exampleBookcase.dimensiones, alto: 1000 } }
    expect(findings(bajo, 'R4_VUELCO')[0].severity).toBe('recomendacion')
  })
})

describe('R6 doors', () => {
  it('a tall door with two hinges asks for more', () => {
    const alta = { ...exampleWallCabinet, dimensiones: { ...exampleWallCabinet.dimensiones, alto: 1600 } }
    const r6 = findings(alta, 'R6_PUERTAS')
    expect(r6.map((h) => [h.pieces[0], h.severity, h.data.necesarias])).toEqual([
      ['puerta-izq', 'critico', 4],
      ['puerta-der', 'critico', 4],
    ])
  })

  it('a door wider than 60 cm suggests splitting it', () => {
    const ancha = { ...exampleNightstand, dimensiones: { ...exampleNightstand.dimensiones, ancho: 700 } }
    expect(findings(ancha, 'R6_PUERTAS').map((h) => h.alternatives[0].key)).toEqual(['dos-puertas'])
  })
})

describe('R7 base', () => {
  it('a raised floor without a kick over a long span asks for support; with a full kick it does not', () => {
    const d = { ...structuredClone(exampleBookcase), dimensiones: { ...exampleBookcase.dimensiones, ancho: 1000 } }
    expect(findings(d, 'R7_BASE')).toEqual([])
    d.piezas = d.piezas.filter((p) => p.id !== 'zoclo')
    d.uniones = d.uniones.filter((u) => u.a !== 'zoclo' && u.b !== 'zoclo')
    d.piezas.find((p) => p.id === 'piso')!.y = { desde: mm(70), hasta: null, largo: null }
    expect(findings(d, 'R7_BASE').map((h) => h.data.claro)).toEqual([964])
  })
})

describe('R8 grain', () => {
  it('marks grain across long pieces as a detail', () => {
    const d = structuredClone(exampleBookcase)
    d.piezas.find((p) => p.id === 'lat-izq')!.veta = 'ancho'
    expect(findings(d, 'R8_VETA').map((h) => [h.pieces[0], h.severity])).toEqual([['lat-izq', 'detalle']])
  })
})

describe('fixtures', () => {
  it('the bookcase has nothing to report', () => {
    const a = analyze(exampleBookcase, testCatalog)
    expect(a.valid && a.findings).toEqual([])
  })

  it('the wall cabinet only recommends the hanging rail', () => {
    const a = analyze(exampleWallCabinet, testCatalog)
    expect(a.valid && a.findings.map((h) => [h.code, h.severity, h.alternatives[0]?.key])).toEqual([['R10_USO', 'recomendacion', 'liston-colgar']])
  })
})
