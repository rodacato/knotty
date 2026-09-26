import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { testCatalog } from '../fixtures/catalog.test-util'
import type { Cell } from '../reading/reading'
import { buildCabinet, CabinetPlan, DEFAULT_CONSTRUCTION, type CabinetConstruction } from './cabinet'
import { LEG_HEIGHT } from './common'

const cell = (content: Cell['content'], height = 1, extra: Partial<Cell> = {}): Cell => ({ height, content, shelves: null, doors: null, ...extra })
const plan = (p: Partial<CabinetPlan>): CabinetPlan => ({ kind: 'cabinet', name: 'Mueble', dimensions: { width: 600, height: 1800, depth: 300 }, material: 'T18', base: 'kick', wallMounted: true, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [cell('open', 1, { shelves: 4 })] }], ...p })

const PLANS: Record<string, CabinetPlan> = {
  bookcase: plan({ name: 'Librero' }),
  nightstand: plan({ name: 'Buró', dimensions: { width: 450, height: 550, depth: 400 }, base: 'floor', wallMounted: false, columns: [{ width: 1, cells: [cell('open', 0.6, { shelves: 0 }), cell('drawer', 0.4)] }] }),
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
    expect(notes).toEqual([])
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

describe('construction variants', () => {
  const options: { [K in keyof CabinetConstruction]: CabinetConstruction[K][] } = {
    doors: ['overlay', 'inset'],
    drawerFronts: ['inset', 'overlay'],
    top: ['between', 'over'],
    back: ['nailed', 'none'],
    shelves: ['movable', 'fixed'],
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
    expect(notes).toEqual([])
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
    const hinges = (p: CabinetPlan) => Object.fromEntries(buildCabinet(p, testCatalog).design.joints.filter((u) => u.type === 'cup-hinge').map((u) => [u.a, `${u.b} ${u.hardware[0]?.hardwareId}`]))
    expect(hinges(PLANS.wallCabinet)).toEqual({ 'c1-h1-door-left': 'side-left cup-hinge-35-full', 'c1-h1-door-right': 'side-right cup-hinge-35-full' })
    const twoColumns = plan({ name: 'Alacena doble', dimensions: { width: 1000, height: 720, depth: 320 }, base: 'floor', columns: [{ width: 1, cells: [cell('door', 1, { doors: 1 })] }, { width: 1, cells: [cell('door', 1, { doors: 1 })] }] })
    expect(hinges(twoColumns)).toEqual({ 'c1-h1-door': 'div-1 cup-hinge-35-half', 'c2-h1-door': 'div-1 cup-hinge-35-half' })
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
