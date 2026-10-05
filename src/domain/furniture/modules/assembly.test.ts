import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { isDrawerPart, type Design } from '../../design/schema'
import { estimatePurchase } from '../../estimate/purchase'
import { testCatalog } from '../fixtures/catalog.test-util'
import { needsKnockDown } from './assembly'
import { MODULES, buildPlan, FurniturePlan } from './plan'

const variants = (['bed', 'table', 'cabinet'] as const).flatMap((kind) => (MODULES[kind].benchVariants() as [string, FurniturePlan][]).map(([name, plan]) => [`${kind} · ${name}`, plan] as const))
const named = (name: string) => variants.find(([n]) => n === name)![1]
const built = (plan: FurniturePlan) => {
  const design = buildPlan(plan, testCatalog).design
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return { design, a }
}
const joint = (design: Design, x: string, y: string) => design.joints.find((u) => (u.a === x && u.b === y) || (u.a === y && u.b === x))!
const bought = (design: Design, a: ReturnType<typeof built>['a'], role: string) => estimatePurchase(design, a.geo, testCatalog).hardware.filter((h) => h.hardware.role === role).reduce((n, h) => n + h.count, 0)

describe('a piece knocked down', () => {
  const knockedDown = variants.filter(([, plan]) => 'assembly' in plan && plan.assembly !== 'glued')

  it.each(knockedDown)('%s: valid, nothing to warn about, and glued only in its drawers and its laminated legs', (_, plan) => {
    const { design, a } = built(plan)
    expect([...a.findings, ...a.warnings].map((f) => f.message)).toEqual([])
    const byId = new Map(design.pieces.map((p) => [p.id, p]))
    const glued = design.joints.filter((u) => u.glue && !isDrawerPart(byId.get(u.a)!) && !isDrawerPart(byId.get(u.b)!))
    expect(glued.filter((u) => !(u.a.startsWith('leg-') && u.b.startsWith('leg-'))).map((u) => u.id)).toEqual([])
  })

  it('has variants of every kind that takes it', () => {
    expect(new Set(knockedDown.map(([, plan]) => plan.kind))).toEqual(new Set(['bed', 'table', 'cabinet']))
  })

  it('bolts the frame of a daybed, and screws in place what is laid over it or rides on it', () => {
    const { design, a } = built(named('bed · individual, cama de día con copete y tope, desarmable con pernos'))
    for (const [x, y] of [['headboard', 'side-right-1'], ['foot-arm', 'side-right-1'], ['headboard', 'spine'], ['foot-arm', 'platform'], ['side-right-1', 'platform']])
      expect(joint(design, x, y)).toMatchObject({ type: 'connector-bolt', glue: false, hardware: [{ hardwareId: 'connector-bolt-m6', count: null }] })
    for (const [x, y] of [['platform', 'spine'], ['lip-left', 'platform'], ['head-cap', 'headboard'], ['back-cap', 'side-right-1']]) expect(joint(design, x, y)).toMatchObject({ type: 'butt-screw', glue: false })
    expect(joint(design, 'back-cap', 'side-right-1').a).toBe('back-cap')
    expect(bought(design, a, 'connector-bolt')).toBeGreaterThanOrEqual(2 * 7)
  })

  it('puts a minifix with two loose dowels at each corner of a bookcase, and screws its back on without glue', () => {
    const { design, a } = built(named('cabinet · librero desarmable con minifix'))
    const corners = [['side-left', 'top'], ['side-left', 'bottom'], ['side-right', 'top'], ['side-right', 'bottom']].map(([x, y]) => joint(design, x, y))
    for (const u of corners) expect(u).toMatchObject({ type: 'cam-lock', glue: false, hardware: [{ hardwareId: 'cam-lock-15', count: null }, { hardwareId: 'dowel-8x40', count: 2 }] })
    expect([bought(design, a, 'cam-lock'), bought(design, a, 'dowel'), bought(design, a, 'glue')]).toEqual([8, 8, 0])
    const back = design.joints.filter((u) => design.pieces.find((p) => p.id === u.a)?.role === 'back')
    expect(back.length).toBeGreaterThanOrEqual(3)
    expect(back.every((u) => u.type === 'butt-screw' && !u.glue)).toBe(true)
  })

  it('takes the minifix where a board is too thin for the nut of a bolt', () => {
    const { design } = built({ ...named('cabinet · librero desarmable con minifix'), material: 'T15', assembly: 'bolts' } as FurniturePlan)
    expect(joint(design, 'side-left', 'top').type).toBe('cam-lock')
    expect(design.joints.some((u) => u.type === 'connector-bolt')).toBe(false)
  })

  it('bolts the aprons of a table to its legs and screws the top down', () => {
    const { design } = built(named('table · comedor largo con patas, desarmable con pernos'))
    expect(joint(design, 'leg-front-left-2', 'apron-front')).toMatchObject({ type: 'connector-bolt', a: 'leg-front-left-2', glue: false })
    expect(joint(design, 'top', 'apron-front')).toMatchObject({ type: 'butt-screw', glue: false })
    expect(joint(design, 'leg-front-left-1', 'leg-front-left-2').glue).toBe(true)
  })

  it('builds a plan that does not say, or says glued, exactly as before', () => {
    const plan = named('bed · individual, cama de día con copete, tope y cajones sobrepuestos con jaladeras')
    const { assembly: _, ...old } = plan as FurniturePlan & { assembly?: string }
    expect(buildPlan(FurniturePlan.parse(old), testCatalog).design).toEqual(buildPlan({ ...plan, assembly: 'glued' } as FurniturePlan, testCatalog).design)
  })
})

describe('needsKnockDown', () => {
  it.each([
    ['a single daybed, too long to turn on a stair', { width: 1956, height: 830, depth: 1046 }, true],
    ['a wardrobe taller than a door that cannot be stood up', { width: 1000, height: 2250, depth: 600 }, true],
    ['a wardrobe that stands up but is over 1800', { width: 1000, height: 2200, depth: 580 }, true],
    ['a dining table wider than a door either way', { width: 1600, height: 850, depth: 900 }, true],
    ['a bookcase of 1800 that goes through sideways', { width: 900, height: 1800, depth: 300 }, false],
    ['a dining table that goes through on its side', { width: 1500, height: 750, depth: 900 }, false],
    ['a nightstand', { width: 450, height: 550, depth: 400 }, false],
  ])('%s', (_, dimensions, expected) => {
    expect(needsKnockDown(dimensions)).toBe(expected)
  })
})
