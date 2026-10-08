import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { afterCut, afterCutText, cutList } from '../../estimate/cutList'
import { outline } from '../../design/slants'
import { estimatePurchase } from '../../estimate/purchase'
import { testCatalog } from '../fixtures/catalog.test-util'
import { buildTable, TablePlan } from './table'
import { FurniturePlan } from './plan'

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

describe('table option consistency', () => {
  it.each(['dining', 'coffee', 'side', 'standing'] as const)('%s cannot silently keep a desk pedestal', (use) => {
    const parsed = FurniturePlan.safeParse(table({ use, pedestal: { side: 'left', drawers: 2 } }))
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues).toContainEqual(expect.objectContaining({ path: ['pedestal'], message: expect.stringContaining('Solo un escritorio') }))
  })

  it.each([
    { side: 'none', drawers: 1 },
    { side: 'left', drawers: 0 },
    { side: 'right', drawers: 0 },
    { side: 'left', drawers: 5 },
  ] as const)('rejects a pedestal with $side and $drawers drawers', (pedestal) => {
    expect(FurniturePlan.safeParse(table({ use: 'desk', pedestal })).success).toBe(false)
  })

  it.each([1, 4])('accepts and builds a desk pedestal with %i drawers', (drawers) => {
    const parsed = FurniturePlan.parse(table({ use: 'desk', pedestal: { side: 'left', drawers }, dimensions: { width: 1300, height: 750, depth: 600 } }))
    expect(parsed.kind).toBe('table')
    const { design } = buildTable(parsed as TablePlan, testCatalog)
    expect(design.pieces.filter((p) => p.role === 'drawer-front')).toHaveLength(drawers)
  })

  it('rejects the low shelf on a desk, but accepts it on a coffee table', () => {
    expect(FurniturePlan.safeParse(table({ use: 'desk', shelf: true })).error?.issues).toContainEqual(expect.objectContaining({ path: ['shelf'] }))
    expect(FurniturePlan.safeParse(table({ use: 'coffee', shelf: true })).success).toBe(true)
  })

  it('rejects legs on a table too shallow for a front and a back leg, and builds the shallowest it takes', () => {
    const console = (depth: number, overhang: number, legs: TablePlan['legs'] = 'legs') => table({ legs, overhang, dimensions: { width: 1200, height: 750, depth } })
    for (const p of [console(244, 50), console(204, 30), console(144, 0)]) expect(FurniturePlan.safeParse(p).error?.issues).toContainEqual(expect.objectContaining({ path: ['dimensions', 'depth'], message: expect.stringMatching(/^No cupo/) }))
    for (const p of [console(245, 50), console(205, 30), console(145, 0)]) {
      expect(FurniturePlan.safeParse(p).success).toBe(true)
      expect(analyze(buildTable(p, testCatalog).design, testCatalog).valid).toBe(true)
    }
    expect(FurniturePlan.safeParse(console(144, 0, 'panel')).success).toBe(true)
  })

  it('says what is short under a desk: a width when there is a gap, and what crosses it when there is none', () => {
    const legroom = (dimensions: TablePlan['dimensions']) => {
      const a = analyze(buildTable(table({ use: 'desk', name: 'Escritorio', overhang: 0, dimensions }), testCatalog).design, testCatalog)
      return a.valid ? a.findings.filter((f) => f.check === 'desk.legroom').map((f) => f.message) : []
    }
    expect(legroom({ width: 1200, height: 750, depth: 600 })).toEqual([])
    expect(legroom({ width: 620, height: 750, depth: 600 })).toEqual([expect.stringMatching(/el más ancho mide \d+ mm/)])
    for (const low of [{ width: 1200, height: 700, depth: 600 }, { width: 1200, height: 750, depth: 450 }]) expect(legroom(low)).toEqual([expect.stringContaining('algo cruza todo el ancho')])
  })
})

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

