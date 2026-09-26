import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { mm, ref, extent } from '../design/builders'
import type { Design } from '../design/schema'
import { exampleWallCabinet } from '../fixtures/wallCabinet'
import { exampleNightstand } from '../fixtures/nightstand'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { findingKey } from './finding'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetPlan } from '../modules/cabinet'
import { buildBed } from '../modules/bed'
import { buildTable } from '../modules/table'
import type { Cell } from '../reading/reading'

const findings = (d: Design, code: string) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(JSON.stringify(a.errors))
  return a.findings.filter((h) => h.code === code)
}

describe('R3 screws', () => {
  it('asks for a longer screw when it does not go 25 mm into the piece that takes it', () => {
    const d = structuredClone(exampleBookcase)
    d.joints = d.joints.map((u) => (u.id === 'j-bottom-left' ? { ...u, hardware: [{ hardwareId: 'screw-8x1-1/4', count: null }] } : u))
    const [h] = findings(d, 'R3_SCREWS')
    expect(h).toMatchObject({ severity: 'recommendation', data: { joint: 'j-bottom-left' } })
    expect(h.alternatives[0].data.hardwareId).toBe('screw-8x2')
  })

  it('warns when a pocket screw pokes out of thin plywood', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.find((p) => p.id === 'kick')!.material = 'T15'
    expect(findings(d, 'R3_SCREWS').map((h) => h.data.joint)).toEqual(['j-kick-left', 'j-kick-right'])
  })

  it('warns when two screws sit at the ends of a short joint', () => {
    const d = structuredClone(exampleBookcase)
    const kick = d.pieces.find((p) => p.id === 'kick')!
    kick.y = extent(ref('furniture.y0'), null, 50)
    d.joints = d.joints.map((u) => (u.id === 'j-kick-left' ? { ...u, a: 'side-left', b: 'kick', type: 'butt-screw', hardware: [{ hardwareId: 'screw-8x2', count: 2 }] } : u))
    expect(findings(d, 'R3_SCREWS').some((h) => h.data.jointLength === 50)).toBe(true)
  })
})

describe('R4 tipping', () => {
  it('a tall bookcase without anchoring is critical; anchored, nothing', () => {
    expect(findings({ ...exampleBookcase, wallAnchored: false }, 'R4_TIPPING')[0].severity).toBe('critical')
    expect(findings(exampleBookcase, 'R4_TIPPING')).toEqual([])
  })

  it('a lower one is a recommendation', () => {
    const low = { ...exampleBookcase, wallAnchored: false, dimensions: { ...exampleBookcase.dimensions, height: 1000 } }
    expect(findings(low, 'R4_TIPPING')[0].severity).toBe('recommendation')
  })

  // docs/carpinteria/valores-de-referencia.md §12: from 686 mm, anything with drawers or doors is anchored (ASTM F2057-23).
  const cell = (content: Cell['content'], doors: number | null = null): Cell => ({ height: 1, content, shelves: 0, doors })
  const cabinet = (height: number, cells: Cell[], extra: Partial<CabinetPlan> = {}) =>
    buildCabinet({ kind: 'cabinet', name: 'Mueble', dimensions: { width: 500, height, depth: 450 }, material: 'T18', base: 'floor', wallMounted: false, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells }], ...extra }, testCatalog).design
  const storage = (d: Design) => findings(d, 'R4_TIPPING').filter((h) => h.check === 'tipping.storage')

  it('furniture with drawers or doors from 686 mm high is anchored, whatever its depth or its name', () => {
    const chest = cabinet(700, [cell('drawer')])
    expect(storage(chest)).toMatchObject([{ severity: 'critical', data: { height: 700, drawers: 1, doors: 0, min: 686 }, alternatives: [{ key: 'anchor-to-wall' }] }])
    expect(storage(cabinet(686, [cell('door', 2)]))[0].message).toContain('tiene 2 puertas')
    expect(storage(cabinet(1800, [cell('drawer'), cell('door', 2)], { dimensions: { width: 900, height: 1800, depth: 600 } }))[0].message).toContain('1 cajón y 2 puertas')
    // Named or marked as anything, it is what it has.
    expect(storage({ ...chest, name: 'Librero', kind: 'bookcase' })).toHaveLength(1)
  })

  it('below 686 mm, anchored, or open, the anchoring for storage does not apply', () => {
    expect(storage(cabinet(680, [cell('drawer'), cell('drawer')]))).toEqual([])
    expect(findings(cabinet(900, [cell('drawer'), cell('drawer')], { wallMounted: true }), 'R4_TIPPING')).toEqual([])
    // Open furniture goes by its height against its depth, as before.
    expect(storage({ ...exampleBookcase, wallAnchored: false })).toEqual([])
  })

  it('a bed, a desk or a wall cabinet are not storage furniture: their drawers or doors do not ask for the anti-tip kit', () => {
    const bed = buildBed({ kind: 'bed', name: 'Cama', mattress: 'individual', material: 'T18', height: 400, drawers: { side: 'both', count: 3, position: 'head' }, headboard: { style: 'plain', height: 1100, depth: 0, shelves: 0 } }, testCatalog).design
    const desk = buildTable({ kind: 'table', use: 'desk', name: 'Escritorio', material: 'T18', dimensions: { width: 1300, height: 750, depth: 600 }, overhang: 0, shelf: false, pedestal: { side: 'left', drawers: 3 } }, testCatalog).design
    for (const d of [bed, desk, { ...exampleWallCabinet, wallAnchored: false, dimensions: { ...exampleWallCabinet.dimensions, height: 900 } }]) expect(storage(d)).toEqual([])
  })
})

