import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { testCatalog } from '../fixtures/catalog.test-util'
import type { Cell } from '../reading/reading'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetConstruction, type CabinetPlan } from './cabinet'

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

  it.each(combos.map((c) => [Object.values(c).join(' · '), c] as const))('%s is valid, with nothing overlapping and every contact joined', (_, construction) => {
    const { design, notes } = buildCabinet({ ...mixed, construction }, testCatalog)
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