describe('a table to work at standing', () => {
  const findingsOf = (p: Partial<TablePlan>) => {
    const a = analyze(buildTable(table(p), testCatalog).design, testCatalog)
    if (!a.valid) throw new Error(a.errors[0].message)
    return a.findings
  }
  const cleats = (p: Partial<TablePlan>) => buildTable(table(p), testCatalog).design.pieces.filter((x) => x.role === 'divider' && /Travesaño/.test(x.name)).length
  const standing: Partial<TablePlan> = { use: 'standing', name: 'Escritorio de pie', dimensions: { width: 1200, height: 1050, depth: 700 }, overhang: 30 }

  it('spaces the cleats for its heavy top, where a desk of the same size keeps the usual spacing', () => {
    expect(cleats(standing)).toBeGreaterThan(cleats({ ...standing, use: 'desk', name: 'Escritorio', dimensions: { width: 1200, height: 750, depth: 700 } }))
    expect(findingsOf(standing)).toEqual([])
  })

  it('is judged from 850 to 1100 mm, and a seated height is too low for it', () => {
    expect(findingsOf({ ...standing, dimensions: { ...standing.dimensions!, height: 900 } })).toEqual([])
    expect(findingsOf({ ...standing, dimensions: { ...standing.dimensions!, height: 760 } }).map((f) => f.check)).toEqual(['workbench.height'])
  })
})

describe('tapered legs on a table', () => {
  const built = (plan: TablePlan) => {
    const { design, notes } = buildTable(plan, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors[0].message)
    return { design, notes, a }
  }
  const onLegs = (p: Partial<TablePlan> = {}) => table({ legs: 'legs', ...p })

  it('narrows each leg from under the apron to the foot, on the side that faces the other row, the two in the middle of a long table too', () => {
    const { design, notes } = built(onLegs({ legStyle: 'tapered' }))
    const slant = (id: string) => design.pieces.find((p) => p.id === id)!.slants![0]
    expect(slant('leg-front-left-1')).toEqual({ x: null, y: { from: 'start', leave: 80 }, z: { from: 'start', length: 36 } })
    expect(slant('leg-back-right-2').z).toEqual({ from: 'end', length: 36 })
    expect(notes).toEqual([expect.stringMatching(/^Patas cónicas en 6 patas: cada una se adelgaza por dentro, de 72 mm bajo el faldón a 36 mm en el piso\./)])
  })

  it('changes nothing else: the same boards, joints, cut list and findings as straight legs', () => {
    for (const p of [{}, { use: 'coffee' as const, dimensions: { width: 1000, height: 420, depth: 550 }, overhang: 0, shelf: true }, { dimensions: { width: 2400, height: 750, depth: 900 } }]) {
      const [tapered, straight] = [built(onLegs({ ...p, legStyle: 'tapered' })), built(onLegs(p))]
      expect(tapered.design.pieces.map((x) => ({ ...x, slants: undefined }))).toEqual(straight.design.pieces.map((x) => ({ ...x, slants: undefined })))
      expect(tapered.design.joints).toEqual(straight.design.joints)
      expect(cutList(tapered.design, tapered.a.geo)).toEqual(cutList(straight.design, straight.a.geo))
      expect(tapered.a.findings).toEqual(straight.a.findings)
    }
  })

  it('leaves straight a panel end, the pedestal side of a desk and a table that does not say', () => {
    const slanted = (p: Partial<TablePlan>) => built(table(p)).design.pieces.filter((x) => x.slants).map((x) => x.id)
    expect(slanted({ legStyle: 'tapered' })).toEqual([])
    expect(slanted({ legs: 'legs' })).toEqual([])
    expect(slanted({ use: 'desk', legs: 'legs', legStyle: 'tapered', dimensions: { width: 1300, height: 750, depth: 600 }, overhang: 0, pedestal: { side: 'left', drawers: 2 } }).every((id) => id.endsWith('-right-1') || id.endsWith('-right-2'))).toBe(true)
  })
})