describe('R6 doors', () => {
  it('a tall door with two hinges asks for more', () => {
    const tall = { ...exampleWallCabinet, dimensions: { ...exampleWallCabinet.dimensions, height: 1600 } }
    const r6 = findings(tall, 'R6_DOORS')
    expect(r6.map((h) => [h.pieces[0], h.severity, h.data.needed])).toEqual([
      ['door-left', 'critical', 4],
      ['door-right', 'critical', 4],
    ])
  })

  it('a door wider than 60 cm suggests splitting it', () => {
    const wide = { ...exampleNightstand, dimensions: { ...exampleNightstand.dimensions, width: 700 } }
    expect(findings(wide, 'R6_DOORS').map((h) => h.alternatives[0].key)).toEqual(['two-doors'])
  })
})

describe('R7 base', () => {
  it('a raised floor without a kick over a long span asks for support; with a full kick it does not', () => {
    const d = { ...structuredClone(exampleBookcase), dimensions: { ...exampleBookcase.dimensions, width: 1000 } }
    expect(findings(d, 'R7_BASE')).toEqual([])
    d.pieces = d.pieces.filter((p) => p.id !== 'kick')
    d.joints = d.joints.filter((u) => u.a !== 'kick' && u.b !== 'kick')
    d.pieces.find((p) => p.id === 'bottom')!.y = { from: mm(70), to: null, length: null }
    expect(findings(d, 'R7_BASE').map((h) => h.data.span)).toEqual([964])
  })
})

describe('R8 grain', () => {
  it('marks grain across long pieces as a detail', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.find((p) => p.id === 'side-left')!.grain = 'width'
    expect(findings(d, 'R8_GRAIN').map((h) => [h.pieces[0], h.severity])).toEqual([['side-left', 'detail']])
  })
})

describe('fixtures', () => {
  it('the bookcase has nothing to report', () => {
    const a = analyze(exampleBookcase, testCatalog)
    expect(a.valid && a.findings).toEqual([])
  })

  it('the wall cabinet only recommends the hanging rail', () => {
    const a = analyze(exampleWallCabinet, testCatalog)
    expect(a.valid && a.findings.map((h) => [h.code, h.severity, h.alternatives[0]?.key])).toEqual([['R10_USE', 'recommendation', 'hanging-rail']])
  })
})

describe('findingKey', () => {
  it('without a check it is the key saved so far; with one, the check tells apart findings on the same pieces', () => {
    expect(findingKey({ code: 'R1_SAG', pieces: ['shelf-2', 'shelf-1'] })).toBe('R1_SAG:shelf-1,shelf-2')
    expect(findingKey({ code: 'R6_DOORS', pieces: ['door'], check: 'door.hinges' })).not.toBe(findingKey({ code: 'R6_DOORS', pieces: ['door'], check: 'door.width' }))
  })

  it('no rule finds two things with the same key on one design', () => {
    const unanchoredCabinet = { ...exampleWallCabinet, wallAnchored: false }
    for (const d of [exampleBookcase, exampleNightstand, unanchoredCabinet, { ...exampleBookcase, wallAnchored: false, dimensions: { ...exampleBookcase.dimensions, width: 1100 } }]) {
      const a = analyze(d, testCatalog)
      const keys = a.valid ? a.findings.map(findingKey) : []
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})
