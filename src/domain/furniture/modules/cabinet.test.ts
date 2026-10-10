import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { testCatalog } from '../fixtures/catalog.test-util'
import type { Cell } from '../reading/reading'
import { isVisible } from './fields'
import { buildCabinet, cabinetModule, CabinetPlan, cellOptions, choicesFor, DEFAULT_CONSTRUCTION, ExpertColumns, leafCells, type CabinetConstruction, type PlanCell, type PlanColumn } from './cabinet'
import { countLimits, quickCounts, setCount } from './cabinetCounts'
import { explain } from '../explain'
import { LEG_HEIGHT, LEG_HEIGHT_RANGE, MIN_CARCASS_HEIGHT } from './common'
import { ASSUMPTIONS } from '../../assumptions'
import { cutBox } from '../../design/cuts'
import { doorMount, slides } from '../../design/doors'
import { FurniturePlan } from './plan'
import { cutList } from '../../estimate/cutList'
import { estimatePurchase } from '../../estimate/purchase'
import { tippingBalance } from '../../checks/structure/rules/tippingBalance'
import { rodRuns } from '../../design/rods'
import { afterCut, afterCutText } from '../../estimate/cutList'

const cell = (content: Cell['content'], height = 1, extra: Partial<Cell> = {}): Cell => ({ height, content, shelves: null, doors: null, ...extra })
const plan = (p: Partial<CabinetPlan>): CabinetPlan => ({ kind: 'cabinet', name: 'Mueble', dimensions: { width: 600, height: 1800, depth: 300 }, material: 'T18', base: 'kick', legHeight: 150, wallMounted: true, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [cell('open', 1, { shelves: 4 })] }], ...p })

const PLANS: Record<string, CabinetPlan> = {
  bookcase: plan({ name: 'Librero' }),
  nightstand: plan({ name: 'Buró', dimensions: { width: 450, height: 550, depth: 400 }, base: 'floor', legHeight: 150, wallMounted: false, columns: [{ width: 1, cells: [cell('open', 0.6, { shelves: 0 }), cell('drawer', 0.4)] }] }),
  wallCabinet: plan({ name: 'Alacena', dimensions: { width: 760, height: 720, depth: 320 }, base: 'floor', columns: [{ width: 1, cells: [cell('door', 1, { doors: 2, shelves: 1 })] }] }),
  tvStand: plan({
    name: 'Mueble de TV',
    dimensions: { width: 1600, height: 500, depth: 400 },
    wallMounted: false,
    columns: [{ width: 0.3, cells: [cell('door', 1, { doors: 1 })] }, { width: 0.4, cells: [cell('open', 1, { shelves: 1 })] }, { width: 0.3, cells: [cell('door', 1, { doors: 1 })] }],
  }),
  drawerChest: plan({ name: 'Cajonera', dimensions: { width: 500, height: 900, depth: 450 }, wallMounted: false, columns: [{ width: 1, cells: [cell('drawer'), cell('drawer'), cell('drawer')] }] }),
  sideboard: plan({
    name: 'Aparador',
    dimensions: { width: 1600, height: 940, depth: 400 },
    base: 'legs',
    columns: [
      { width: 1, cells: [cell('door', 0.75, { doors: 1, shelves: 1 }), cell('drawer', 0.25)] },
      { width: 1, cells: [cell('door', 0.75, { doors: 1 }), cell('open', 0.25)] },
      { width: 1, cells: [cell('door', 0.75, { doors: 1 }), cell('open', 0.25)] },
      { width: 1, cells: [cell('drawer', 0.4), cell('drawer', 0.35), cell('open', 0.25)] },
    ],
  }),
  headboard: plan({ name: 'Cabecera', dimensions: { width: 1030, height: 900, depth: 250 }, base: 'floor', columns: [{ width: 1, cells: [cell('closed', 0.4), cell('open', 0.6, { shelves: 1 })] }] }),
}