describe('a top with rounded corners', () => {
  const built = (p: Partial<TablePlan>) => {
    const { design, notes } = buildTable(table({ corners: 'rounded', ...p }), testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    const top = design.pieces.find((x) => x.id === 'top')!
    return { design, notes, a, top, corners: (top.rounds ?? []).map((r) => `${r.z}-${r.x}`) }
  }

  it('rounds the four corners of a top that overhangs all round, to 40 mm, and says how they are made', () => {
    const { top, corners, notes } = built({})
    expect(corners).toEqual(['start-start', 'start-end', 'end-start', 'end-end'])
    expect(top.rounds!.every((r) => r.radius === 40 && r.y === null)).toBe(true)
    expect(notes).toEqual(['Cubierta con 4 esquinas redondeadas a 40 mm de radio: se marcan con un compás o una tapa, se cortan con caladora y se emparejan con lija.'])
  })

  it('never shows what stands under the top: every corner of every end and leg is inside the rounded outline', () => {
    for (const p of [{}, { legs: 'legs' as const }, { overhang: 15 }, { use: 'desk' as const, overhang: 30, dimensions: { width: 1300, height: 750, depth: 600 }, pedestal: { side: 'left' as const, drawers: 2 } }]) {
      const { design, a, top } = built(p)
      const shape = outline(a.geo.boxes.get('top')!, 'y', [], top.rounds)
      const inside = (x: number, z: number) => shape.every(([px, pz], i) => {
        const [qx, qz] = shape[(i + 1) % shape.length]
        return (qx - px) * (z - pz) - (qz - pz) * (x - px) >= -1e-6
      })
      const under = design.pieces.filter((x) => x.id !== 'top' && x.normal !== 'y').map((x) => a.geo.boxes.get(x.id)!)
      expect(under.length).toBeGreaterThan(1)
      for (const b of under) for (const x of [b.x0, b.x1]) for (const z of [b.z0, b.z1]) expect(inside(x, z)).toBe(true)
    }
  })

  it('on a desk rounds only the front corners: its ends reach the back edge, which goes against the wall', () => {
    const { corners, notes } = built({ use: 'desk', name: 'Escritorio', overhang: 30, dimensions: { width: 1200, height: 750, depth: 600 } })
    expect(corners).toEqual(['end-start', 'end-end'])
    expect(built({ use: 'desk', legs: 'legs', overhang: 40, dimensions: { width: 1500, height: 750, depth: 650 }, pedestal: { side: 'right', drawers: 3 } }).corners).toEqual(['end-start', 'end-end'])
    expect(notes).toEqual(['Cubierta con 2 esquinas redondeadas a 40 mm de radio: se marcan con un compás o una tapa, se cortan con caladora y se emparejan con lija. Atrás quedan rectas, donde los costados llegan a la orilla.'])
  })

  it('with the top flush it is built square, and says why', () => {
    const { top, notes } = built({ overhang: 0 })
    expect(top.rounds).toBeUndefined()
    expect(notes).toEqual(['Con la cubierta al ras no se redondean las esquinas: asomaría lo que va debajo. Dale vuelo a la cubierta.'])
  })

  it('changes neither the board to buy nor its line in the cut list, which says what is left to do to it', () => {
    const [square, rounded] = [buildTable(table({}), testCatalog).design, built({}).design]
    const lines = (design: typeof square) => cutList(design, analyze(design, testCatalog).geo!)
    expect(lines(rounded)).toEqual(lines(square))
    const top = lines(rounded).find((line) => line.ids.includes('top'))!
    expect(afterCutText(afterCut(rounded, top), top.count)).toBe('Después de cortarla: esquinas redondeadas')
    expect(afterCutText(afterCut(square, top), top.count)).toBeNull()
  })

  it('a plan that does not ask builds a top that does not mention them', () => {
    expect('rounds' in buildTable(table({}), testCatalog).design.pieces.find((x) => x.id === 'top')!).toBe(false)
  })
})
