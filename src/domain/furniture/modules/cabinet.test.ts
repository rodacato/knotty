import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { testCatalog } from '../fixtures/catalog.test-util'
import type { Cell } from '../reading/reading'
import { isVisible } from './fields'
import { buildCabinet, cabinetModule, CabinetPlan, DEFAULT_CONSTRUCTION, ExpertColumns, leafCells, type CabinetConstruction, type PlanCell, type PlanColumn } from './cabinet'
import { quickCounts } from './cabinetCounts'
import { explain } from '../explain'
import { LEG_HEIGHT, LEG_HEIGHT_RANGE, MIN_CARCASS_HEIGHT } from './common'
import { FurniturePlan } from './plan'
import { cutList } from '../../materials/cutList'
import { estimatePurchase } from '../../materials/purchase'

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

  it('is on the form only with legs, and every bench variant of the module holds', () => {
    const field = cabinetModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).flatMap((f) => (f.type === 'numbers' ? f.fields : [])).find((f) => f.key === 'legHeight')!
    expect(field).toMatchObject({ min: 100, max: 300 })
    expect(cabinetModule.benchVariants().map(([name, p]) => [name, p.legHeight])).toEqual(expect.arrayContaining([['aparador con patas de 100 mm', 100], ['aparador con patas de 300 mm', 300]]))
  })
})

describe('construction variants', () => {
  const options: { [K in keyof CabinetConstruction]: CabinetConstruction[K][] } = {
    doors: ['overlay', 'inset'],
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
    expect(notes.filter((n) => !n.startsWith('Muesca') && !n.startsWith('Esquinas de dedos') && !n.startsWith('Cubierta con dedos'))).toEqual([])
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

  it('a plan saved before pulls existed still reads, as no pull', () => {
    const { pulls: _, ...old } = DEFAULT_CONSTRUCTION
    expect(CabinetPlan.parse({ ...PLANS.bookcase, construction: old }).construction.pulls).toBe('none')
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
      expect({ fronts, drawer: drawerParts(design) > 0, notes }).toEqual({ fronts, drawer: true, notes: [] })
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
})