describe('buildCabinet', () => {
  it.each(Object.entries(PLANS))('builds a valid %s with no overlaps and every contact joined', (_, p) => {
    const { design, notes } = buildCabinet(p, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    expect(a.warnings.filter((w) => w.code === 'W_CONTACT_WITHOUT_JOINT')).toEqual([])
    expect(notes.filter((n) => !n.startsWith('Muesca'))).toEqual([])
  })

  it('makes one drawer per drawer cell, with slides', () => {
    const { design } = buildCabinet(PLANS.drawerChest, testCatalog)
    expect(new Set(design.pieces.map((p) => p.group).filter(Boolean))).toEqual(new Set(['drawer-1', 'drawer-2', 'drawer-3']))
    expect(design.joints.filter((u) => u.type === 'drawer-slide').length).toBeGreaterThanOrEqual(3)
  })

  it('hangs each door and puts movable shelves on supports', () => {
    const { design } = buildCabinet(PLANS.wallCabinet, testCatalog)
    expect(design.joints.filter((u) => u.type === 'cup-hinge').map((u) => u.a).sort()).toEqual(['c1-h1-door-left', 'c1-h1-door-right'])
    expect(design.joints.filter((u) => u.type === 'shelf-pin')).toHaveLength(2)
  })

  it('a drawer too shallow for any slide stays as an open cell, and says so', () => {
    const { design, notes } = buildCabinet(plan({ dimensions: { width: 500, height: 400, depth: 250 }, columns: [{ width: 1, cells: [cell('drawer')] }] }), testCatalog)
    expect(design.pieces.some((p) => p.group)).toBe(false)
    expect(notes[0]).toMatch(/^Cajón 1: No cabe un cajón/)
  })

  it('scales column widths and cell heights that do not add up to 1', () => {
    const { design } = buildCabinet(plan({ columns: [{ width: 2, cells: [cell('open', 3)] }, { width: 2, cells: [cell('open', 3)] }] }), testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors[0].message)
    expect(a.geo.boxes.get('div-1')!.x0).toBe(291)
  })
})

describe('the rail a wall cabinet hangs from', () => {
  const hung = (columns: CabinetPlan['columns'], construction: Partial<CabinetConstruction> = {}) => {
    const { design } = buildCabinet(plan({ name: 'Alacena', dimensions: { width: 800, height: 700, depth: 370 }, base: 'floor', construction: { ...DEFAULT_CONSTRUCTION, ...construction }, columns }), testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    return { rails: design.pieces.filter((p) => p.role === 'brace').map((p) => p.id), box: (id: string) => a.geo.boxes.get(id)!, checks: a.findings.map((f) => f.check) }
  }
  const niche = { width: 1, cells: [cell('open', 1, { shelves: 1 })] }

  it('goes in each stretch under the top when the top cell is split, between its dividers', () => {
    const { rails, box, checks } = hung([{ width: 1, cells: [{ ...cell('door', 1, { doors: 2, shelves: 0 }), columns: [niche, niche] }] }], { doors: 'sliding' })
    expect(rails).toEqual(['hanging-rail-1', 'hanging-rail-2'])
    expect([box('hanging-rail-1').x1, box('hanging-rail-2').x0]).toEqual([box('c1-h1-div-1').x0, box('c1-h1-div-1').x1])
    expect(checks).not.toContain('wall-cabinet.hanging-rail')
  })

  it('is announced beside «Anclado al muro» exactly where it is drawn', () => {
    const said = cabinetModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).find((f) => f.type === 'note' && f.about === 'wallMounted')!
    const wrong = cabinetModule.benchVariants().flatMap(([name, variant]) => ['floor', 'kick', 'legs'].flatMap((base) => [true, false].map((wallMounted) => ({ ...variant, base, wallMounted }) as CabinetPlan)).filter((p) => FurniturePlan.safeParse(p).success).filter((p) => isVisible(said, p) !== buildCabinet(p, testCatalog).design.pieces.some((piece) => piece.id.startsWith('hanging-rail'))).map((p) => `${name}: ${p.base}, ${p.wallMounted}`))
    expect(wrong).toEqual([])
  })

  it('stays one board, with its name, in a cabinet of one column that is not split', () => {
    expect(hung([{ width: 1, cells: [cell('door', 1, { doors: 2, shelves: 1 })] }]).rails).toEqual(['hanging-rail'])
  })
})

describe('the grooves sliding doors run in', () => {
  const grooved = (construction: Partial<CabinetConstruction>, own?: PlanCell['own']) => {
    const { design } = buildCabinet(plan({ name: 'Alacena', dimensions: { width: 600, height: 700, depth: 370 }, base: 'floor', construction: { ...DEFAULT_CONSTRUCTION, ...construction }, columns: [{ width: 1, cells: [{ ...cell('door', 1, { doors: 2, shelves: 1 }), own }] }] }), testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    const cutsOf = (id: string) => (design.pieces.find((p) => p.id === id)!.cuts ?? []).map((cut) => cutBox(a.geo.boxes.get(id)!, cut))
    return { cutsOf, box: (id: string) => a.geo.boxes.get(id)!, cut: design.pieces.filter((p) => p.cuts?.length).map((p) => p.id) }
  }

  it('are cut in the board under the opening and the one over it, one per leaf, wall to wall, and twice as deep above', () => {
    const { cutsOf, box, cut } = grooved({ doors: 'sliding' })
    expect(cut).toEqual(['bottom', 'top'])
    const [under, over] = [cutsOf('bottom'), cutsOf('top')]
    expect([under.length, over.length]).toEqual([2, 2])
    for (const groove of [...under, ...over]) expect([groove.x0, groove.x1]).toEqual([box('side-left').x1, box('side-right').x0])
    const into = 18 * ASSUMPTIONS.sliding.engagement
    expect(box('bottom').y1 - under[0].y0).toBeCloseTo(into)
    expect(over[0].y1 - box('top').y0).toBeCloseTo(2 * into)
    const leaf = box('c1-h1-door-left')
    expect(under.some((groove) => groove.z0 < leaf.z0 && groove.z1 > leaf.z1 && groove.z1 - groove.z0 < leaf.z1 - leaf.z0 + 3)).toBe(true)
  })

  it('are only where leaves slide: none in a furniture of hinged doors, and they come with the cell that chose to slide', () => {
    expect(grooved({ doors: 'inset', pulls: 'none' }).cut).toEqual([])
    expect(grooved({ doors: 'inset', pulls: 'none' }, { doors: 'sliding' }).cut).toEqual(['bottom', 'top'])
  })
})

describe('a kitchen kick', () => {
  const boxes = (p: Partial<CabinetPlan>) => {
    const a = analyze(buildCabinet(plan({ dimensions: { width: 600, height: 870, depth: 580 }, columns: [{ width: 1, cells: [cell('door', 1, { doors: 2, shelves: 1 })] }], ...p }), testCatalog).design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    return (id: string) => a.geo.boxes.get(id)!
  }

  it('stands 100 mm high and 50 behind the doors, and the floor of the box sits on it', () => {
    const box = boxes({ kick: 'kitchen' })
    expect([box('kick').y1, box('bottom').y0]).toEqual([100, 100])
    expect(box('c1-h1-door-left').z0 - box('kick').z1).toBe(50)
  })

  it('is asked for: a plan that does not say it, or says it on another base, builds as before', () => {
    const low = boxes({})
    expect([low('kick').y1, low('c1-h1-door-left').z0 - low('kick').z1]).toEqual([70, 30])
    const onFloor = boxes({ base: 'floor', kick: 'kitchen' })
    expect([onFloor('kick'), onFloor('bottom').y0]).toEqual([undefined, 0])
  })
})

describe('on legs', () => {
  const built = (p: CabinetPlan) => {
    const { design } = buildCabinet(p, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    return { design, a, box: (id: string) => a.geo.boxes.get(id)! }
  }

  it('raises the box on a laminated leg at each corner, under aprons with pocket screws, and the bottom screwed down onto them', () => {
    const { design, box } = built({ ...PLANS.nightstand, base: 'legs' })
    const legs = design.pieces.filter((p) => p.id.startsWith('leg-'))
    expect(legs.map((p) => p.id).sort()).toEqual(['back-left', 'back-right', 'front-left', 'front-right'].flatMap((c) => [`leg-${c}-1`, `leg-${c}-2`]).sort())
    expect(box('bottom').y0).toBe(LEG_HEIGHT)
    expect(box('side-left').y0).toBe(LEG_HEIGHT)
    // Two layers of the carcass board, glued face to face: 36 × 72.
    const [a, b] = [box('leg-front-left-1'), box('leg-front-left-2')]
    expect([a.x0, b.x1 - a.x0, a.z1 - a.z0, a.y0, a.y1]).toEqual([30, 36, 72, 0, LEG_HEIGHT])
    expect(design.joints.find((u) => u.a === 'leg-front-left-1' && u.b === 'leg-front-left-2')).toMatchObject({ glue: true })
    expect(design.joints.filter((u) => u.type === 'pocket-screw' && u.a.startsWith('apron-'))).toHaveLength(8)
    expect(design.joints.filter((u) => u.a === 'bottom' && /^(leg|apron)-/.test(u.b)).length).toBeGreaterThanOrEqual(12)
  })

  it('a wide box gets legs in between, under a divider when that keeps every gap within the reference, and rails so the bottom never spans too much', () => {
    const { design, box } = built(PLANS.sideboard)
    const middle = design.pieces.filter((p) => p.id.startsWith('leg-middle-')).map((p) => p.id)
    expect(middle.sort()).toEqual(['leg-middle-1-back-1', 'leg-middle-1-back-2', 'leg-middle-1-front-1', 'leg-middle-1-front-2'])
    const divider = box('div-2')
    expect((box('leg-middle-1-front-1').x0 + box('leg-middle-1-front-2').x1) / 2).toBe((divider.x0 + divider.x1) / 2)
    expect(design.pieces.filter((p) => p.id.startsWith('leg-rail-'))).toHaveLength(2)
    // Too far from any divider: evenly between the corners.
    const long = built(plan({ dimensions: { width: 2400, height: 800, depth: 400 }, base: 'legs', columns: [{ width: 1, cells: [cell('open', 1, { shelves: 1 })] }, { width: 1, cells: [cell('open', 1, { shelves: 1 })] }, { width: 1, cells: [cell('open', 1, { shelves: 1 })] }] }))
    expect((long.box('leg-middle-1-front-1').x0 + long.box('leg-middle-1-front-2').x1) / 2).toBe(1200)
    expect(built({ ...PLANS.nightstand, base: 'legs' }).design.pieces.some((p) => p.id.startsWith('leg-middle-'))).toBe(false)
  })

  it('a plan saved before there were legs still reads, and one with legs too: a new value needs no migration', () => {
    expect(CabinetPlan.parse(PLANS.bookcase).base).toBe('kick')
    expect(CabinetPlan.parse(PLANS.sideboard).base).toBe('legs')
  })
})

describe('overlay drawer fronts on a box that sits on the floor', () => {
  it('stop short of the ground, so the lowest drawer does not drag', () => {
    const { design } = buildCabinet({ ...PLANS.drawerChest, base: 'floor', construction: { ...DEFAULT_CONSTRUCTION, drawerFronts: 'overlay' } }, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    expect(a.findings.map((f) => f.check)).not.toContain('drawer.floor')
    expect(a.geo.boxes.get('drawer-1-front')!.y0).toBe(ASSUMPTIONS.drawers.floorClearance)
  })
})

describe('in 12 mm board', () => {
  const screws = (p: CabinetPlan) => {
    const { design } = buildCabinet(p, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    return { front: design.joints.find((j) => j.id === 'j-drawer-1-subfront-front')!.hardware.map((h) => h.hardwareId), layers: design.joints.filter((j) => j.a === 'leg-front-left-1' && j.b === 'leg-front-left-2').flatMap((j) => j.hardware.map((h) => h.hardwareId)), checks: a.findings.map((f) => f.check) }
  }

  it('the drawer fronts and the leg layers take the screw that does not come out the other side, and thicker board keeps its own', () => {
    const thin = screws({ ...PLANS.drawerChest, base: 'legs', material: 'T12' })
    expect(thin).toMatchObject({ front: ['screw-8x3/4'], layers: ['screw-8x3/4'] })
    expect(thin.checks).not.toContain('screw.pokes-through')
    expect(screws({ ...PLANS.drawerChest, base: 'legs' })).toMatchObject({ front: ['screw-8x1'], layers: ['screw-8x1-1/4'] })
  })
})

describe('leg height', () => {
  const onLegs = (legHeight: number | undefined, extra: Partial<CabinetPlan> = {}) => ({ ...PLANS.sideboard, ...(legHeight === undefined ? {} : { legHeight }), ...extra })
  const { legHeight: _omitted, ...saved } = PLANS.sideboard
  const analyzed = (p: CabinetPlan) => {
    const { design } = buildCabinet(p, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    return { design, a }
  }

  it.each([[99, false], [100, true], [150, true], [300, true], [301, false]])('takes %i mm of legs: %s', (legHeight, ok) => {
    expect(CabinetPlan.safeParse({ ...PLANS.sideboard, legHeight }).success).toBe(ok)
  })

  it('rejects legs that leave the box under the least, with a no cupo message, and only on legs', () => {
    const tooLow = FurniturePlan.safeParse(onLegs(300, { dimensions: { width: 1600, height: 300 + MIN_CARCASS_HEIGHT - 1, depth: 400 } }))
    expect(tooLow.success).toBe(false)
    expect(tooLow.error?.issues[0]).toMatchObject({ path: ['legHeight'], message: expect.stringMatching(/^No cupo/) })
    expect(FurniturePlan.safeParse(onLegs(300, { dimensions: { width: 1600, height: 300 + MIN_CARCASS_HEIGHT, depth: 400 } })).success).toBe(true)
    expect(FurniturePlan.safeParse({ ...PLANS.nightstand, legHeight: 300 }).success).toBe(true)
  })

  it('rejects legs on a box too shallow for a front and a back leg, a board deeper with overlay fronts, and builds the shallowest it takes', () => {
    const overlay = { ...DEFAULT_CONSTRUCTION, drawerFronts: 'overlay' as const }
    const shallow = (depth: number, extra: Partial<CabinetPlan> = {}): CabinetPlan => ({ ...PLANS.nightstand, base: 'legs', dimensions: { ...PLANS.nightstand.dimensions, depth }, ...extra })
    for (const p of [shallow(204), shallow(222, { construction: overlay })]) expect(FurniturePlan.safeParse(p).error?.issues[0]).toMatchObject({ path: ['dimensions', 'depth'], message: expect.stringMatching(/^No cupo/) })
    for (const p of [shallow(205), shallow(223, { construction: overlay })]) {
      expect(FurniturePlan.safeParse(p).success).toBe(true)
      analyzed(p)
    }
    expect(FurniturePlan.safeParse(shallow(204, { base: 'kick' })).success).toBe(true)
  })

  it('a plan saved without it gets 150 and builds exactly as one that says so', () => {
    const old = CabinetPlan.parse(saved)
    expect(old.legHeight).toBe(LEG_HEIGHT)
    expect(buildCabinet(old, testCatalog)).toEqual(buildCabinet(PLANS.sideboard, testCatalog))
    expect(FurniturePlan.parse(saved)).toEqual({ ...saved, legHeight: LEG_HEIGHT })
  })

  it.each([LEG_HEIGHT_RANGE.min, 220, LEG_HEIGHT_RANGE.max])('moves the floor and not the ceiling with %i mm legs', (legHeight) => {
    const { design, a } = analyzed(onLegs(legHeight))
    const box = (id: string) => a.geo.boxes.get(id)!
    expect(box('bottom').y0).toBe(legHeight)
    expect(box('leg-front-left-1').y1).toBe(legHeight)
    expect(box('apron-front').y1).toBe(legHeight)
    expect(box('side-left').y1).toBe(design.dimensions.height)
    expect(design.dimensions.height).toBe(PLANS.sideboard.dimensions.height)
  })

  it('the cut list follows the height: the legs are cut at it and the sides at what is left', () => {
    const lines = (legHeight: number) => {
      const { design, a } = analyzed(onLegs(legHeight))
      const list = cutList(design, a.geo)
      return { leg: list.find((l) => l.ids.includes('leg-front-left-1'))!, side: list.find((l) => l.ids.includes('side-left'))! }
    }
    const [low, high] = [lines(100), lines(300)]
    expect([low.leg.length, high.leg.length]).toEqual([100, 300])
    expect([low.side.length, high.side.length]).toEqual([PLANS.sideboard.dimensions.height - 100, PLANS.sideboard.dimensions.height - 300])
  })

  it('does not change what the tipping rule sees: the total height and the depth between the legs stay', () => {
    const codes = (legHeight: number) => analyzed({ ...onLegs(legHeight), wallMounted: false }).a.findings.map((f) => f.code).sort()
    expect(codes(LEG_HEIGHT_RANGE.max)).toEqual(codes(LEG_HEIGHT_RANGE.min))
  })

  it('tapered legs are the same boards, joints and purchase as straight ones: only their inner side is cut, from under the apron to the foot', () => {
    const straight = analyzed({ ...PLANS.sideboard, legStyle: 'straight' })
    const tapered = buildCabinet({ ...PLANS.sideboard, legStyle: 'tapered' }, testCatalog)
    const { design, a } = analyzed({ ...PLANS.sideboard, legStyle: 'tapered' })
    expect(design.pieces.map((p) => ({ ...p, slants: undefined }))).toEqual(straight.design.pieces)
    expect(design.joints).toEqual(straight.design.joints)
    expect(cutList(design, a.geo)).toEqual(cutList(straight.design, straight.a.geo))
    expect(a.findings.map((f) => f.code)).toEqual(straight.a.findings.map((f) => f.code))
    const slanted = design.pieces.filter((p) => p.slants?.length)
    expect(slanted.every((p) => p.id.startsWith('leg-'))).toBe(true)
    // The front legs are cut on the side that looks back, the back ones on the side that looks forward; the apron keeps its 80 mm of square face.
    expect(design.pieces.find((p) => p.id === 'leg-front-left-1')!.slants).toEqual([{ x: null, y: { from: 'start', leave: 80 }, z: { from: 'start', length: 36 } }])
    expect(design.pieces.find((p) => p.id === 'leg-back-right-2')!.slants).toEqual([{ x: null, y: { from: 'start', leave: 80 }, z: { from: 'end', length: 36 } }])
    expect(tapered.notes.filter((n) => n.startsWith('Patas cónicas'))).toHaveLength(1)
    expect(buildCabinet(PLANS.sideboard, testCatalog).notes.some((n) => n.includes('cónicas'))).toBe(false)
  })

  it('splayed legs lean out from where a straight leg stands: the same top, a foot 20 mm further out, cut from a board that much wider', () => {
    const [straight, splayed] = [analyzed({ ...PLANS.sideboard, legStyle: 'straight' }), analyzed({ ...PLANS.sideboard, legStyle: 'splayed' })]
    const box = (built: typeof splayed, id: string) => built.a.geo.boxes.get(id)!
    expect([box(splayed, 'leg-front-left-1').z0, box(splayed, 'leg-front-left-1').z1]).toEqual([box(straight, 'leg-front-left-1').z0, box(straight, 'leg-front-left-1').z1 + 20])
    expect([box(splayed, 'leg-back-left-1').z0, box(splayed, 'leg-back-left-1').z1]).toEqual([box(straight, 'leg-back-left-1').z0 - 20, box(straight, 'leg-back-left-1').z1])
    // Outside, from the top down to the foot; inside, from under the apron to a 36 mm foot.
    expect(splayed.design.pieces.find((p) => p.id === 'leg-front-left-1')!.slants).toEqual([
      { x: null, y: { from: 'end', leave: 0 }, z: { from: 'end', length: 20 } },
      { x: null, y: { from: 'start', leave: 80 }, z: { from: 'start', length: 72 + 20 - 36 } },
    ])
    expect(splayed.design.pieces.find((p) => p.id === 'leg-back-right-2')!.slants!.map((x) => x.z!.from)).toEqual(['start', 'end'])
    const legless = (built: typeof splayed) => built.design.pieces.filter((p) => !/^leg-(front|back)-/.test(p.id))
    expect(legless(splayed).map((p) => ({ ...p, slants: undefined }))).toEqual(legless(straight))
    expect(splayed.design.joints).toEqual(straight.design.joints)
    expect(splayed.a.findings.map((f) => f.code)).toEqual(straight.a.findings.map((f) => f.code))
    expect(estimatePurchase(splayed.design, splayed.a.geo, testCatalog).hardware).toEqual(estimatePurchase(straight.design, straight.a.geo, testCatalog).hardware)
  })

  it('only the corner legs lean: a leg in between stands behind the apron and narrows instead, and the note says each', () => {
    const wide = plan({ dimensions: { width: 2400, height: 800, depth: 450 }, base: 'legs', legStyle: 'splayed', columns: [{ width: 1, cells: [cell('open', 1, { shelves: 1 })] }, { width: 1, cells: [cell('open', 1, { shelves: 1 })] }] })
    const { design } = analyzed(wide)
    const cuts = (id: string) => design.pieces.find((p) => p.id === id)!.slants!.length
    expect([cuts('leg-front-left-1'), cuts('leg-middle-1-front-1')]).toEqual([2, 1])
    const notes = buildCabinet(wide, testCatalog).notes
    expect(notes.map((n) => n.split(':')[0])).toEqual(['Patas abiertas en 4 patas', 'Patas cónicas en 2 patas'])
    expect(notes[0]).toContain('cada una sale de una tabla de 92 mm de ancho')
  })

  it('stands deeper on splayed legs: the tipping rule sees the feet where they are', () => {
    const tall = (legStyle: CabinetPlan['legStyle']) => analyzed(plan({ dimensions: { width: 800, height: 1000, depth: 300 }, base: 'legs', legStyle, wallMounted: false, columns: [{ width: 1, cells: [cell('open', 1, { shelves: 2 })] }] })).a.findings.find((f) => f.code === 'R4_TIPPING')!.data as { depth: number }
    expect(tall('splayed').depth - tall('straight').depth).toBe(40)
  })

  it('a leg that fills the gap between the aprons stays straight: it has no inner side', () => {
    const shallow = analyzed(plan({ dimensions: { width: 2400, height: 800, depth: 230 }, base: 'legs', legStyle: 'tapered', wallMounted: false, columns: [{ width: 1, cells: [cell('open', 1, { shelves: 1 })] }, { width: 1, cells: [cell('open', 1, { shelves: 1 })] }] }))
    const middle = shallow.design.pieces.filter((p) => p.id.startsWith('leg-middle-'))
    expect(middle.length).toBeGreaterThan(0)
    expect(middle.some((p) => p.slants)).toBe(false)
    expect(shallow.design.pieces.filter((p) => p.slants?.length).length).toBe(8)
  })

  it('the shape of the legs is on the form only with legs, and a plan saved without it reads as straight', () => {
    const field = cabinetModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).find((f) => 'key' in f && f.key === 'legStyle')!
    expect(isVisible(field, PLANS.sideboard)).toBe(true)
    expect(isVisible(field, PLANS.bookcase)).toBe(false)
    expect(CabinetPlan.parse(PLANS.sideboard).legStyle).toBeUndefined()
    expect(buildCabinet(PLANS.sideboard, testCatalog).design.pieces.some((p) => p.slants)).toBe(false)
  })

  it('is on the form only with legs, and every bench variant of the module holds', () => {
    const field = cabinetModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).flatMap((f) => (f.type === 'numbers' ? f.fields : [])).find((f) => f.key === 'legHeight')!
    expect(field).toMatchObject({ min: 100, max: 300 })
    expect(cabinetModule.benchVariants().map(([name, p]) => [name, p.legHeight])).toEqual(expect.arrayContaining([['aparador con patas de 100 mm', 100], ['aparador con patas de 300 mm', 300]]))
  })
})

describe('construction variants', () => {
  const options: { [K in keyof CabinetConstruction]: CabinetConstruction[K][] } = {
    doors: ['overlay', 'inset', 'sliding'],
    drawerFronts: ['inset', 'overlay'],
    top: ['between', 'over', 'fingers'],
    back: ['nailed', 'none'],
    shelves: ['movable', 'fixed'],
    fronts: ['flat', 'grooved'],
    hinges: ['outside', 'inside'],
    pulls: ['none', 'notch', 'handle'],
    drawerCorners: ['screwed', 'fingers'],
  }
  const combos = Object.entries(options).reduce<CabinetConstruction[]>(
    (all, [key, values]) => all.flatMap((c) => values.map((v) => ({ ...c, [key]: v }))),
    [DEFAULT_CONSTRUCTION],
  )
  // Every kind of cell in one cabinet, so each variant meets every other.
  const mixed = plan({
    name: 'Gabinete',
    dimensions: { width: 900, height: 900, depth: 450 },
    wallMounted: false,
    columns: [
      { width: 0.5, cells: [cell('drawer', 0.3), cell('door', 0.7, { doors: 1, shelves: 1 })] },
      { width: 0.5, cells: [cell('closed', 0.3), cell('open', 0.4, { shelves: 1 }), cell('door', 0.3, { doors: 2 })] },
    ],
  })

  const bases: CabinetPlan['base'][] = ['kick', 'legs']
  it.each(combos.flatMap((c) => bases.map((base) => [`${Object.values(c).join(' · ')} · ${base}`, c, base] as const)))('%s is valid, with nothing overlapping and every contact joined', (_, construction, base) => {
    const { design, notes } = buildCabinet({ ...mixed, construction, base }, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    expect(a.warnings.filter((w) => w.code === 'W_CONTACT_WITHOUT_JOINT')).toEqual([])
    expect(notes.filter((n) => !n.startsWith('Muesca') && !n.startsWith('Esquinas de dedos') && !n.startsWith('Cubierta con dedos') && !n.includes('corrediza'))).toEqual([])
  })

  it('inset doors sit inside their opening and hang on declared hinges', () => {
    const { design } = buildCabinet({ ...PLANS.wallCabinet, construction: { ...DEFAULT_CONSTRUCTION, doors: 'inset' } }, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors[0].message)
    const door = a.geo.boxes.get('c1-h1-door-left')!
    expect(door.x0).toBe(a.geo.boxes.get('side-left')!.x1 + 2)
    expect(door.z1).toBe(320)
    expect(design.joints.filter((u) => u.type === 'cup-hinge').map((u) => u.hardware[0].hardwareId)).toEqual(['cup-hinge-35-inset', 'cup-hinge-35-inset'])
  })

  it('an overlay door takes the hinge for what it covers: straight on an outer side, cranked on a divider it shares', () => {
    const hinges = (p: CabinetPlan, side: CabinetConstruction['hinges'] = 'outside') =>
      Object.fromEntries(buildCabinet({ ...p, construction: { ...p.construction, hinges: side } }, testCatalog).design.joints.filter((u) => u.type === 'cup-hinge').map((u) => [u.a, `${u.b} ${u.hardware[0]?.hardwareId}`]))
    expect(hinges(PLANS.wallCabinet)).toEqual({ 'c1-h1-door-left': 'side-left cup-hinge-35-full', 'c1-h1-door-right': 'side-right cup-hinge-35-full' })
    const twoColumns = plan({ name: 'Alacena doble', dimensions: { width: 1000, height: 720, depth: 320 }, base: 'floor', columns: [{ width: 1, cells: [cell('door', 1, { doors: 1 })] }, { width: 1, cells: [cell('door', 1, { doors: 1 })] }] })
    expect(hinges(twoColumns, 'inside')).toEqual({ 'c1-h1-door': 'div-1 cup-hinge-35-half', 'c2-h1-door': 'div-1 cup-hinge-35-half' })
  })

  it('the hinges are on the outer edges or the inner ones, as the plan says, and the doors of two leaves do not change', () => {
    const twoColumns = plan({ name: 'Alacena doble', dimensions: { width: 1000, height: 720, depth: 320 }, base: 'floor', columns: [{ width: 1, cells: [cell('door', 1, { doors: 1 })] }, { width: 1, cells: [cell('door', 1, { doors: 1 })] }] })
    const hung = (p: CabinetPlan, hinges: CabinetConstruction['hinges']) =>
      Object.fromEntries(buildCabinet({ ...p, construction: { ...p.construction, hinges } }, testCatalog).design.joints.filter((u) => u.type === 'cup-hinge').map((u) => [u.a, u.b]))
    expect(hung(twoColumns, 'outside')).toEqual({ 'c1-h1-door': 'side-left', 'c2-h1-door': 'side-right' })
    expect(hung(twoColumns, 'inside')).toEqual({ 'c1-h1-door': 'div-1', 'c2-h1-door': 'div-1' })
    expect(hung(PLANS.wallCabinet, 'outside')).toEqual(hung(PLANS.wallCabinet, 'inside'))
    const inset = { ...twoColumns, construction: { ...twoColumns.construction, doors: 'inset' as const } }
    expect(hung(inset, 'outside')).toEqual({ 'c1-h1-door': 'side-left', 'c2-h1-door': 'side-right' })
    expect(hung(inset, 'inside')).toEqual({ 'c1-h1-door': 'div-1', 'c2-h1-door': 'div-1' })
  })

  it('overlay drawer fronts cover the carcass edge; inset ones sit flush inside', () => {
    const front = (drawerFronts: CabinetConstruction['drawerFronts']) => {
      const a = analyze(buildCabinet({ ...PLANS.drawerChest, construction: { ...DEFAULT_CONSTRUCTION, drawerFronts } }, testCatalog).design, testCatalog)
      if (!a.valid) throw new Error(a.errors[0].message)
      return a.geo.boxes.get('drawer-1-front')!
    }
    expect(front('overlay').x0).toBe(2)
    expect(front('inset').x0).toBeGreaterThan(18)
  })
})

describe('sliding doors', () => {
  const sliding: CabinetConstruction = { ...DEFAULT_CONSTRUCTION, doors: 'sliding', top: 'over' }
  const open = (shelves = 0): PlanCell => ({ height: 1, content: 'open', shelves, doors: null })
  const rack = (doors: number, extra: Partial<PlanCell> = {}, more: Partial<CabinetPlan> = {}) =>
    plan({ name: 'Rack', dimensions: { width: 1200, height: 600, depth: 400 }, base: 'floor', wallMounted: false, construction: sliding, columns: [{ width: 1, cells: [{ height: 1, content: 'door', shelves: 0, doors, ...extra }] }], ...more })
  const built = (p: CabinetPlan) => {
    const { design, notes } = buildCabinet(p, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    return { design, notes, a, box: (id: string) => a.geo.boxes.get(id)!, has: (id: string) => design.pieces.some((x) => x.id === id) }
  }

  it('two leaves hang from no hinge: each runs unglued in a groove of the bottom and one of the top, a quarter of the board deep', () => {
    const { design, a } = built(rack(2))
    expect(design.joints.filter((u) => u.type === 'cup-hinge')).toEqual([])
    expect(design.joints.filter((u) => u.a.includes('door')).map((u) => `${u.a} ${u.b} ${u.type} ${u.depth} ${u.glue}`)).toEqual([
      'c1-h1-door-left bottom dado 4.5 false',
      'c1-h1-door-left top dado 4.5 false',
      'c1-h1-door-right bottom dado 4.5 false',
      'c1-h1-door-right top dado 4.5 false',
    ])
    expect(Object.keys(estimatePurchase(design, a.geo, testCatalog).hardware.reduce((all, h) => ({ ...all, [h.hardware.role]: true }), {}))).not.toContain('hinge')
  })

  it('they overlap where they meet by the 25 mm less what keeps both leaves whole, the left one behind the right one, both set back from the front edge', () => {
    const { box } = built(rack(2))
    const [left, right] = [box('c1-h1-door-left'), box('c1-h1-door-right')]
    expect([left.x0, right.x1]).toEqual([box('side-left').x1, box('side-right').x0])
    expect([left.x1 - left.x0, right.x1 - right.x0]).toEqual([594, 594])
    expect(left.x1 - right.x0).toBe(24)
    expect(right.z1).toBe(400 - 10)
    expect(left.z1).toBe(right.z0 - 3)
    expect([left.y0, left.y1]).toEqual([box('bottom').y1 - 4.5, box('top').y0 + 4.5])
  })

  it('one leaf covers half of its opening and a little more, on the side the hinges would be', () => {
    const half = (hinges: CabinetConstruction['hinges']) => built(rack(1, {}, { construction: { ...sliding, hinges }, columns: [{ width: 1, cells: [{ height: 1, content: 'door', shelves: 0, doors: 1 }] }, { width: 1, cells: [open()] }] })).box('c1-h1-door')
    const outside = half('outside')
    expect(outside.x0).toBe(18)
    expect(outside.x1 - outside.x0).toBeCloseTo((1200 - 3 * 18) / 2 / 2 + 12.5)
    expect(half('inside').x1).toBeCloseTo(18 + (1200 - 3 * 18) / 2)
  })

  it('a shelf behind them stops short of the tracks, further in with two leaves than with one', () => {
    const shelf = (doors: number) => built(rack(doors, { shelves: 1 })).box('c1-h1-shelf-1').z1
    expect(shelf(1)).toBe(400 - 10 - 18 - 5)
    expect(shelf(2)).toBe(400 - 10 - 18 - 3 - 18 - 5)
  })

  it('run in front of a cell split into columns: its divider and shelves stay behind the tracks, and the doors close the whole cell', () => {
    const { box, has, design } = built(rack(1, { shelves: null, columns: [{ width: 1, cells: [open()] }, { width: 1, cells: [open(1)] }] }))
    expect(design.pieces.filter((x) => x.role === 'door').map((x) => x.id)).toEqual(['c1-h1-door'])
    const behind = 400 - 10 - 18 - 3
    expect([box('c1-h1-div-1').z1, box('c1-h1-c2-h1-shelf-1').z1]).toEqual([behind, behind])
    expect(box('c1-h1-door').x1).toBeGreaterThan(box('c1-h1-div-1').x1)
    expect(has('c1-h1-c1-h1-door')).toBe(false)
  })

  it('doors in front of a split cell count as the doors of the furniture: built as asked, and summed up as one sliding door', () => {
    const inFront = rack(1, { shelves: null, columns: [{ width: 1, cells: [open()] }, { width: 1, cells: [open(1)] }] })
    expect(cabinetModule.builtAsAsked!(inFront, buildCabinet(inFront, testCatalog).design)).toBeNull()
    expect(cabinetModule.parts.list.find((x) => x.id === 'doors')!.summary(inFront, 'Barniz')).toBe('1 puerta corrediza')
    expect(quickCounts(inFront)).toEqual({ drawer: 0, door: 1, open: 2 })
    expect(countLimits(inFront, testCatalog).door).toEqual({ min: 1, max: 1 })
  })

  it('sliding doors over sliding doors are rejected: their grooves would meet in the board between them; side by side, or with an open cell between, they are not', () => {
    const variant = cabinetModule.benchVariants().find(([name]) => name === 'aparador con dos corredizas')![1]
    const [slid] = variant.columns[0].cells
    const stacked = (cells: (typeof slid)[]) => FurniturePlan.safeParse({ ...variant, dimensions: { ...variant.dimensions, height: 1300 }, columns: [{ width: 1, cells }] })
    expect(stacked([slid, slid]).error?.issues.map((i) => i.message)).toEqual([expect.stringMatching(/^Dos huecos con puertas corredizas no van uno sobre otro/)])
    expect(stacked([slid, { ...slid, content: 'open', doors: null }, slid]).success).toBe(true)
    expect(FurniturePlan.safeParse({ ...variant, columns: [variant.columns[0], variant.columns[0]] }).success).toBe(true)
  })

  it('behind them there are only open cells: a drawer there is rejected, and built it is a split cell with no doors', () => {
    const withDrawer = rack(2, { shelves: null, columns: [{ width: 1, cells: [open()] }, { width: 1, cells: [{ height: 1, content: 'drawer', shelves: null, doors: null }] }] })
    expect(FurniturePlan.safeParse(withDrawer).error?.issues.map((i) => i.message)).toEqual(['Detrás de unas puertas corredizas solo van huecos abiertos, con sus repisas: ni cajones ni más puertas.'])
    expect(built(withDrawer).design.pieces.filter((x) => x.role === 'door')).toEqual([])
    expect(FurniturePlan.safeParse({ ...withDrawer, construction: DEFAULT_CONSTRUCTION }).success).toBe(true)
  })

  it('a leaf wider than a hinged one may be is not a finding, and says how its grooves are cut', () => {
    const { a, notes, box } = built(rack(2, {}, { dimensions: { width: 1400, height: 600, depth: 400 } }))
    expect(box('c1-h1-door-left').x1 - box('c1-h1-door-left').x0).toBeGreaterThan(600)
    expect(a.findings.filter((f) => f.code === 'R6_DOORS')).toEqual([])
    expect(notes).toEqual(['2 puertas corredizas sin bisagras: cada hoja corre en una ranura del tablero de abajo, de 4.5 mm de hondo, y otra del de arriba, de 9 mm, para meterla y sacarla levantándola. Las ranuras se fresan con router antes de armar, un poco más anchas que la hoja.'])
  })

  it('does not pull the furniture forward as hinged doors do: tall and shallow, it is judged by its ratio like an open bookcase, not by its doors open', () => {
    const tall = (doors: CabinetConstruction['doors']) => built(rack(2, {}, { dimensions: { width: 1100, height: 1500, depth: 300 }, construction: { ...sliding, doors } })).a.findings.filter((f) => f.code === 'R4_TIPPING').map((f) => f.check ?? 'ratio')
    expect(tall('sliding')).toEqual(['ratio'])
    expect(tall('inset')).toEqual(['tipping.storage'])
  })

  it('the notch to open each leaf is on its outer edge, where the other leaf never covers it', () => {
    const { design } = built(rack(2, {}, { construction: { ...sliding, pulls: 'notch' } }))
    const notchAt = (id: string) => design.pieces.find((x) => x.id === id)!.cuts![0].x.from
    expect([notchAt('c1-h1-door-left'), notchAt('c1-h1-door-right')]).toEqual(['start', 'end'])
  })

  it('the form does not ask which side the hinges go on: there are none', () => {
    const hinges = cabinetModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).find((f) => f.type === 'choice' && f.key === 'construction.hinges')!
    expect([isVisible(hinges, rack(1)), isVisible(hinges, { ...rack(1), construction: DEFAULT_CONSTRUCTION })]).toEqual([false, true])
  })

  it('a plan saved before they existed reads the same', () => {
    expect(FurniturePlan.parse(PLANS.wallCabinet)).toEqual(PLANS.wallCabinet)
  })
})

describe('a chest opened from above', () => {
  const chest = (shelves = 1): PlanCell => ({ height: 0.5, content: 'chest', shelves, doors: null })
  const niche = (shelves = 0): PlanCell => ({ height: 0.5, content: 'open', shelves, doors: null })
  const headboard = (more: Partial<CabinetPlan> = {}, cells: PlanCell[] = [chest(), niche()]) =>
    plan({ name: 'Librero de cabecera', dimensions: { width: 650, height: 1000, depth: 300 }, base: 'floor', construction: { ...DEFAULT_CONSTRUCTION, top: 'over' }, columns: [{ width: 1, cells }], ...more })
  const built = (p: CabinetPlan) => {
    const { design, notes } = buildCabinet(p, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    return { design, notes, a, box: (id: string) => a.geo.boxes.get(id)!, has: (id: string) => design.pieces.some((x) => x.id === id) }
  }

  it('its lid is the floor of the open cell over it: level with the strip that stays fixed at the back, between the walls, and out to the face of the front it rests on', () => {
    const { box, design } = built(headboard())
    const [lid, strip, front, left, right] = ['c1-h1-lid', 'c1-sep-1', 'c1-h1-cover', 'side-left', 'side-right'].map(box)
    expect([lid.y0, lid.y1]).toEqual([strip.y0, strip.y1])
    expect([strip.z1 - strip.z0, lid.z0]).toEqual([80, strip.z1])
    expect([lid.z1, front.z1, front.y1]).toEqual([300, 300, lid.y0])
    expect([lid.x0 - left.x1, right.x0 - lid.x1]).toEqual([2, 2])
    expect(design.pieces.find((p) => p.id === 'c1-h1-lid')).toMatchObject({ role: 'door', normal: 'y', name: 'Tapa abatible (hueco 1)' })
  })

  it('hinges on the strip with a piano hinge and is held open by a stay: one of each to buy, and no cup hinges', () => {
    const { design, a, notes } = built(headboard())
    expect(design.joints.filter((u) => u.a === 'c1-h1-lid').map((u) => [u.b, u.type, u.glue, u.hardware])).toEqual([['c1-sep-1', 'lid-hinge', false, [{ hardwareId: 'piano-hinge-30', count: 1 }, { hardwareId: 'lid-stay-friction', count: null }]]])
    const bought = Object.fromEntries(estimatePurchase(design, a.geo, testCatalog).hardware.map((h) => [h.hardware.role, h.count]))
    expect([bought['piano-hinge'], bought['lid-stay'], bought.hinge]).toEqual([1, 1, undefined])
    expect(notes).toEqual(['Tapa abatible hacia arriba: cada una va con bisagra de piano a la tira fija de atrás, no a la trasera, y un compás de fricción atornillado al costado la detiene abierta (dos, uno por costado, en una tapa pesada). Antes de abrirla hay que quitar lo que tenga encima.'])
  })

  it('with shelves 1 its floor is fixed at mid-height and holds a light load; with 0 it reaches the bottom', () => {
    const raised = built(headboard())
    const floor = raised.box('c1-h1-floor')
    const [bottom, lid] = [raised.box('bottom'), raised.box('c1-h1-lid')]
    expect(Math.abs((floor.y0 + floor.y1) / 2 - (bottom.y1 + lid.y0) / 2)).toBeLessThanOrEqual(0.5)
    expect(raised.design.pieces.find((p) => p.id === 'c1-h1-floor')).toMatchObject({ support: 'fixed', load: 'light' })
    expect(built(headboard({}, [chest(0), niche()])).has('c1-h1-floor')).toBe(false)
  })

  it('an inset front stays inside the carcass, with the lid over its top edge and the raised floor behind it', () => {
    const { box } = built(headboard({ construction: { ...DEFAULT_CONSTRUCTION, doors: 'inset', top: 'over' } }))
    const [lid, front, floor, left] = ['c1-h1-lid', 'c1-h1-cover', 'c1-h1-floor', 'side-left'].map(box)
    expect([front.z1, lid.z1, front.y1]).toEqual([left.z1, left.z1, lid.y0])
    expect(floor.z1).toBe(front.z0)
  })

  it('raises no finding as built: the lid is neither a wide door nor one short of hinges, and it does not sag the cell', () => {
    expect(built(headboard()).a.findings).toEqual([])
  })

  it('does not pull the furniture forward as a hinged door does: it lifts over the carcass, so nothing of it counts against the balance', () => {
    const { design, a, box } = built(headboard({ wallMounted: false }))
    const pulls = (d: typeof design) => tippingBalance(d, a.geo, [box('bottom')])!.pulls
    expect(pulls(design)).toBe(0)
    expect(pulls({ ...design, joints: design.joints.filter((u) => u.type !== 'lid-hinge') })).toBeGreaterThan(0)
  })

  it('a shelf too close over the lid is said: the lid stops against it before it opens enough to reach in', () => {
    const tight = built(headboard({ construction: { ...DEFAULT_CONSTRUCTION, top: 'over', shelves: 'fixed' } }, [chest(), niche(3)]))
    const found = tight.a.findings.filter((f) => f.check === 'lid.room')
    expect(found.map((f) => [f.code, f.severity, f.pieces])).toEqual([['R6_DOORS', 'recommendation', ['c1-h1-lid', 'c1-h2-shelf-1']]])
    expect(found[0].data).toMatchObject({ reach: 214, min: 60 })
    expect(Number(found[0].data.opens)).toBeLessThan(60)
    expect(built(headboard({}, [chest(), niche(1)])).a.findings.filter((f) => f.check === 'lid.room')).toEqual([])
  })

  it('a lid with no stay is said: it would slam shut', () => {
    const { design } = built(headboard())
    const bare = { ...design, joints: design.joints.map((u) => (u.type === 'lid-hinge' ? { ...u, hardware: u.hardware.filter((h) => h.hardwareId !== 'lid-stay-friction') } : u)) }
    const a = analyze(bare, testCatalog)
    expect(a.valid && a.findings.map((f) => [f.check, f.severity, f.pieces])).toEqual([['lid.stay', 'recommendation', ['c1-h1-lid']]])
  })

  it('with notch pulls the lid is notched through its front edge, in the middle, and not on a side as a door is', () => {
    const { design } = built(headboard({ construction: { ...DEFAULT_CONSTRUCTION, top: 'over', pulls: 'notch' } }))
    const [cut] = design.pieces.find((p) => p.id === 'c1-h1-lid')!.cuts!
    expect([cut.x.from, cut.z.from, cut.y.length]).toEqual(['center', 'end', 20])
  })

  it('with nothing open over it there is nowhere for the lid to go: it is built covered, said, and the plan does not pass', () => {
    const under = headboard({}, [chest(), { height: 0.5, content: 'drawer', shelves: null, doors: null }])
    const { has, notes } = built(under)
    expect([has('c1-h1-lid'), has('c1-h1-cover'), has('c1-h1-floor')]).toEqual([false, true, false])
    expect(notes).toContain('Un baúl va debajo de un hueco abierto, por donde abre su tapa, o hasta arriba en todas las columnas, con la cubierta como tapa; si no, queda tapado.')
    expect(FurniturePlan.safeParse(under).error?.issues.map((i) => i.message)).toEqual(['Un baúl va debajo de un hueco abierto, por donde abre su tapa, o hasta arriba en todas las columnas, con la cubierta como tapa; si no, queda tapado.'])
    expect(FurniturePlan.safeParse(headboard()).success).toBe(true)
  })

  describe('at the top of every column', () => {
    const trunk = (more: Partial<CabinetPlan> = {}, columns: PlanColumn[] = [{ width: 1, cells: [{ ...chest(0), height: 1 }] }]) =>
      plan({ name: 'Baúl', dimensions: { width: 1200, height: 480, depth: 420 }, base: 'floor', wallMounted: false, construction: { ...DEFAULT_CONSTRUCTION, top: 'over' }, columns, ...more })

    it('the top of the furniture is the lid: only a strip of it stays fixed at the back, and the lid lies over the sides and out to the face of the front', () => {
      const { box, design, a } = built(trunk())
      const [strip, lid, front, left] = ['top', 'top-lid', 'c1-h1-cover', 'side-left'].map(box)
      expect([strip.z1 - strip.z0, lid.z0, lid.z1]).toEqual([80, strip.z1, 420])
      expect([lid.x0, lid.x1, lid.y0, lid.y1]).toEqual([0, 1200, strip.y0, 480])
      expect([left.y1, front.y1]).toEqual([lid.y0, lid.y0])
      expect(design.joints.filter((u) => u.a === 'top-lid').map((u) => [u.b, u.type])).toEqual([['top', 'lid-hinge']])
      expect(a.findings).toEqual([])
    })

    it('a top between the sides keeps the lid between them too', () => {
      const { box } = built(trunk({ construction: DEFAULT_CONSTRUCTION }))
      expect([box('top-lid').x0 - box('side-left').x1, box('side-right').x0 - box('top-lid').x1]).toEqual([2, 2])
    })

    it('two columns share one lid, which rests on the divider between them', () => {
      const { design, box } = built(trunk({}, [1, 1].map((width) => ({ width, cells: [{ ...chest(0), height: 1 }] }))))
      expect(design.pieces.filter((p) => p.role === 'door').map((p) => p.id)).toEqual(['top-lid'])
      expect(box('div-1').y1).toBe(box('top-lid').y0)
      expect(cabinetModule.builtAsAsked!(trunk({}, [1, 1].map((width) => ({ width, cells: [{ ...chest(0), height: 1 }] }))), design)).toBeNull()
    })

    it('takes as many stays as its weight asks for: two for a long lid, one for the lid of a niche', () => {
      const stays = (p: CabinetPlan) => {
        const { design, a } = built(p)
        return estimatePurchase(design, a.geo, testCatalog).hardware.find((h) => h.hardware.role === 'lid-stay')!.count
      }
      expect([stays(trunk()), stays(headboard())]).toEqual([2, 1])
    })

    it('a lid heavier than two stays hold is said', () => {
      const heavy = built(trunk({ dimensions: { width: 1500, height: 480, depth: 600 } })).a.findings
      expect(heavy.map((f) => [f.check, f.severity, f.pieces])).toEqual([['lid.weight', 'recommendation', ['top-lid']]])
      expect(Number(heavy[0].data.torque)).toBeGreaterThan(6)
    })

    it('only when every column ends in a chest, and not with fingers at the corners, which would hold it shut: otherwise it is built covered and said', () => {
      const mixed = trunk({}, [{ width: 1, cells: [{ ...chest(0), height: 1 }] }, { width: 1, cells: [{ ...niche(), height: 1 }] }])
      const fingered = trunk({ construction: { ...DEFAULT_CONSTRUCTION, top: 'fingers' } })
      for (const p of [mixed, fingered]) {
        expect(built(p).has('top-lid')).toBe(false)
        expect(built(p).design.pieces.find((x) => x.id === 'top')!.name).not.toBe('Tira fija de la tapa')
        expect(FurniturePlan.safeParse(p).success).toBe(false)
      }
      expect(FurniturePlan.safeParse(trunk()).success).toBe(true)
      expect(FurniturePlan.safeParse(fingered).error?.issues[0]).toMatchObject({ path: ['construction', 'top'], message: expect.stringContaining('dedos') })
      expect(FurniturePlan.safeParse(mixed).error?.issues[0]).toMatchObject({ path: ['columns'] })
    })
  })

  it('is not a door of the furniture: the quick counts and the summary leave it out, and adding a cell never splits it', () => {
    const p = headboard()
    const { design } = built(p)
    expect(cabinetModule.builtAsAsked!(p, design)).toBeNull()
    expect(cabinetModule.parts.list.find((x) => x.id === 'doors')!.summary(p, 'Barniz')).toBe('Sin puertas: agrégalas en los huecos')
    expect(leafCells(setCount(p, 'open', 2, testCatalog).plan.columns).map((c) => c.content)).toEqual(['chest', 'open', 'open'])
    const alone = setCount(p, 'open', 0, testCatalog)
    expect([alone.ok, leafCells(alone.plan.columns).map((c) => c.content), built(alone.plan).has('top-lid')]).toEqual([true, ['chest'], true])
    const beside = { ...p, columns: [...p.columns, { width: 1, cells: [niche(), niche()] }] }
    expect(leafCells(setCount(beside, 'open', 2, testCatalog).plan.columns).map((c) => c.content)).toEqual(['chest', 'open', 'open'])
    const twice = { ...p, columns: [...p.columns, ...p.columns] }
    expect(setCount(twice, 'open', 1, testCatalog)).toMatchObject({ ok: false, message: 'Un baúl se quedó sin el hueco abierto de encima, por donde abre su tapa.' })
  })

  it('the expert does not write it: its columns only know open, drawer, door and closed', () => {
    expect(ExpertColumns.safeParse(headboard().columns).success).toBe(false)
  })

  it('reads in words as a chest under a lid, with its floor raised', () => {
    expect(explain({ plan: headboard() })).toContain('chest under a lift-up lid, its floor at mid-height (0.5), open niche (0.5)')
  })
})

describe('pulls', () => {
  const buy = (pulls: CabinetConstruction['pulls']) => {
    const { design, notes } = buildCabinet({ ...PLANS.sideboard, construction: { ...PLANS.sideboard.construction, pulls } }, testCatalog)
    const a = analyze(design, testCatalog)
    return { design, notes, purchase: estimatePurchase(design, a.geo!, testCatalog) }
  }
  const handles = (p: ReturnType<typeof buy>['purchase']) => p.hardware.find((h) => h.hardware.role === 'handle')

  it('buys one handle for each door leaf and drawer front, and prices them', () => {
    const { design, purchase } = buy('handle')
    expect(design.pulls).toBe('handle')
    expect(handles(purchase)).toMatchObject({ count: 6, cost: 6 * 45 })
  })

  it('a notch or no pull buys nothing; the notch is said in the notes', () => {
    expect(handles(buy('none').purchase)).toBeUndefined()
    const notch = buy('notch')
    expect(handles(notch.purchase)).toBeUndefined()
    expect(notch.notes).toEqual([expect.stringMatching(/Muesca.*6 frentes/)])
    expect(buy('handle').notes).toEqual([])
    expect(buy('none').design.pulls).toBeUndefined()
  })

  it('leaves the list as it was for a cabinet with no doors or drawers', () => {
    const { design } = buildCabinet({ ...PLANS.bookcase, construction: { ...DEFAULT_CONSTRUCTION, pulls: 'handle' } }, testCatalog)
    expect(handles(estimatePurchase(design, analyze(design, testCatalog).geo!, testCatalog))).toBeUndefined()
  })

  it('a plan that does not say its pulls reads as it is: the build decides, front by front', () => {
    expect(DEFAULT_CONSTRUCTION.pulls).toBeUndefined()
    expect(CabinetPlan.parse(PLANS.bookcase).construction.pulls).toBeUndefined()
  })

  describe('when the plan does not say', () => {
    const fronts = (construction: Partial<CabinetConstruction>, cells: PlanCell[] = [cell('door', 0.6, { doors: 2, shelves: 0 }), cell('drawer', 0.4)]) => {
      const { design, notes } = buildCabinet(plan({ name: 'Mueble', dimensions: { width: 600, height: 800, depth: 400 }, construction: { ...DEFAULT_CONSTRUCTION, ...construction }, columns: [{ width: 1, cells }] }), testCatalog)
      const a = analyze(design, testCatalog)
      if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
      const pull = (id: string) => design.pullsOf?.[id] ?? design.pulls ?? 'none'
      const all = design.pieces.filter((p) => p.role === 'door' || p.role === 'drawer-front')
      return { notched: all.filter((p) => p.cuts?.length).map((p) => p.role), pulls: all.map((p) => pull(p.id)), notes: notes.filter((n) => n.startsWith('Muesca')), handles: estimatePurchase(design, a.geo, testCatalog).hardware.some((h) => h.hardware.role === 'handle') }
    }

    it('inset doors and inset drawer fronts each take a notch, said in the notes, and nothing is bought', () => {
      expect(fronts({ doors: 'inset', drawerFronts: 'inset' })).toEqual({ notched: ['door', 'door', 'drawer-front'], pulls: ['notch', 'notch', 'notch'], notes: [expect.stringMatching(/Muesca.*3 frentes/)], handles: false })
    })

    it('overlay fronts take none: an edge of theirs can be pulled', () => {
      expect(fronts({ doors: 'overlay', drawerFronts: 'overlay' })).toEqual({ notched: [], pulls: ['none', 'none', 'none'], notes: [], handles: false })
    })

    it('in a mix only the inset ones take it: inset doors over overlay drawers, and the reverse', () => {
      expect(fronts({ doors: 'inset', drawerFronts: 'overlay' })).toMatchObject({ notched: ['door', 'door'], pulls: ['notch', 'notch', 'none'], notes: [expect.stringMatching(/Muesca.*2 frentes/)] })
      expect(fronts({ doors: 'overlay', drawerFronts: 'inset' })).toMatchObject({ notched: ['drawer-front'], pulls: ['none', 'none', 'notch'], notes: [expect.stringMatching(/Muesca.*1 frente:/)] })
    })

    it('saying none leaves every front without a pull, inset or not', () => {
      expect(fronts({ doors: 'inset', drawerFronts: 'inset', pulls: 'none' })).toEqual({ notched: [], pulls: ['none', 'none', 'none'], notes: [], handles: false })
    })

    it('saying notch or handle is for every front, as before', () => {
      expect(fronts({ doors: 'overlay', drawerFronts: 'inset', pulls: 'notch' }).pulls).toEqual(['notch', 'notch', 'notch'])
      expect(fronts({ doors: 'inset', drawerFronts: 'inset', pulls: 'handle' })).toMatchObject({ notched: [], pulls: ['handle', 'handle', 'handle'], handles: true })
    })

    it('a sliding leaf and a lid take none, and a cell that slides or goes inset on its own is resolved by how it sits', () => {
      expect(fronts({ doors: 'sliding', top: 'over', drawerFronts: 'overlay' }).pulls).toEqual(['none', 'none', 'none'])
      expect(fronts({ doors: 'inset' }, [{ height: 0.5, content: 'chest', shelves: 0, doors: null }, cell('open', 0.5, { shelves: 0 })]).pulls).toEqual(['none'])
      expect(fronts({ doors: 'inset', drawerFronts: 'overlay' }, [{ ...cell('door', 0.6, { doors: 2, shelves: 0 }), own: { doors: 'sliding' } }, cell('drawer', 0.4)]).pulls).toEqual(['none', 'none', 'none'])
      expect(fronts({ doors: 'sliding', top: 'over', drawerFronts: 'overlay' }, [{ ...cell('door', 0.6, { doors: 1, shelves: 0 }), own: { doors: 'inset' } }, cell('drawer', 0.4)]).pulls).toEqual(['notch', 'none'])
    })

    it('a cell that says its own pulls keeps them over what its fronts would take', () => {
      expect(fronts({ doors: 'inset', drawerFronts: 'inset' }, [{ ...cell('door', 0.6, { doors: 2, shelves: 0 }), own: { pulls: 'none' } }, cell('drawer', 0.4)]).pulls).toEqual(['none', 'none', 'notch'])
    })

    it('the form shows what gets built and names it when it changes; choosing none writes it', () => {
      const field = cabinetModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).find((f) => 'key' in f && f.key === 'construction.pulls')!
      if (field.type !== 'choice') throw new Error('the pulls are a choice')
      const unsaid = plan({ name: 'Mueble', columns: [{ width: 1, cells: [cell('door', 0.6, { doors: 2, shelves: 0 }), cell('drawer', 0.4)] }] })
      const overlaid: CabinetPlan = { ...unsaid, construction: { ...unsaid.construction, drawerFronts: 'overlay' } }
      expect([field.get(unsaid), field.get(overlaid)]).toEqual(['notch', 'none'])
      expect(field.set(unsaid, 'none').construction.pulls).toBe('none')
      expect(cabinetModule.describeChanges(unsaid, field.set(unsaid, 'none'))).toEqual(['jaladeras ninguna'])
      // Choosing what is already shown leaves the plan as it was, still unsaid.
      expect(field.set(unsaid, 'notch')).toBe(unsaid)
      expect(cabinetModule.describeChanges(unsaid, overlaid)).toEqual(['frentes de cajón sobrepuestos', 'jaladeras ninguna'])
      const note = cabinetModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).find((f) => f.type === 'note' && f.about === 'construction.pulls')!
      expect([unsaid, overlaid, field.set(unsaid, 'none')].map((p) => isVisible(note, p))).toEqual([true, false, false])
    })
  })
})

describe('a cell choosing on its own', () => {
  const withOwn = (construction: Partial<CabinetConstruction>, own: Record<string, PlanCell['own']>): CabinetPlan => {
    const columns = structuredClone(PLANS.sideboard.columns) as PlanColumn[]
    for (const [at, choices] of Object.entries(own)) {
      const [i, j] = at.split('.').map(Number)
      columns[i].cells[j] = { ...columns[i].cells[j], own: choices }
    }
    return { ...PLANS.sideboard, construction: { ...PLANS.sideboard.construction, ...construction }, columns }
  }
  const build = (p: CabinetPlan) => {
    const { design, notes } = buildCabinet(p, testCatalog)
    const handles = estimatePurchase(design, analyze(design, testCatalog).geo!, testCatalog).hardware.find((h) => h.hardware.role === 'handle')
    return { design, notes, handles: handles?.count ?? 0 }
  }

  it('buys handles only for the cells that chose them, when the furniture has none', () => {
    const { design, handles } = build(withOwn({ pulls: 'none' }, { '0.0': { pulls: 'handle' }, '3.0': { pulls: 'handle' } }))
    expect(handles).toBe(2)
    expect(design.pulls).toBeUndefined()
    expect(Object.values(design.pullsOf ?? {})).toEqual(['handle', 'handle'])
  })

  it('leaves out of the furniture’s handles a cell that chose none, and the others keep them', () => {
    expect(build(withOwn({ pulls: 'handle' }, { '1.0': { pulls: 'none' } })).handles).toBe(5)
  })

  it('cuts a notch only in the fronts of the cell that chose it, and says how many', () => {
    const { design, notes } = build(withOwn({ pulls: 'none' }, { '3.1': { pulls: 'notch' } }))
    expect(design.pieces.filter((p) => p.cuts?.length).map((p) => p.role)).toEqual(['drawer-front'])
    expect(notes).toEqual([expect.stringMatching(/Muesca.*1 frente:/)])
  })

  it('grooves only the fronts of the cell that chose it, and a cell without a choice keeps the furniture’s', () => {
    const grooved = (p: CabinetPlan) => build(p).design.pieces.filter((x) => x.cuts?.length).length
    expect(grooved(withOwn({ fronts: 'flat', pulls: 'none' }, { '0.0': { fronts: 'grooved' } }))).toBe(1)
    expect(grooved(withOwn({ fronts: 'grooved', pulls: 'none' }, { '0.0': { fronts: 'flat' } }))).toBe(5)
  })

  it('hangs the one-leaf door of the cell that says a side on that side, and the others where the furniture says', () => {
    const hungOn = (p: CabinetPlan) => Object.fromEntries(build(p).design.joints.filter((u) => u.type === 'cup-hinge').map((u) => [u.a, u.b]))
    const asBuilt = hungOn(withOwn({ doors: 'inset' }, {}))
    const door = 'c1-h1-door'
    const [left, right] = ['left', 'right'].map((hinges) => hungOn(withOwn({ doors: 'inset' }, { '0.0': { hinges: hinges as 'left' | 'right' } })))
    expect(left[door]).not.toBe(right[door])
    expect([left[door], right[door]]).toContain(asBuilt[door])
    expect(Object.entries(right).filter(([id]) => id !== door)).toEqual(Object.entries(asBuilt).filter(([id]) => id !== door))
  })

  it('offers the hinge side only where one leaf swings: not on two leaves, a sliding door or a drawer', () => {
    const one = { height: 1, content: 'door' as const, shelves: 0, doors: 1 }
    expect(choicesFor(one, DEFAULT_CONSTRUCTION)).toEqual(['pulls', 'fronts', 'hinges', 'doors'])
    expect(choicesFor({ ...one, doors: 2 }, DEFAULT_CONSTRUCTION)).toEqual(['pulls', 'fronts', 'doors'])
    expect(choicesFor(one, { ...DEFAULT_CONSTRUCTION, doors: 'sliding' })).toEqual(['pulls', 'fronts', 'doors'])
    expect(choicesFor({ ...one, own: { doors: 'sliding' } }, DEFAULT_CONSTRUCTION)).toEqual(['pulls', 'fronts', 'doors'])
    expect(choicesFor({ ...one, own: { doors: 'inset' } }, { ...DEFAULT_CONSTRUCTION, doors: 'sliding' })).toEqual(['pulls', 'fronts', 'hinges', 'doors'])
    expect(choicesFor({ ...one, content: 'drawer', doors: null, shelves: null }, DEFAULT_CONSTRUCTION)).toEqual(['pulls', 'fronts'])
    expect(CabinetPlan.safeParse(withOwn({}, { '0.0': { hinges: 'outside' as never } })).success).toBe(false)
  })

  it('slides the doors of the cell that says so in a furniture of hinged doors, behind its track, and the others keep their hinges', () => {
    const { design, notes } = build(withOwn({ doors: 'overlay', pulls: 'none' }, { '0.0': { doors: 'sliding' } }))
    const a = analyze(design, testCatalog)
    expect(a.valid ? [] : a.errors.map((e) => e.message)).toEqual([])
    const hinged = design.joints.filter((u) => u.type === 'cup-hinge').map((u) => u.a)
    expect(design.pieces.filter((p) => p.role === 'door').map((p) => [p.id, slides(design, p.id), hinged.includes(p.id)])).toEqual([
      ['c1-h1-door', true, false],
      ['c2-h1-door', false, true],
      ['c3-h1-door', false, true],
    ])
    expect(a.geo!.boxes.get('c1-h1-shelf-1')!.z1).toBeLessThan(a.geo!.boxes.get('c1-h1-door')!.z0)
    expect(notes).toEqual([expect.stringMatching(/^Puerta corrediza sin bisagras/)])
  })

  it('hangs an inset door in the cell that says so in a furniture of sliding doors', () => {
    const { design } = build(withOwn({ doors: 'sliding' }, { '1.0': { doors: 'inset' } }))
    const a = analyze(design, testCatalog)
    expect(a.valid ? [] : a.errors.map((e) => e.message)).toEqual([])
    expect(design.pieces.filter((p) => p.role === 'door').map((p) => [p.id, slides(design, p.id)])).toEqual([
      ['c1-h1-door', true],
      ['c2-h1-door', false],
      ['c3-h1-door', true],
    ])
    expect(doorMount(a.geo!.boxes.get('c2-h1-door')!, a.geo!.boxes.get(design.joints.find((u) => u.type === 'cup-hinge')!.b)!)).toBe('inset')
  })

  it('refuses overlay against inset by cell, the one mix the carcass cannot take, and says where it is chosen', () => {
    const issues = (p: CabinetPlan) => { const r = FurniturePlan.safeParse(p); return r.success ? [] : r.error.issues.map((i) => i.message) }
    expect(issues(withOwn({ doors: 'overlay' }, { '0.0': { doors: 'inset' } }))).toEqual([expect.stringContaining('Sobrepuestas o embutidas se elige para todo el mueble')])
    expect(issues(withOwn({ doors: 'inset' }, { '0.0': { doors: 'inset' } }))).toEqual([])
    expect(issues(withOwn({ doors: 'inset' }, { '0.0': { doors: 'sliding' } }))).toEqual([])
    expect([cellOptions('doors', { ...DEFAULT_CONSTRUCTION, doors: 'overlay' }), cellOptions('doors', { ...DEFAULT_CONSTRUCTION, doors: 'sliding' }), cellOptions('hinges', DEFAULT_CONSTRUCTION)]).toEqual([['sliding'], ['inset'], ['left', 'right']])
  })

  it('reads back from a ficha with only what the cell chose, never the furniture’s defaults', () => {
    const parsed = CabinetPlan.parse(withOwn({}, { '0.0': { pulls: 'handle' } }))
    expect(parsed.columns[0].cells[0].own).toEqual({ pulls: 'handle' })
    expect(parsed.columns[1].cells[0].own).toBeUndefined()
  })
})

describe('the pulls field', () => {
  const field = cabinetModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).find((f) => f.type === 'choice' && f.key === 'construction.pulls')!
  it('is offered only when there is a door or a drawer to open', () => {
    expect(isVisible(field, PLANS.bookcase)).toBe(false)
    expect(isVisible(field, PLANS.drawerChest)).toBe(true)
    expect(isVisible(field, PLANS.wallCabinet)).toBe(true)
  })
})

describe('overlay drawer fronts on a shallow piece', () => {
  const nightstand = (depth: number, drawerFronts: CabinetConstruction['drawerFronts']) =>
    buildCabinet({ ...PLANS.nightstand, dimensions: { width: 450, height: 500, depth }, construction: { ...DEFAULT_CONSTRUCTION, drawerFronts } }, testCatalog)
  const drawerParts = (design: ReturnType<typeof buildCabinet>['design']) => design.pieces.filter((p) => p.role.startsWith('drawer')).length

  it('the front outside the carcass does not eat the drawer depth: a 350 mm nightstand takes a drawer either way', () => {
    for (const fronts of ['inset', 'overlay'] as const) {
      const { design, notes } = nightstand(350, fronts)
      expect(analyze(design, testCatalog).valid).toBe(true)
      expect({ fronts, drawer: drawerParts(design) > 0, notes: notes.map((n) => n.slice(0, 17)) }).toEqual({ fronts, drawer: true, notes: fronts === 'inset' ? ['Muesca para abrir'] : [] })
    }
  })

  it('a drawer that does not fit becomes an open cell and the carcass is not left set back for a front that is not there', () => {
    const { design, notes } = nightstand(300, 'overlay')
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    expect(drawerParts(design)).toBe(0)
    expect(notes).toEqual([expect.stringMatching(/^Cajón 1: No cabe un cajón/)])
    expect(design.pieces.find((p) => p.id === 'side-left')!.z.to).toMatchObject({ ref: 'furniture.z1', offset: 0 })
  })
})

describe('a void in a column', () => {
  const empty = (height: number): PlanCell => ({ height, content: 'void', shelves: null, doors: null })
  const open = (height = 1) => cell('open', height, { shelves: 0 })
  const open3 = { ...DEFAULT_CONSTRUCTION, back: 'none' as const, top: 'over' as const, shelves: 'fixed' as const }
  // Three boxes under one top: the outer ones stop short of the floor, the middle one stands on it.
  const hanging = (extra: Partial<CabinetPlan> = {}) =>
    plan({ name: 'Repisa', dimensions: { width: 1200, height: 400, depth: 250 }, base: 'floor', construction: open3, columns: [{ width: 0.3, cells: [empty(0.3), open(0.7)] }, { width: 0.4, cells: [open()] }, { width: 0.3, cells: [empty(0.5), open(0.5)] }], ...extra })
  const built = (p: CabinetPlan) => {
    const { design, notes } = buildCabinet(p, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    return { design, notes, a, box: (id: string) => a.geo.boxes.get(id)!, piece: (id: string) => design.pieces.find((x) => x.id === id) }
  }

  it('builds nothing where the void is: no piece reaches into it', () => {
    const { design, box } = built(hanging())
    const floor = box('c1-sep-1')
    const inVoid = design.pieces.filter((p) => {
      const b = box(p.id)
      return b.x1 > box('side-left').x1 + 1 && b.x0 < box('div-1').x0 - 1 && b.y0 < floor.y0 - 1
    })
    expect(inVoid.map((p) => p.id)).toEqual([])
  })

  it('the fixed shelf next to the void is the floor of its column, and its side starts there', () => {
    const { piece, box } = built(hanging())
    expect(piece('c1-sep-1')).toMatchObject({ role: 'bottom', name: 'Piso de la columna 1' })
    expect(box('side-left').y0).toBe(box('c1-sep-1').y0)
    expect(box('side-right').y0).toBe(box('c3-sep-1').y0)
    expect(box('side-right').y0).toBeGreaterThan(box('side-left').y0)
  })

  it('the floor comes in a stretch under the columns that reach it, and under the dividers that end it', () => {
    const { design, box } = built(hanging())
    expect(design.pieces.filter((p) => p.role === 'bottom' && p.id.startsWith('bottom')).map((p) => p.id)).toEqual(['bottom'])
    expect([box('bottom').x0, box('bottom').x1]).toEqual([box('div-1').x0, box('div-2').x1])
    expect(box('div-1').y0).toBe(box('bottom').y1)
  })

  it('a nailed back is one per column, as tall as what the column builds, and a kick follows the floor', () => {
    const { design, box, a } = built(
      plan({ name: 'Aparador', dimensions: { width: 1200, height: 800, depth: 400 }, wallMounted: false, construction: { ...DEFAULT_CONSTRUCTION, top: 'over' }, columns: [{ width: 1, cells: [cell('door', 1, { doors: 1, shelves: 0 })] }, { width: 1, cells: [empty(0.4), open(0.6)] }, { width: 1, cells: [open()] }] }),
    )
    const ids = (role: string) => design.pieces.filter((p) => p.role === role).map((p) => p.id)
    expect(ids('back')).toEqual(['back', 'back-2', 'back-3'])
    expect(box('back-2').y0).toBe(box('c2-sep-1').y0)
    expect(ids('kick')).toEqual(['kick', 'kick-2'])
    expect(ids('bottom')).toEqual(['bottom', 'bottom-2', 'c2-sep-1'])
    // A support under a divider only where the floor runs on both sides of it.
    expect(design.pieces.some((p) => p.id.startsWith('bottom-support'))).toBe(false)
    expect(a.findings).toEqual([])
    expect(a.warnings).toEqual([])
  })

  // A box at an end raised over a void: on the floor with nothing under it, only the top holds it; on legs, its legs go up to it.
  const raised = (base: CabinetPlan['base'], wallMounted: boolean) =>
    plan({ name: 'Librero', dimensions: { width: 880, height: 760, depth: 350 }, base, wallMounted, columns: [{ width: 0.39, cells: [open(0.62), open(0.38)] }, { width: 0.61, cells: [empty(0.37), open(0.63)] }] })

  it('a box at an end that reaches neither the floor nor anything under it is critical: it hangs from the top', () => {
    const { a } = built(raised('floor', false))
    expect(a.findings.filter((f) => f.check === 'base.hanging').map((f) => [f.severity, f.pieces])).toEqual([['critical', ['side-right', 'c2-sep-1']]])
    expect(a.findings.find((f) => f.check === 'base.hanging')!.alternatives.map((x) => x.key)).toEqual(['anchor-to-wall'])
  })

  it('anchored to the wall, the wall holds that box and there is nothing to say', () => {
    expect(built(raised('floor', true)).a.findings.filter((f) => f.check === 'base.hanging')).toEqual([])
  })

  it('on legs, the legs of that end go up to the floor of its box, with their side apron, and it stands', () => {
    const { a, box } = built(raised('legs', false))
    expect(a.findings).toEqual([])
    expect(a.warnings).toEqual([])
    expect(box('leg-front-right-1').y1).toBe(box('c2-sep-1').y0)
    expect(box('leg-back-right-1').y1).toBe(box('c2-sep-1').y0)
    expect(box('apron-right').y1).toBe(box('c2-sep-1').y0)
    // The other end and the front apron stay at the level of the floor that reaches the bottom.
    expect(box('leg-front-left-1').y1).toBe(box('bottom').y0)
    expect(box('apron-front').y1).toBe(box('bottom').y0)
  })

  it('a column that stops short between two that stand is carried by them, and is not a hanging box', () => {
    const { a } = built(
      plan({ name: 'Aparador', dimensions: { width: 1200, height: 800, depth: 400 }, wallMounted: false, construction: { ...DEFAULT_CONSTRUCTION, top: 'over' }, columns: [{ width: 1, cells: [open()] }, { width: 1, cells: [empty(0.4), open(0.6)] }, { width: 1, cells: [open()] }] }),
    )
    expect(a.findings.filter((f) => f.check === 'base.hanging')).toEqual([])
  })

  it('at the top, each column that stops short gets its own roof and the top covers only the rest', () => {
    const { design, box, piece } = built(
      plan({ name: 'Librero', dimensions: { width: 1200, height: 1800, depth: 300 }, base: 'floor', construction: { ...open3, top: 'between' }, columns: [{ width: 1, cells: [open(0.5), open(0.5)] }, { width: 1, cells: [open(0.6), empty(0.4)] }, { width: 1, cells: [open(0.4), open(0.3), empty(0.3)] }] }),
    )
    expect(piece('c2-sep-1')).toMatchObject({ role: 'top', name: 'Techo de la columna 2' })
    expect(design.pieces.filter((p) => p.id.startsWith('top')).map((p) => p.id)).toEqual(['top'])
    expect(box('top').x1).toBe(box('div-1').x0)
    expect(box('side-right').y1).toBe(box('c3-sep-2').y1)
    // The divider between two columns that stop short reaches the higher roof.
    expect(box('div-2').y1).toBe(box('c3-sep-2').y1)
  })

  it('a plan with no void builds the same pieces as before, by the same ids', () => {
    const { design } = buildCabinet(PLANS.tvStand, testCatalog)
    expect(design.pieces.filter((p) => ['back', 'bottom', 'top', 'kick', 'side', 'divider'].includes(p.role)).map((p) => p.id)).toEqual(['back', 'side-left', 'side-right', 'kick', 'bottom', 'top', 'div-1', 'div-2', 'bottom-support-1', 'bottom-support-2'])
  })

  it('goes only at an end of its column, one per end, and some column reaches the floor and some the top', () => {
    const ok = (columns: CabinetPlan['columns']) => FurniturePlan.safeParse(hanging({ columns })).success
    expect(ok(hanging().columns)).toBe(true)
    expect(ok([{ width: 1, cells: [open(), empty(1), open()] }])).toBe(false)
    expect(ok([{ width: 1, cells: [empty(1), empty(1), open()] }, { width: 1, cells: [open()] }])).toBe(false)
    expect(ok([{ width: 1, cells: [empty(1)] }, { width: 1, cells: [open()] }])).toBe(false)
    expect(ok([{ width: 1, cells: [empty(1), open()] }, { width: 1, cells: [empty(1), open()] }])).toBe(false)
    expect(ok([{ width: 1, cells: [open(), empty(1)] }, { width: 1, cells: [open(), empty(1)] }])).toBe(false)
    const refused = FurniturePlan.safeParse(hanging({ columns: [{ width: 1, cells: [open(), empty(1), open()] }] }))
    expect(refused.success ? '' : refused.error.issues[0].message).toMatch(/^Un hueco vacío va abajo o arriba/)
  })

  it('with nothing to hang from, it is built as an open cell and the person is told', () => {
    const { design, notes } = buildCabinet(hanging({ columns: [{ width: 1, cells: [empty(0.3), open(0.7)] }] }), testCatalog)
    expect(analyze(design, testCatalog).valid).toBe(true)
    expect(notes).toEqual([expect.stringMatching(/^Un hueco vacío va abajo o arriba/)])
    expect(design.pieces.some((p) => p.id === 'bottom')).toBe(true)
  })

  it('is not something the expert can say: its columns keep the cells it had', () => {
    expect(ExpertColumns.safeParse(hanging().columns).success).toBe(false)
    expect(ExpertColumns.safeParse(PLANS.tvStand.columns).success).toBe(true)
  })

  it('is not counted as a niche, and reads as nothing built', () => {
    expect(quickCounts(hanging())).toEqual({ drawer: 0, door: 0, open: 3 })
    expect(explain({ plan: hanging() })).toContain('nothing built (0.3)')
  })
})

describe('a cell split into columns', () => {
  const open = (height = 1, shelves = 0): PlanCell => ({ height, content: 'open', shelves, doors: null })
  const drawer = (height = 1): PlanCell => ({ height, content: 'drawer', shelves: null, doors: null })
  const door = (height = 1, doors = 1): PlanCell => ({ height, content: 'door', shelves: 0, doors })
  const split = (height: number, columns: PlanColumn[]): PlanCell => ({ height, content: 'open', shelves: null, doors: null, columns })
  const col = (width: number, cells: PlanCell[]): PlanColumn => ({ width, cells })
  const built = (p: CabinetPlan) => {
    const { design, notes } = buildCabinet(p, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    return { design, notes, a, box: (id: string) => a.geo.boxes.get(id)!, has: (id: string) => design.pieces.some((x) => x.id === id) }
  }
  // A bookcase whose levels each put their divider in another place.
  const levels = plan({ name: 'Librero', dimensions: { width: 900, height: 1500, depth: 300 }, base: 'floor', columns: [col(1, [split(0.5, [col(0.34, [open()]), col(0.66, [open()])]), split(0.5, [col(0.66, [open()]), col(0.34, [open()])])])] })

  it('puts the divider of each level where that level asks, between the boards above and below it', () => {
    const { box } = built(levels)
    const span = box('side-right').x0 - box('side-left').x1
    const at = (id: string) => (box(id).x0 + box(id).x1) / 2 - box('side-left').x1
    expect(at('c1-h1-div-1') / span).toBeCloseTo(0.34, 1)
    expect(at('c1-h2-div-1') / span).toBeCloseTo(0.66, 1)
    expect(box('c1-h1-div-1').y0).toBe(box('bottom').y1)
    expect(box('c1-h1-div-1').y1).toBe(box('c1-sep-1').y0)
    expect(box('c1-h2-div-1').y0).toBe(box('c1-sep-1').y1)
    expect(box('c1-h2-div-1').y1).toBe(box('top').y0)
  })

  it('a drawer across two columns is a cell left whole under one that is split', () => {
    const { a, box, has } = built(
      plan({ name: 'Aparador', dimensions: { width: 1900, height: 700, depth: 450 }, base: 'legs', wallMounted: true, construction: { ...DEFAULT_CONSTRUCTION, doors: 'inset' }, columns: [col(0.77, [drawer(0.28), split(0.72, [col(0.66, [door(1, 2)]), col(0.34, [open()])])]), col(0.23, [door()])] }),
    )
    expect(a.findings).toEqual([])
    expect(a.warnings).toEqual([])
    const front = box('drawer-1-front')
    // The front crosses where the divider of the split cell above it stands.
    expect(front.x0).toBeLessThan(box('c1-h2-div-1').x0)
    expect(front.x1).toBeGreaterThan(box('c1-h2-div-1').x1)
    expect(has('c1-h2-c1-h1-door-left') && has('c1-h2-c1-h1-door-right') && has('c2-h1-door')).toBe(true)
  })

  it('rows split each their own way, as a chest of drawers whose wide drawers cross', () => {
    const chest = plan({ name: 'Cajonera', dimensions: { width: 1150, height: 780, depth: 550 }, base: 'legs', wallMounted: true, columns: [col(1, [split(0.4, [col(2, [drawer()]), col(1, [drawer()])]), split(0.35, [col(1, [drawer()]), col(2, [drawer()])]), split(0.25, [col(2, [drawer()]), col(1, [open(1, 1)])])])] })
    const { a, design } = built(chest)
    expect(a.findings).toEqual([])
    expect(design.pieces.filter((p) => p.role === 'drawer-front')).toHaveLength(5)
    expect(quickCounts(chest)).toEqual({ drawer: 5, door: 0, open: 1 })
    expect(leafCells(chest.columns)).toHaveLength(6)
  })

  it('a plan with no split cell builds the same pieces by the same ids', () => {
    expect(buildCabinet(PLANS.tvStand, testCatalog).design.pieces.map((p) => p.id)).toEqual(buildCabinet(structuredClone(PLANS.tvStand), testCatalog).design.pieces.map((p) => p.id))
    expect(buildCabinet(PLANS.tvStand, testCatalog).design.pieces.some((p) => /-h\d+-c\d+/.test(p.id))).toBe(false)
  })

  it('has two columns at least, is not a void, and holds no void inside', () => {
    const ok = (columns: PlanColumn[]) => FurniturePlan.safeParse({ ...levels, columns }).success
    expect(ok(levels.columns)).toBe(true)
    expect(ok([col(1, [split(1, [col(1, [open()])])])])).toBe(false)
    expect(ok([col(1, [{ ...split(1, [col(1, [open()]), col(1, [open()])]), content: 'void' }]), col(1, [open()])])).toBe(false)
    expect(ok([col(1, [split(1, [col(1, [{ ...open(0.5), content: 'void' }, open(0.5)]), col(1, [open()])])])])).toBe(false)
  })

  it('a void inside a split cell is built as an open cell, and the person is told', () => {
    const { notes, a } = built({ ...levels, columns: [col(1, [split(1, [col(1, [{ ...open(0.5), content: 'void' }, open(0.5)]), col(1, [open()])])])] })
    expect(a.valid).toBe(true)
    expect(notes[0]).toMatch(/^Un hueco dividido en columnas/)
  })

  it('is not something the expert can say, and reads as split', () => {
    expect('columns' in ExpertColumns.parse(levels.columns)[0].cells[0]).toBe(false)
    expect(explain({ plan: levels })).toContain('split into 2 columns')
  })
})

describe('a back that does not fit a sheet', () => {
  const backsOf = (p: CabinetPlan) => {
    const { design } = buildCabinet(p, testCatalog)
    const a = analyze(design, testCatalog)
    return { a, backs: design.pieces.filter((x) => x.role === 'back'), box: (id: string) => (a.valid ? a.geo.boxes.get(id)! : undefined) }
  }
  const tall = { ...PLANS.sideboard, dimensions: { width: 1600, height: 1800, depth: 400 } }

  it('goes in one board per column, meeting at the middle of each divider, with nothing to find', () => {
    const { a, backs, box } = backsOf(tall)
    expect(backs.map((b) => b.name)).toEqual(['Trasera de la columna 1', 'Trasera de la columna 2', 'Trasera de la columna 3', 'Trasera de la columna 4'])
    expect(a.valid && a.findings).toEqual([])
    expect(box('back')!.x1).toBe(box('back-2')!.x0)
    expect(box('back')!.x1).toBe((box('div-1')!.x0 + box('div-1')!.x1) / 2)
  })

  it('stays one board while it fits, lying or standing', () => {
    expect(backsOf(PLANS.sideboard).backs.map((b) => b.name)).toEqual(['Trasera'])
    expect(backsOf(PLANS.bookcase).backs.map((b) => b.name)).toEqual(['Trasera'])
  })

  it('is still refused in a single column wider and taller than the sheet: there is no divider to join two boards on', () => {
    const { a } = backsOf(plan({ dimensions: { width: 1200, height: 2000, depth: 300 } }))
    expect(!a.valid && a.errors.map((e) => [e.code, e.data?.piece])).toEqual([['E_TOO_BIG_FOR_SHEET', 'back']])
  })
})

describe('a back by cell', () => {
  const open = (height = 1, back?: boolean): PlanCell => ({ height, content: 'open', shelves: 0, doors: null, ...(back === undefined ? {} : { back }) })
  const drawer = (height = 1, back?: boolean): PlanCell => ({ height, content: 'drawer', shelves: null, doors: null, ...(back === undefined ? {} : { back }) })
  const built = (p: CabinetPlan) => {
    const { design } = buildCabinet(p, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    return { design, a, box: (id: string) => a.geo.boxes.get(id)!, backs: () => design.pieces.filter((p) => p.role === 'back').map((p) => p.id) }
  }
  // Three columns of four niches, with a back in a checkerboard: the first column in its second niche, the second in its first and third.
  const checkers = plan({
    name: 'Librero',
    dimensions: { width: 1200, height: 1800, depth: 350 },
    base: 'floor',
    construction: { ...DEFAULT_CONSTRUCTION, back: 'none', shelves: 'fixed' },
    columns: [{ width: 1, cells: [open(0.25), open(0.25, true), open(0.25), open(0.25)] }, { width: 1, cells: [open(0.25, true), open(0.25), open(0.25, true), open(0.25)] }, { width: 1, cells: [open(), open(), open(), open()] }],
  })

  it('puts a board only behind the cells that have one, from the middle of each board it shares out to the whole of an outer one', () => {
    const { backs, box } = built(checkers)
    expect(backs()).toEqual(['back', 'c2-back-1', 'c2-back-2'])
    // The first is the one the rest of the box stands in front of.
    expect(box('c1-sep-1').z0).toBe(box('back').z1)
    expect(box('back').x0).toBe(box('side-left').x0)
    expect(box('back').x1).toBe((box('div-1').x0 + box('div-1').x1) / 2)
    expect(box('back').y0).toBe((box('c1-sep-1').y0 + box('c1-sep-1').y1) / 2)
    expect(box('c2-back-1').y0).toBe(0)
  })

  it('a run of cells with a back is one board', () => {
    const { backs, box, design } = built({ ...checkers, columns: [{ width: 1, cells: [open(0.5, true), open(0.25, true), open(0.25)] }, { width: 1, cells: [open()] }] })
    expect(backs()).toEqual(['back'])
    expect(design.pieces.find((p) => p.id === 'back')!.name).toBe('Trasera de la columna 1 (huecos 1 a 2)')
    expect(box('back').y1).toBe((box('c1-sep-2').y0 + box('c1-sep-2').y1) / 2)
  })

  it('in a cabinet with a back, a cell without one leaves it open and the rest of the column keeps it', () => {
    const chest = plan({ name: 'Cajonera', dimensions: { width: 500, height: 840, depth: 450 }, base: 'floor', wallMounted: true, columns: [{ width: 1, cells: [drawer(0.24), drawer(0.24), drawer(0.24), open(0.28, false)] }] })
    const { backs, box, a } = built(chest)
    expect(backs()).toEqual(['back'])
    expect(box('back').y1).toBe((box('c1-sep-3').y0 + box('c1-sep-3').y1) / 2)
    expect(a.findings.filter((f) => f.severity === 'critical')).toEqual([])
  })

  it('without a back anywhere, the box goes to the rear edge as one with no back', () => {
    const { backs, box } = built({ ...checkers, construction: DEFAULT_CONSTRUCTION, columns: checkers.columns.map((c) => ({ ...c, cells: c.cells.map((x) => ({ ...x, back: false })) })) })
    expect(backs()).toEqual([])
    expect(box('side-left').z0).toBe(0)
  })

  it('a plan that says no back by cell builds the same pieces by the same ids', () => {
    const same = (p: CabinetPlan) => buildCabinet(p, testCatalog).design.pieces.map((x) => x.id)
    expect(same({ ...PLANS.tvStand, columns: PLANS.tvStand.columns.map((c) => ({ ...c, cells: c.cells.map((x) => ({ ...x, back: true })) })) })).toEqual(same(PLANS.tvStand))
  })

  it('goes only in a cell that holds something, and is not something the expert can say', () => {
    const ok = (columns: PlanColumn[]) => FurniturePlan.safeParse({ ...checkers, columns }).success
    expect(ok(checkers.columns)).toBe(true)
    expect(ok([{ width: 1, cells: [{ height: 0.3, content: 'void', shelves: null, doors: null, back: true }, open(0.7)] }, { width: 1, cells: [open()] }])).toBe(false)
    expect(ok([{ width: 1, cells: [{ ...open(), back: true, columns: [{ width: 1, cells: [open()] }, { width: 1, cells: [open()] }] }] }])).toBe(false)
    expect('back' in ExpertColumns.parse(checkers.columns)[0].cells[1]).toBe(false)
    expect(explain({ plan: checkers })).toContain('open niche, with a back (0.25)')
  })

  it('hangs a wall cabinet of several columns from a rail in each one', () => {
    const doors = cell('door', 1, { doors: 2, shelves: 1 })
    const { design } = buildCabinet(plan({ name: 'Alacena', dimensions: { width: 1200, height: 720, depth: 350 }, base: 'floor', columns: [{ width: 1, cells: [doors] }, { width: 1, cells: [doors] }] }), testCatalog)
    expect(design.pieces.filter((p) => p.role === 'brace').map((p) => p.id)).toEqual(['hanging-rail-1', 'hanging-rail-2'])
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors[0].message)
    expect(a.findings.map((f) => f.check)).not.toContain('wall-cabinet.hanging-rail')
  })

  it('says a hinged door over 1.8 m may bow, and nothing for a shorter one', () => {
    const closet = (height: number) => buildCabinet(plan({ name: 'Clóset', dimensions: { width: 600, height, depth: 600 }, columns: [{ width: 1, cells: [cell('door', 1, { doors: 1, shelves: 3 })] }] }), testCatalog).notes
    expect(closet(2200)).toEqual(['Una puerta de más de 180 cm de alto se puede arquear: dale el mismo acabado y las mismas manos por las dos caras y los cantos.'])
    expect(closet(1700)).toEqual([])
  })
})

describe('a rod to hang clothes from', () => {
  const hang = (content: 'open' | 'door', height = 1, more: Partial<PlanCell> = {}): PlanCell => ({ height, content, shelves: 0, doors: content === 'door' ? 1 : null, rod: true, ...more })
  const closet = (columns: PlanColumn[], more: Partial<CabinetPlan> = {}) => plan({ name: 'Clóset', dimensions: { width: 900, height: 2000, depth: 580 }, columns, ...more })
  const built = (p: CabinetPlan) => {
    const { design, notes } = buildCabinet(p, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    return { design, notes, a, box: (id: string) => a.geo.boxes.get(id)!, rods: rodRuns(design, a.geo.boxes), checks: a.findings.flatMap((f) => (f.check?.startsWith('rod.') ? [f.check] : [])) }
  }
  const bought = ({ design, a }: ReturnType<typeof built>) => Object.fromEntries(estimatePurchase(design, a.geo, testCatalog).hardware.map((h) => [h.hardware.id, h.count]))
  const size = (width: number, height: number, depth: number) => ({ dimensions: { width, height, depth } })

  it('runs from wall to wall under the top of its cell, in the middle of the depth, and is no board to cut', () => {
    const one = built(closet([{ width: 1, cells: [hang('open')] }]))
    const [left, right, top] = ['side-left', 'side-right', 'top'].map(one.box)
    expect(one.rods).toEqual([expect.objectContaining({ ceiling: 'top', walls: ['side-left', 'side-right'], x0: left.x1, x1: right.x0, y: top.y0 - ASSUMPTIONS.rods.drop })])
    expect(one.rods[0].z).toBeCloseTo((top.z0 + top.z1) / 2)
    expect(cutList(one.design, one.a.geo).some((line) => /tubo/i.test(line.name))).toBe(false)
    expect(one.notes).toEqual(['Tubo para colgar: se corta con segueta al ancho del hueco y va con una brida atornillada a cada costado, al centro del fondo.'])
  })

  it('buys the shortest tube that reaches across and two flanges for each rod', () => {
    const one = built(closet([{ width: 1, cells: [hang('open')] }]))
    expect([bought(one)['closet-rod-120'], bought(one)['rod-flange']]).toEqual([1, 2])
    const double = built(closet([{ width: 1, cells: [hang('open', 0.5), hang('open', 0.5)] }]))
    expect([bought(double)['closet-rod-120'], bought(double)['rod-flange']]).toEqual([2, 4])
    const wide = built(closet([{ width: 1, cells: [hang('open')] }], size(1400, 1150, 580)))
    expect([bought(wide)['closet-rod-120'], bought(wide)['closet-rod-240']]).toEqual([undefined, 1])
  })

  it('takes the place of the shelves, and leaves the top its screws into the walls', () => {
    const one = built(closet([{ width: 1, cells: [hang('door', 1, { shelves: 3 })] }]))
    expect(one.design.pieces.filter((p) => p.role === 'shelf')).toEqual([])
    expect(one.design.joints.filter((u) => (u.a === 'top' && u.b === 'side-left') || (u.a === 'side-left' && u.b === 'top')).map((u) => u.type)).toEqual(['butt-screw'])
  })

  it('two in one column hang one over the other, each under its own board, between the same walls', () => {
    const { rods, box } = built(closet([{ width: 1, cells: [hang('open', 0.5), hang('open', 0.5)] }]))
    expect(rods.map((r) => [r.ceiling, r.walls])).toEqual([['c1-sep-1', ['side-left', 'side-right']], ['top', ['side-left', 'side-right']]])
    expect(rods[1].below).toBeCloseTo(rods[1].y - box('c1-sep-1').y1)
  })

  it('in a column between dividers it stops at them', () => {
    const shelved = cell('open', 1, { shelves: 3 })
    const { rods } = built(closet([{ width: 1, cells: [shelved] }, { width: 1, cells: [hang('open')] }, { width: 1, cells: [shelved] }], size(1800, 2000, 580)))
    expect(rods.map((r) => r.walls)).toEqual([['div-1', 'div-2']])
  })

  it('a closet of the usual measures has nothing to say about its rod', () => {
    expect(built(closet([{ width: 1, cells: [hang('door', 0.85), cell('open', 0.15, { shelves: 0 })] }])).checks).toEqual([])
  })

  it('past the longest span it recommends a support in the middle; a shallow one has no room for hangers; a low one, none for a shirt', () => {
    expect(built(closet([{ width: 1, cells: [hang('open')] }], size(1400, 1150, 580))).checks).toEqual(['rod.span'])
    expect(built(closet([{ width: 1, cells: [hang('open')] }], size(900, 2000, 400))).checks).toEqual(['rod.depth'])
    const low = built(closet([{ width: 1, cells: [hang('open')] }], size(900, 900, 580)))
    expect(low.checks).toEqual(['rod.height'])
    expect(low.a.findings.find((f) => f.check === 'rod.height')).toMatchObject({ code: 'R10_USE', severity: 'recommendation', pieces: ['top', 'side-left', 'side-right'] })
  })

  it('goes only where clothes can be reached: a plan with one in a drawer is refused, and built without it', () => {
    const inDrawer = closet([{ width: 1, cells: [{ ...cell('drawer', 0.3), rod: true }, hang('open', 0.7)] }])
    expect(FurniturePlan.safeParse(inDrawer).error?.issues.map((i) => i.message)).toEqual(['Un tubo para colgar va en un hueco abierto o detrás de puertas, sin dividir: no en un cajón, un baúl ni un hueco tapado.'])
    expect(built(inDrawer).rods).toHaveLength(1)
    expect(FurniturePlan.safeParse(closet([{ width: 1, cells: [hang('door')] }])).success).toBe(true)
  })

  it('a plan without rods builds a design that does not mention them', () => {
    expect('rods' in buildCabinet(PLANS.bookcase, testCatalog).design).toBe(false)
  })
})

describe('a cable pass', () => {
  const wired = (content: 'open' | 'door', height = 1, more: Partial<PlanCell> = {}): PlanCell => ({ height, content, shelves: 0, doors: content === 'door' ? 1 : null, cable: true, ...more })
  const tv = (columns: PlanColumn[], more: Partial<CabinetPlan> = {}) => plan({ name: 'Mueble de TV', dimensions: { width: 1200, height: 500, depth: 400 }, columns, ...more })
  const built = (p: CabinetPlan) => {
    const { design, notes } = buildCabinet(p, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    const holed = design.pieces.filter((x) => x.holes?.length)
    const centers = holed.flatMap((x) => x.holes!.map((h) => ({ x: a.geo.boxes.get(x.id)!.x0 + h.x!, y: a.geo.boxes.get(x.id)!.y0 + h.y!, z: h.z, diameter: h.diameter })))
    return { design, notes, a, box: (id: string) => a.geo.boxes.get(id)!, holed, centers }
  }
  const NOTE = 'Pasacables: un barreno de 60 mm en la trasera, al centro del hueco y a 60 mm de su piso. Se hace con broca sierra antes de clavar la trasera.'

  it('is a 60 mm hole through the back, in the middle of its cell and 60 mm above its floor', () => {
    const one = built(tv([{ width: 1, cells: [wired('open')] }, { width: 1, cells: [cell('open', 1, { shelves: 0 })] }]))
    const [left, divider, bottom] = ['side-left', 'div-1', 'bottom'].map(one.box)
    expect(one.holed.map((x) => [x.id, x.role, x.normal])).toEqual([['back', 'back', 'z']])
    expect(one.centers).toEqual([{ x: (left.x1 + divider.x0) / 2, y: bottom.y1 + 60, z: null, diameter: 60 }])
    expect(one.notes).toEqual([NOTE])
  })

  it('changes nothing to buy or to cut: the back is the same board, and the cut list says it still takes work', () => {
    const cells = (cable: boolean): PlanColumn[] => [{ width: 1, cells: [cable ? wired('door') : cell('door', 1, { shelves: 0, doors: 1 })] }]
    const [plain, holed] = [built(tv(cells(false))), built(tv(cells(true)))]
    expect(holed.design.pieces.map((x) => ({ ...x, holes: undefined }))).toEqual(plain.design.pieces.map((x) => ({ ...x, holes: undefined })))
    expect(holed.design.joints).toEqual(plain.design.joints)
    expect(cutList(holed.design, holed.a.geo)).toEqual(cutList(plain.design, plain.a.geo))
    expect(estimatePurchase(holed.design, holed.a.geo, testCatalog)).toEqual(estimatePurchase(plain.design, plain.a.geo, testCatalog))
    expect(holed.a.findings).toEqual(plain.a.findings)
    const line = cutList(holed.design, holed.a.geo).find((l) => l.ids.includes('back'))!
    expect(afterCutText(afterCut(holed.design, line), line.count)).toBe('Después de cortarla: barreno')
  })

  it('two cells behind one back are two holes in it, each behind its own cell', () => {
    const two = built(tv([{ width: 1, cells: [wired('open', 0.5), wired('door', 0.5)] }]))
    expect(two.holed.map((x) => x.id)).toEqual(['back'])
    expect(two.centers).toHaveLength(2)
    expect(two.centers[1].y - two.centers[0].y).toBeGreaterThan(60)
    expect(two.notes.at(-1)).toMatch(/^2 pasacables: barrenos de 60 mm en la trasera/)
  })

  it('a cell with no back behind it needs no hole, and says so', () => {
    const open = built(tv([{ width: 1, cells: [wired('open', 1, { back: false })] }, { width: 1, cells: [wired('open')] }]))
    expect(open.holed).toHaveLength(1)
    expect(open.notes.at(-1)).toBe(`${NOTE} Donde no hay trasera no hace falta.`)
    const none = built(tv([{ width: 1, cells: [wired('open')] }], { construction: { ...DEFAULT_CONSTRUCTION, back: 'none' } }))
    expect(none.holed).toEqual([])
    expect(none.notes).toEqual(['Pasacables: donde no hay trasera no hace falta, los cables salen por atrás.'])
  })

  it('goes where things stand: not in a drawer, a chest or a covered cell, and a cell that does not ask has none', () => {
    const drawer = tv([{ width: 1, cells: [{ ...cell('drawer'), cable: true }] }])
    expect(FurniturePlan.safeParse(drawer).error?.issues.map((i) => i.message)).toEqual(['Un pasacables va en un hueco abierto o detrás de puertas, sin dividir: no en un cajón, un baúl ni un hueco tapado.'])
    expect(FurniturePlan.safeParse(tv([{ width: 1, cells: [wired('open')] }])).success).toBe(true)
    const plain = built(tv([{ width: 1, cells: [cell('open', 1, { shelves: 0 })] }]))
    expect([plain.holed, plain.notes]).toEqual([[], []])
  })

  it('is said to the expert with the cell, and is not something the expert writes', () => {
    expect(explain({ plan: tv([{ width: 1, cells: [wired('open')] }]) })).toContain('with a cable hole in the back')
    expect(ExpertColumns.safeParse([{ width: 1, cells: [wired('open')] }]).data?.[0].cells[0]).not.toHaveProperty('cable')
  })
})

describe('whole millimetres', () => {
  const boxesOf = (p: CabinetPlan) => {
    const a = analyze(buildCabinet(p, testCatalog).design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    return (id: string) => a.geo.boxes.get(id)!
  }
  const open = cell('open', 1, { shelves: 0 })
  const columns = (widths: number[], content: Cell = open) => widths.map((width) => ({ width, cells: [content] }))
  const openings = (p: CabinetPlan) => {
    const box = boxesOf(p)
    const walls = ['side-left', ...p.columns.slice(1).map((_, i) => `div-${i + 1}`), 'side-right'].map(box)
    return walls.slice(1).map((wall, i) => wall.x0 - walls[i].x1)
  }
  const sized = (width: number, widths: number[]) => plan({ dimensions: { width, height: 900, depth: 300 }, columns: columns(widths) })

  it('columns that do not divide evenly come out whole, and with their boards they fill the room between the sides exactly', () => {
    const widths = openings(sized(1000, [1, 1, 1]))
    expect(widths).toEqual([312, 304, 312])
    expect(widths.reduce((sum, w) => sum + w, 0) + 2 * 18).toBe(1000 - 2 * 18)
  })

  it('a board that falls on a half goes toward the start, so the odd millimetre lands in the last opening', () => {
    expect(openings(sized(999, [1, 1]))).toEqual([472, 473])
    const box = boxesOf(plan({ dimensions: { width: 600, height: 899, depth: 300 }, base: 'floor', columns: [{ width: 1, cells: [open, open] }] }))
    expect([box('c1-sep-1').y0 - box('bottom').y1, box('top').y0 - box('c1-sep-1').y1]).toEqual([422, 423])
  })

  it('the same shares give the same openings, however they are written and however often it is built', () => {
    expect(openings(sized(1000, [0.1, 0.1, 0.1]))).toEqual([312, 304, 312])
    expect(openings(sized(1000, [1 / 3, 1 / 3, 1 / 3]))).toEqual([312, 304, 312])
    expect(openings(sized(999, [0.7, 0.7]))).toEqual([472, 473])
    expect(buildCabinet(sized(1000, [0.3, 0.3, 0.4]), testCatalog)).toEqual(buildCabinet(sized(1000, [0.3, 0.3, 0.4]), testCatalog))
  })

  it('a share inside a share is whole too: the columns of a split cell, and the shelves of each', () => {
    const split = { ...cell('open', 0.63), columns: columns([1, 1, 1], cell('open', 1, { shelves: 2 })) }
    const box = boxesOf(plan({ dimensions: { width: 1001, height: 1000, depth: 300 }, base: 'floor', columns: [{ width: 1, cells: [cell('open', 0.37, { shelves: 0 }), split] }, { width: 1.7, cells: [cell('open', 1, { shelves: 3 })] }] }))
    const boards = ['div-1', 'c1-sep-1', 'c1-h2-div-1', 'c1-h2-div-2', 'c1-h2-c2-h1-shelf-1', 'c1-h2-c2-h1-shelf-2', 'c2-h1-shelf-2'].map(box)
    expect(boards.flatMap((b) => [b.x0, b.x1, b.y0, b.y1]).filter((mm) => Math.abs(mm - Math.round(mm)) > 1e-6)).toEqual([])
  })

  it.each(['inset', 'overlay'] as const)('two %s leaves are whole, and the gap between them takes the odd millimetre: never under the gap between fronts', (doors) => {
    for (const width of [600, 601, 602, 603]) {
      const box = boxesOf(plan({ dimensions: { width, height: 720, depth: 320 }, base: 'floor', construction: { ...DEFAULT_CONSTRUCTION, doors }, columns: columns([1], cell('door', 1, { doors: 2, shelves: 0 })) }))
      const [left, right] = [box('c1-h1-door-left'), box('c1-h1-door-right')]
      expect([left.x1 - left.x0, right.x1 - right.x0]).toEqual(Array(2).fill(Math.floor((width - (doors === 'inset' ? 2 * 18 : 0) - 3 * ASSUMPTIONS.drawers.frontClearance) / 2)))
      expect(right.x0 - left.x1).toBe(ASSUMPTIONS.drawers.frontClearance + (width % 2))
    }
  })
})
