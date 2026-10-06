import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { isDrawerPart, type Design } from '../../design/schema'
import { estimatePurchase } from '../../estimate/purchase'
import { testCatalog } from '../fixtures/catalog.test-util'
import { fittedJoints, gluedBlocks, needsKnockDown } from './assembly'
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

  it.each(knockedDown)('%s: valid and nothing to warn about', (_, plan) => {
    const { a } = built(plan)
    expect([...a.findings, ...a.warnings].map((f) => f.message)).toEqual([])
  })

  it.each(['librero desarmable con minifix', 'cajonera desarmable con minifix', 'aparador con patas desarmable con pernos'])('cabinet · %s: goes through a door whole, so it is glued as one part and takes no fitting', (name) => {
    const { design, a } = built(named(`cabinet · ${name}`))
    expect(fittedJoints(design, a.geo)).toEqual([])
    expect(gluedBlocks(design)).toHaveLength(1)
    expect(design.joints.filter((u) => !u.glue && u.type === 'butt-screw').map((u) => u.id)).toEqual([])
  })

  it('knocks a cabinet that does not go through whole down to its boards, glued only in its drawers', () => {
    const { design } = built(named('cabinet · librero de 2250 mm, desarmable con minifix'))
    const byId = new Map(design.pieces.map((p) => [p.id, p]))
    expect(design.joints.filter((u) => u.glue && !isDrawerPart(byId.get(u.a)!) && !isDrawerPart(byId.get(u.b)!)).map((u) => u.id)).toEqual([])
  })

  it('glues each end of a table on legs and its long aprons apart, and bolts them at the four corners and the middle legs', () => {
    const { design, a } = built(named('table · comedor largo con patas, desarmable con pernos'))
    const blocks = gluedBlocks(design).map((pieces) => pieces.map((p) => p.id).sort())
    expect(blocks).toEqual(expect.arrayContaining([['apron-left', 'leg-back-left-1', 'leg-back-left-2', 'leg-front-left-1', 'leg-front-left-2'], ['apron-back', 'apron-front', 'rail-1', 'rail-2']]))
    expect(blocks.some((ids) => ids.includes('top'))).toBe(false)
    expect(fittedJoints(design, a.geo)).toHaveLength(8)
  })

  it('glues the pedestal of a desk to its end, and takes fittings only where the long aprons meet the ends', () => {
    const { design, a } = built(named('table · escritorio con 3 cajones a la izquierda, desarmable con minifix'))
    expect(gluedBlocks(design).map((pieces) => pieces.map((p) => p.id).sort())).toContainEqual(['ped-back', 'ped-bottom', 'ped-div', 'ped-kick', 'ped-sep-1', 'ped-sep-2', 'side-left'])
    expect(fittedJoints(design, a.geo).map(({ joint: u }) => `${u.a}>${u.b}`).sort()).toEqual(['ped-div>apron-back', 'ped-div>apron-front', 'side-right>apron-back', 'side-right>apron-front'])
  })

  it('glues a daybed in five parts: its base, each arm and the backrest with their caps, and the platform with its lip', () => {
    const { design } = built(named('bed · individual, cama de día con copete y tope, desarmable con pernos'))
    const blocks = gluedBlocks(design).map((pieces) => pieces.map((p) => p.id).sort())
    expect(blocks).toHaveLength(5)
    expect(blocks).toEqual(expect.arrayContaining([['head-cap', 'headboard'], ['foot-arm', 'foot-cap'], ['back-cap', 'side-right-1'], ['lip-left', 'platform']]))
    expect(blocks.find((ids) => ids.includes('spine'))).toEqual(expect.arrayContaining(['div-left-1', 'kick-left-1', 'rail-right-1-1']))
  })

  it('glues the base of a bed on legs whole, so only the headboard takes fittings', () => {
    const { design, a } = built(named('bed · matrimonial, cabecera lisa, patas de 150 mm, desarmable con pernos'))
    expect(fittedJoints(design, a.geo).map(({ joint: u }) => u.a)).toEqual(Array(5).fill('headboard'))
    expect(joint(design, 'side-left-1', 'rail-left-1-1')).toMatchObject({ type: 'butt-screw', glue: true })
    expect(joint(design, 'foot-panel', 'spine').glue).toBe(true)
  })

  it('glues a headboard with shelves as a box of its own, with fittings only where its sides meet the base', () => {
    const { design, a } = built(named('bed · queen, cabecera librero, cajones de los dos lados, desarmable con minifix'))
    expect(fittedJoints(design, a.geo).map(({ joint: u }) => `${u.a}>${u.b}`)).toEqual(['head-side-left>head-panel', 'head-side-right>head-panel'])
    expect(joint(design, 'head-side-left', 'head-top').glue).toBe(true)
    expect(joint(design, 'head-bottom', 'head-panel')).toMatchObject({ type: 'butt-screw', glue: false })
  })

  it('is one glued part when it is not knocked down', () => {
    const { design } = built(named('bed · individual, cama de día con copete, tope y cajones sobrepuestos con jaladeras'))
    expect(gluedBlocks(design)).toHaveLength(1)
  })

  it('has variants of every kind that takes it', () => {
    expect(new Set(knockedDown.map(([, plan]) => plan.kind))).toEqual(new Set(['bed', 'table', 'cabinet']))
  })

  it('bolts a daybed where its arms and backrest meet the base, and screws in place what crosses from one part to another', () => {
    const { design, a } = built(named('bed · individual, cama de día con copete y tope, desarmable con pernos'))
    for (const [x, y] of [['headboard', 'side-right-1'], ['foot-arm', 'side-right-1'], ['headboard', 'spine'], ['foot-arm', 'platform'], ['side-right-1', 'platform'], ['side-right-1', 'rail-right-1-1']])
      expect(joint(design, x, y)).toMatchObject({ type: 'connector-bolt', glue: false, hardware: [{ hardwareId: 'connector-bolt-m6', count: null }] })
    for (const [x, y] of [['platform', 'spine'], ['head-cap', 'side-right-1'], ['headboard', 'lip-left']]) expect(joint(design, x, y)).toMatchObject({ type: 'butt-screw', glue: false })
    for (const [x, y] of [['spine', 'div-left-1'], ['spine', 'rail-right-1-1'], ['lip-left', 'platform'], ['head-cap', 'headboard']]) expect(joint(design, x, y).glue).toBe(true)
    expect(bought(design, a, 'connector-bolt')).toBe(30)
  })

  it('puts a minifix with two loose dowels at each corner of a bookcase, and screws its back on without glue', () => {
    const { design, a } = built(named('cabinet · librero de 2250 mm, desarmable con minifix'))
    const corners = [['side-left', 'top'], ['side-left', 'bottom'], ['side-right', 'top'], ['side-right', 'bottom']].map(([x, y]) => joint(design, x, y))
    for (const u of corners) expect(u).toMatchObject({ type: 'cam-lock', glue: false, hardware: [{ hardwareId: 'cam-lock-15', count: null }, { hardwareId: 'dowel-8x40', count: 2 }] })
    expect([bought(design, a, 'cam-lock'), bought(design, a, 'dowel'), bought(design, a, 'glue')]).toEqual([8, 8, 0])
    const back = design.joints.filter((u) => design.pieces.find((p) => p.id === u.a)?.role === 'back')
    expect(back.length).toBeGreaterThanOrEqual(3)
    expect(back.every((u) => u.type === 'butt-screw' && !u.glue)).toBe(true)
  })

  it('lists the joints that take a fitting, with as many as the shopping list buys, and none in a glued one', () => {
    const { design, a } = built(named('bed · individual, cama de día con copete y tope, desarmable con pernos'))
    const fitted = fittedJoints(design, a.geo)
    expect(fitted.every(({ joint }) => joint.type === 'connector-bolt')).toBe(true)
    expect(fitted.map(({ joint }) => `${joint.a}>${joint.b}`)).toContain('headboard>platform')
    expect(fitted.reduce((n, f) => n + f.count, 0)).toBe(bought(design, a, 'connector-bolt'))
    const glued = built(named('bed · individual, cama de día con copete, tope y cajones sobrepuestos con jaladeras'))
    expect(fittedJoints(glued.design, glued.a.geo)).toEqual([])
  })

  it('takes the minifix where a board is too thin for the nut of a bolt', () => {
    const { design } = built({ ...named('cabinet · librero de 2250 mm, desarmable con minifix'), material: 'T15', assembly: 'bolts' } as FurniturePlan)
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
