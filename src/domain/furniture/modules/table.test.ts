import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { cutList } from '../../materials/cutList'
import { estimatePurchase } from '../../materials/purchase'
import { testCatalog } from '../fixtures/catalog.test-util'
import { buildTable, TablePlan } from './table'

const table = (p: Partial<TablePlan> = {}): TablePlan => ({
  kind: 'table',
  use: 'dining',
  name: 'Mesa de comedor',
  material: 'T18',
  dimensions: { width: 1500, height: 750, depth: 900 },
  overhang: 50,
  shelf: false,
  pedestal: { side: 'none', drawers: 0 },
  legs: 'panel',
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

  describe('on legs', () => {
    const ids = (p: TablePlan) => buildTable(p, testCatalog).design.pieces.map((x) => x.id)
    const box = (p: TablePlan, id: string) => analyze(buildTable(p, testCatalog).design, testCatalog).geo!.boxes.get(id)!
    const LEGGED: [string, Partial<TablePlan>][] = CASES.map(([name, p]) => [name, { ...p, legs: 'legs' as const }])

    it.each(LEGGED)('%s: valid, with nothing to warn about', (_, p) => {
      const { design, notes } = buildTable(table(p), testCatalog)
      const a = analyze(design, testCatalog)
      if (!a.valid) throw new Error(JSON.stringify(a.errors.slice(0, 3)))
      expect(notes).toEqual([])
      expect(a.findings.map((h) => h.message)).toEqual([])
    })

    it('four legs take the place of the two panel ends, and the aprons stay', () => {
      const panels = ids(table())
      const legs = ids(table({ legs: 'legs' }))
      expect(panels.filter((id) => id.startsWith('side-'))).toHaveLength(2)
      expect(legs.filter((id) => id.startsWith('side-'))).toEqual([])
      expect(legs.filter((id) => /^leg-(front|back)-(left|right)-[12]$/.test(id))).toHaveLength(8)
      expect(legs).toEqual(expect.arrayContaining(['apron-front', 'apron-back', 'apron-left', 'apron-right']))
      const b = box(table({ legs: 'legs' }), 'leg-front-left-1')
      expect([b.y0, b.y1]).toEqual([0, 750 - 18])
    })

    it('a leg is 36 × 72 mm from the floor to the underside of the top, at the corners of the ends', () => {
      const plan = table({ legs: 'legs' })
      const [a, b, c] = ['leg-front-left-1', 'leg-front-left-2', 'leg-back-right-1'].map((id) => box(plan, id))
      expect(b.x1 - a.x0).toBe(36)
      expect(a.z1 - a.z0).toBe(72)
      expect([a.x0, c.x1, c.z0, a.z1]).toEqual([50, 1450, 50, 850])
    })

    it('a table with no overhang and no apron-less span: the back apron of a desk stays 300 high', () => {
      const plan = table({ use: 'desk', name: 'Escritorio', dimensions: { width: 1200, height: 750, depth: 600 }, overhang: 0, legs: 'legs' })
      const b = box(plan, 'apron-back')
      expect(b.y1 - b.y0).toBe(300)
    })

    it('with a pedestal, its side keeps the panel and the legs go in the other two corners', () => {
      const left = ids(table({ use: 'desk', name: 'Escritorio', dimensions: { width: 1300, height: 750, depth: 600 }, overhang: 0, pedestal: { side: 'left', drawers: 3 }, legs: 'legs' }))
      expect(left).toContain('side-left')
      expect(left).not.toContain('side-right')
      expect(left.filter((id) => id.startsWith('leg-') && id.endsWith('-1'))).toEqual(['leg-front-right-1', 'leg-back-right-1'])
      expect(left).toEqual(expect.arrayContaining(['ped-div', 'ped-back', 'apron-right']))
      expect(left).not.toContain('apron-left')
      const right = ids(table({ use: 'desk', name: 'Escritorio', dimensions: { width: 1300, height: 750, depth: 600 }, overhang: 0, pedestal: { side: 'right', drawers: 2 }, legs: 'legs' }))
      expect(right).toContain('side-right')
      expect(right).not.toContain('side-left')
    })

    it('a plan saved before legs existed builds exactly as a plan on panels', () => {
      const { legs: _, ...old } = table()
      const parsed = TablePlan.parse(old)
      expect(parsed.legs).toBe('panel')
      expect(buildTable(parsed, testCatalog)).toEqual(buildTable(table({ legs: 'panel' }), testCatalog))
    })

    it('a long table gets a leg in the middle, front and back, and never two legs more than 1 200 mm apart', () => {
      for (const width of [1500, 1800, 2400]) {
        const plan = table({ legs: 'legs', dimensions: { width, height: 750, depth: 900 } })
        const { design } = buildTable(plan, testCatalog)
        const geo = analyze(design, testCatalog).geo!
        const floor = design.pieces.filter((p) => p.id.startsWith('leg-')).map((p) => geo.boxes.get(p.id)!).sort((a, b) => a.x0 - b.x0)
        const gaps = floor.slice(1).map((b, i) => b.x0 - floor[i].x1).filter((g) => g > 0)
        expect(Math.max(...gaps)).toBeLessThanOrEqual(1200)
        expect(design.pieces.some((p) => p.id.startsWith('leg-middle'))).toBe(true)
      }
      expect(ids(table({ legs: 'legs', dimensions: { width: 1100, height: 750, depth: 900 } })).some((id) => id.startsWith('leg-middle'))).toBe(false)
    })

    it('a cleat that falls on a middle leg runs between its posts and never crosses them', () => {
      const { design } = buildTable(table({ legs: 'legs', dimensions: { width: 2400, height: 750, depth: 900 } }), testCatalog)
      const a = analyze(design, testCatalog)
      if (!a.valid) throw new Error(JSON.stringify(a.errors.slice(0, 3)))
      expect(a.findings.map((h) => h.message)).toEqual([])
    })

    it('the cut list and the buy list change with the legs', () => {
      const built = (p: TablePlan) => {
        const { design } = buildTable(p, testCatalog)
        const geo = analyze(design, testCatalog).geo!
        return { cuts: cutList(design, geo), purchase: estimatePurchase(design, geo, testCatalog) }
      }
      const [panels, legs] = [built(table()), built(table({ legs: 'legs' }))]
      expect(panels.cuts.some((c) => c.name.startsWith('Costado'))).toBe(true)
      expect(legs.cuts.some((c) => c.name.startsWith('Costado'))).toBe(false)
      expect(legs.cuts.filter((c) => c.name.startsWith('Pata')).reduce((n, c) => n + c.count, 0)).toBe(12)
      expect(legs.cuts.find((c) => c.name.startsWith('Pata'))).toMatchObject({ thickness: 18, width: 72, length: 732 })
      expect(legs.purchase.hardware.length).toBeGreaterThan(0)
      const sheets = (b: typeof panels) => b.purchase.sheets.reduce((n, l) => n + l.sheets, 0)
      expect(sheets(legs)).toBeLessThanOrEqual(sheets(panels))
    })
  })
})
