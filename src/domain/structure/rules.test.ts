import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { mm, ref, extent } from '../diseno/builders'
import type { Design } from '../diseno/schema'
import { exampleWallCabinet } from '../fixtures/wallCabinet'
import { exampleNightstand } from '../fixtures/nightstand'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'

const findings = (d: Design, code: string) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(JSON.stringify(a.errors))
  return a.findings.filter((h) => h.code === code)
}

describe('R3 screws', () => {
  it('asks for a longer screw when it does not go 25 mm into the piece that takes it', () => {
    const d = structuredClone(exampleBookcase)
    d.joints = d.joints.map((u) => (u.id === 'u-piso-izq' ? { ...u, hardware: [{ hardwareId: 'tornillo-8x1-1/4', count: null }] } : u))
    const [h] = findings(d, 'R3_SCREWS')
    expect(h).toMatchObject({ severity: 'recommendation', data: { union: 'u-piso-izq' } })
    expect(h.alternatives[0].data.herrajeId).toBe('tornillo-8x2')
  })

  it('warns when a pocket screw pokes out of thin plywood', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.find((p) => p.id === 'zoclo')!.material = 'T15'
    expect(findings(d, 'R3_SCREWS').map((h) => h.data.union)).toEqual(['u-zoclo-izq', 'u-zoclo-der'])
  })

  it('warns when two screws sit at the ends of a short joint', () => {
    const d = structuredClone(exampleBookcase)
    const zoclo = d.pieces.find((p) => p.id === 'zoclo')!
    zoclo.y = extent(ref('mueble.y0'), null, 50)
    d.joints = d.joints.map((u) => (u.id === 'u-zoclo-izq' ? { ...u, a: 'lat-izq', b: 'zoclo', type: 'butt-screw', hardware: [{ hardwareId: 'tornillo-8x2', count: 2 }] } : u))
    expect(findings(d, 'R3_SCREWS').some((h) => h.data.junta === 50)).toBe(true)
  })
})

describe('R4 tipping', () => {
  it('a tall bookcase without anchoring is critical; anchored, nothing', () => {
    expect(findings({ ...exampleBookcase, wallAnchored: false }, 'R4_TIPPING')[0].severity).toBe('critical')
    expect(findings(exampleBookcase, 'R4_TIPPING')).toEqual([])
  })

  it('a lower one is a recommendation', () => {
    const bajo = { ...exampleBookcase, wallAnchored: false, dimensions: { ...exampleBookcase.dimensions, height: 1000 } }
    expect(findings(bajo, 'R4_TIPPING')[0].severity).toBe('recommendation')
  })
})

describe('R6 doors', () => {
  it('a tall door with two hinges asks for more', () => {
    const alta = { ...exampleWallCabinet, dimensions: { ...exampleWallCabinet.dimensions, height: 1600 } }
    const r6 = findings(alta, 'R6_DOORS')
    expect(r6.map((h) => [h.pieces[0], h.severity, h.data.necesarias])).toEqual([
      ['puerta-izq', 'critical', 4],
      ['puerta-der', 'critical', 4],
    ])
  })

  it('a door wider than 60 cm suggests splitting it', () => {
    const ancha = { ...exampleNightstand, dimensions: { ...exampleNightstand.dimensions, width: 700 } }
    expect(findings(ancha, 'R6_DOORS').map((h) => h.alternatives[0].key)).toEqual(['dos-puertas'])
  })
})

describe('R7 base', () => {
  it('a raised floor without a kick over a long span asks for support; with a full kick it does not', () => {
    const d = { ...structuredClone(exampleBookcase), dimensions: { ...exampleBookcase.dimensions, width: 1000 } }
    expect(findings(d, 'R7_BASE')).toEqual([])
    d.pieces = d.pieces.filter((p) => p.id !== 'zoclo')
    d.joints = d.joints.filter((u) => u.a !== 'zoclo' && u.b !== 'zoclo')
    d.pieces.find((p) => p.id === 'piso')!.y = { from: mm(70), to: null, length: null }
    expect(findings(d, 'R7_BASE').map((h) => h.data.claro)).toEqual([964])
  })
})

describe('R8 grain', () => {
  it('marks grain across long pieces as a detail', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.find((p) => p.id === 'lat-izq')!.grain = 'width'
    expect(findings(d, 'R8_GRAIN').map((h) => [h.pieces[0], h.severity])).toEqual([['lat-izq', 'detail']])
  })
})

describe('fixtures', () => {
  it('the bookcase has nothing to report', () => {
    const a = analyze(exampleBookcase, testCatalog)
    expect(a.valid && a.findings).toEqual([])
  })

  it('the wall cabinet only recommends the hanging rail', () => {
    const a = analyze(exampleWallCabinet, testCatalog)
    expect(a.valid && a.findings.map((h) => [h.code, h.severity, h.alternatives[0]?.key])).toEqual([['R10_USE', 'recommendation', 'liston-colgar']])
  })
})
