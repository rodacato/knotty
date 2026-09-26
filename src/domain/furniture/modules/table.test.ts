import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { testCatalog } from '../fixtures/catalog.test-util'
import { buildTable, type TablePlan } from './table'

const table = (p: Partial<TablePlan> = {}): TablePlan => ({
  kind: 'table',
  use: 'dining',
  name: 'Mesa de comedor',
  material: 'T18',
  dimensions: { width: 1500, height: 750, depth: 900 },
  overhang: 50,
  shelf: false,
  pedestal: { side: 'none', drawers: 0 },
  ...p,
})

const CASES: [string, Partial<TablePlan>][] = [
  ['dining 150', {}],
  ['dining 180', { dimensions: { width: 1800, height: 750, depth: 900 } }],
  ['dining 120 flush', { dimensions: { width: 1200, height: 760, depth: 800 }, overhang: 0 }],
  ['coffee', { use: 'coffee', name: 'Mesa de centro', dimensions: { width: 1000, height: 420, depth: 550 }, overhang: 0, shelf: true }],
  ['side', { use: 'side', name: 'Mesa lateral', dimensions: { width: 500, height: 550, depth: 400 }, overhang: 0, shelf: true }],
  ['desk', { use: 'desk', name: 'Escritorio', dimensions: { width: 1200, height: 750, depth: 600 }, overhang: 0 }],
  ['desk 150', { use: 'desk', name: 'Escritorio', dimensions: { width: 1500, height: 750, depth: 650 }, overhang: 20 }],
  ...([1, 2, 3, 4] as const).flatMap((drawers) =>
    (['left', 'right'] as const).map((side): [string, Partial<TablePlan>] => [`desk ${side} ${drawers}`, { use: 'desk', name: 'Escritorio con cajonera', dimensions: { width: 1300, height: 750, depth: 600 }, overhang: 0, pedestal: { side, drawers } }]),
  ),
]

describe('buildTable', () => {
  it.each(CASES)('%s: valid, with nothing to warn about', (_, p) => {
    const { design, notes } = buildTable(table(p), testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(JSON.stringify(a.errors.slice(0, 3)))
    expect(notes).toEqual([])
    expect(a.findings.map((h) => h.message)).toEqual([])
  })
  it('carries a long top on cleats between the aprons, never more than 60 cm apart', () => {
    const { design } = buildTable(table({ dimensions: { width: 1800, height: 750, depth: 900 } }), testCatalog)
    const geo = analyze(design, testCatalog).geo!
    const supports = design.pieces.filter((p) => p.id.startsWith('rail') || p.role === 'side').map((p) => geo.boxes.get(p.id)!).sort((a, b) => a.x0 - b.x0)
    const gaps = supports.slice(1).map((b, i) => b.x0 - supports[i].x1)
    expect(Math.max(...gaps)).toBeLessThanOrEqual(600)
    expect(design.joints.filter((u) => u.type === 'pocket-screw')).toHaveLength(4)
  })

  it.each([
    ['T15', 'pocket-screw-1'],
    ['T18', 'pocket-screw-1-1/4'],
  ])('in %s the aprons take the pocket screw for that board (%s), and R3 agrees', (material, screw) => {
    const { design } = buildTable(table({ material }), testCatalog)
    const pocket = design.joints.filter((u) => u.type === 'pocket-screw')
    expect([...new Set(pocket.flatMap((u) => u.hardware.map((h) => h.hardwareId)))]).toEqual([screw])
    const a = analyze(design, testCatalog)
    expect(a.valid && a.findings.filter((h) => h.code === 'R3_SCREWS')).toEqual([])
  })

  it('a 1¼" pocket screw in 15 mm is flagged, and the fix names the 1" one', () => {
    const { design } = buildTable(table({ material: 'T15' }), testCatalog)
    const long = { ...design, joints: design.joints.map((u) => (u.type === 'pocket-screw' ? { ...u, hardware: [{ hardwareId: 'pocket-screw-1-1/4', count: 2 }] } : u)) }
    const a = analyze(long, testCatalog)
    const r3 = a.valid ? a.findings.filter((h) => h.code === 'R3_SCREWS') : []
    expect(r3.length).toBeGreaterThan(0)
    expect(r3.map((h) => h.alternatives[0].data.hardwareId)).toEqual(r3.map(() => 'pocket-screw-1'))
  })

  it('a desk with a pedestal keeps room for the legs and its drawers open to the front', () => {
    const { design } = buildTable(table({ use: 'desk', name: 'Escritorio', dimensions: { width: 1300, height: 750, depth: 600 }, overhang: 0, pedestal: { side: 'right', drawers: 3 } }), testCatalog)
    const geo = analyze(design, testCatalog).geo!
    const fronts = design.pieces.filter((p) => p.role === 'drawer-front').map((p) => geo.boxes.get(p.id)!)
    expect(fronts).toHaveLength(3)
    expect(fronts.every((b) => b.z1 === 600 && b.x0 > 1300 - 420)).toBe(true)
    expect(geo.boxes.get('ped-div')!.x0 - geo.boxes.get('side-left')!.x1).toBeGreaterThanOrEqual(600)
  })

  it('a desk does not take a low shelf: it would be in the way of the legs', () => {
    const { design, notes } = buildTable(table({ use: 'desk', name: 'Escritorio', dimensions: { width: 1200, height: 750, depth: 600 }, overhang: 0, shelf: true }), testCatalog)
    expect(design.pieces.some((p) => p.id === 'low-shelf')).toBe(false)
    expect(notes).toEqual([expect.stringContaining('estorba las piernas')])
  })
})
