import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import type { Design } from '../../design/schema'
import { applyOperations } from '../../editing/operations/apply'
import { testCatalog } from '../../furniture/fixtures/catalog.test-util'
import { buildBed, type BedPlan } from '../../furniture/modules/bed'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetConstruction, type CabinetPlan, type PlanCell } from '../../furniture/modules/cabinet'

const cell = (content: PlanCell['content'], extra: Partial<PlanCell> = {}): PlanCell => ({ height: 1, content, shelves: 0, doors: null, ...extra })
/** A cabinet that says no pull, unless told otherwise: one that does not say gets its notches. */
const cabinet = (cells: PlanCell[], construction: Partial<CabinetConstruction> = {}, columns = 1): Design => {
  const plan: CabinetPlan = { kind: 'cabinet', name: 'Mueble', dimensions: { width: 500 * columns, height: 700, depth: 400 }, material: 'T18', base: 'kick', legHeight: 150, wallMounted: true, construction: { ...DEFAULT_CONSTRUCTION, pulls: 'none', ...construction }, columns: Array.from({ length: columns }, () => ({ width: 1, cells })) }
  return buildCabinet(plan, testCatalog).design
}
const stuck = (design: Design) => {
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return a.findings.filter((f) => f.check === 'front.pull')
}

describe('a front with no way to be opened', () => {
  it('an inset door with no pull is a recommendation that names it; with a notch or a handle it is not', () => {
    const door = [cell('door', { doors: 1 })]
    expect(stuck(cabinet(door, { doors: 'inset' }))).toEqual([
      expect.objectContaining({ code: 'R10_USE', severity: 'recommendation', pieces: ['c1-h1-door'], alternatives: [], message: 'Puerta queda al ras dentro de su hueco y no tiene muesca ni jaladera: no hay de dónde jalar para abrir. Ponle una muesca o una jaladera.' }),
    ])
    expect(stuck(cabinet(door, { doors: 'inset', pulls: 'notch' }))).toEqual([])
    expect(stuck(cabinet(door, { doors: 'inset', pulls: 'handle' }))).toEqual([])
  })

  it('two inset leaves close each other in: both are named, in one finding', () => {
    const [found] = stuck(cabinet([cell('door', { doors: 2 })], { doors: 'inset' }))
    expect(found.pieces).toEqual(['c1-h1-door-left', 'c1-h1-door-right'])
    expect(found.message).toMatch(/^Puerta izquierda y Puerta derecha quedan al ras/)
  })

  it('an overlay door with no pull is not reported, alone or beside another: an edge of it stays free', () => {
    expect(stuck(cabinet([cell('door', { doors: 1 })]))).toEqual([])
    expect(stuck(cabinet([cell('door', { doors: 2 })], {}, 3))).toEqual([])
  })

  it('a drawer front likewise: inset with no pull is reported, with a pull or overlay it is not', () => {
    const drawers = [cell('drawer', { height: 0.5 }), cell('drawer', { height: 0.5 })]
    const [found] = stuck(cabinet(drawers))
    expect(found.pieces).toEqual(['drawer-1-front', 'drawer-2-front'])
    expect(stuck(cabinet(drawers, { pulls: 'notch' }))).toEqual([])
    expect(stuck(cabinet(drawers, { pulls: 'handle' }))).toEqual([])
    expect(stuck(cabinet(drawers, { drawerFronts: 'overlay' }))).toEqual([])
  })

  it('only the fronts left without a pull are named when a cell chooses its own', () => {
    const [found] = stuck(cabinet([cell('drawer', { height: 0.5, own: { pulls: 'notch' } }), cell('drawer', { height: 0.5 })]))
    expect(found.pieces).toHaveLength(1)
  })

  it('a sliding leaf and a lid are left out, and a design with no fronts gives nothing', () => {
    expect(stuck(cabinet([cell('door', { doors: 2 })], { doors: 'sliding', top: 'over' }, 2))).toEqual([])
    expect(stuck(cabinet([cell('chest', { height: 0.5 }), cell('open', { height: 0.5 })], { doors: 'inset' }))).toEqual([])
    expect(stuck(cabinet([cell('open', { shelves: 2 })]))).toEqual([])
  })

  it('a plan that does not say its pulls is not reported: its inset fronts take a notch', () => {
    expect(stuck(cabinet([cell('door', { height: 0.5, doors: 2 }), cell('drawer', { height: 0.5 })], { doors: 'inset', pulls: undefined }))).toEqual([])
  })

  it('a drawer added piece by piece is not reported, and it is once its notch is taken away', () => {
    const open = cabinet([cell('open', { height: 0.5 }), cell('open', { height: 0.5 })])
    const added = applyOperations(open, [{ op: 'addDrawer', group: 'drawer-1', name: 'Cajón 1', left: 'side-left.x1', right: 'side-right.x0', bottom: 'bottom.y1', top: 'c1-sep-1.y0', front: 'side-left.z1', back: 'back.z1', material: 'T18', bottomMaterial: 'TR6' }], testCatalog)
    if (!added.ok) throw new Error(added.errors[0].message)
    expect(stuck(added.value.design)).toEqual([])
    expect(stuck({ ...added.value.design, pullsOf: undefined }).flatMap((f) => f.pieces)).toEqual(['drawer-1-front'])
  })

  it('the drawers under a bed: inset with no pull are reported, overlay ones are not', () => {
    const bed: BedPlan = { kind: 'bed', name: 'Cama', mattress: 'individual', material: 'T18', height: 400, legs: 'none', legHeight: 150, drawers: { side: 'left', count: 2, position: 'center' }, headboard: { style: 'none', height: 400, depth: 0, shelves: 0 } }
    const drawn = (drawers: Partial<BedPlan['drawers']>) => stuck(buildBed({ ...bed, drawers: { ...bed.drawers, ...drawers } }, testCatalog).design).flatMap((f) => f.pieces)
    expect(drawn({ pulls: 'none' })).toEqual(['drawer-left-1-front', 'drawer-left-2-front'])
    expect(drawn({ pulls: 'notch' })).toEqual([])
    expect(drawn({ mount: 'overlay', pulls: 'none' })).toEqual([])
  })
})
