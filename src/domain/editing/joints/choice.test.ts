import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { testCatalog } from '../../furniture/fixtures/catalog.test-util'
import { buildCabinet, CabinetPlan, DEFAULT_CONSTRUCTION } from '../../furniture/modules/cabinet'
import { estimatePurchase } from '../../estimate/purchase'
import { applyOperations } from '../operations/apply'
import { completeJoints } from '../../design/joints'
import { normalize } from '../../design/normalize'
import { rebuildFromPlan } from '../../furniture/modules/rebuild'
import { chooseJoint, followChoice, jointGroups } from './choice'

const cabinet = (extra: Partial<CabinetPlan> = {}): CabinetPlan => ({
  kind: 'cabinet',
  name: 'Cajonera',
  dimensions: { width: 500, height: 900, depth: 450 },
  material: 'T18',
  base: 'kick',
  legHeight: 150,
  wallMounted: false,
  construction: DEFAULT_CONSTRUCTION,
  columns: [{ width: 1, cells: [{ height: 1, content: 'open', shelves: 1, doors: null }, { height: 1, content: 'drawer', shelves: null, doors: null }] }],
  ...extra,
})

function built(extra: Partial<CabinetPlan> = {}) {
  const design = buildCabinet(cabinet(extra), testCatalog).design
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
  return { design, geo: a.geo }
}

describe('joint groups', () => {
  it('splits a cabinet into body, base, back and drawers, each with the joint most of it has', () => {
    const groups = jointGroups(built().design)
    expect(groups.map((g) => [g.id, g.label, g.current])).toEqual([
      ['body', 'Cuerpo: laterales con piso y techo', 'butt-screw'],
      ['base', 'Base: zoclo', 'butt-screw'],
      ['back', 'Trasera', 'glue-nail'],
      ['drawers', 'Cajones', 'butt-screw'],
    ])
  })

  it('leaves out hinges, runners, shelf pins and the drawer bottom', () => {
    const joints = jointGroups(built().design).flatMap((g) => g.joints)
    expect(joints.some((u) => ['cup-hinge', 'drawer-slide', 'shelf-pin'].includes(u.type))).toBe(false)
    expect(joints.some((u) => u.a.endsWith('-bottom') && u.a.startsWith('drawer-'))).toBe(false)
  })
})

describe('choosing a joint', () => {
  it('changes the type and the hardware of every joint in the group, and what there is to buy', () => {
    const { design, geo } = built()
    const choice = chooseJoint(design, geo, 'body', 'pocket-screw', testCatalog)
    expect(choice.findings).toEqual([])
    const applied = applyOperations(design, choice.operations, testCatalog)
    if (!applied.ok) throw new Error('not applied')
    const body = jointGroups(applied.value.design).find((g) => g.id === 'body')!
    expect(new Set(body.joints.map((u) => u.type))).toEqual(new Set(['pocket-screw']))
    expect(body.joints.every((u) => u.hardware.length === 1 && u.hardware[0].hardwareId.startsWith('pocket-screw'))).toBe(true)
    const other = jointGroups(applied.value.design).find((g) => g.id === 'drawers')!
    expect(other.current).toBe('butt-screw')
    const bought = (d: typeof design) => estimatePurchase(d, geo, testCatalog).hardware.map((h) => h.hardware.role)
    expect(bought(design)).not.toContain('pocket-screw')
    expect(bought(applied.value.design)).toContain('pocket-screw')
  })

  it('finds with R2 a joint too thick for the boards, and nothing when they are thick enough', () => {
    const thin = built({ material: 'T12' })
    const choice = chooseJoint(thin.design, thin.geo, 'body', 'dowel', testCatalog)
    expect(choice.findings.length).toBeGreaterThan(0)
    expect(choice.findings.every((f) => f.code === 'R2_JOINT_THICKNESS' && f.severity === 'critical')).toBe(true)
    expect(choice.findings[0].message).toMatch(/tarugo necesita al menos 15 mm/)
    const thick = built()
    expect(chooseJoint(thick.design, thick.geo, 'body', 'dowel', testCatalog).findings).toEqual([])
  })

  it('a plugged dowel takes the same dowels to buy as a hidden one and keeps the cut list', () => {
    const { design, geo } = built()
    const through = (type: 'dowel' | 'plugged-dowel') => {
      const applied = applyOperations(design, chooseJoint(design, geo, 'body', type, testCatalog).operations, testCatalog)
      if (!applied.ok) throw new Error('not applied')
      return applied.value.design
    }
    const [hidden, plugged] = [through('dowel'), through('plugged-dowel')]
    const dowels = (d: typeof design) => estimatePurchase(d, geo, testCatalog).hardware.filter((h) => h.hardware.role === 'dowel').map((h) => h.count)
    expect(dowels(plugged)).toEqual(dowels(hidden))
    expect(dowels(plugged)[0]).toBeGreaterThan(0)
    expect(plugged.pieces).toEqual(hidden.pieces)
  })

  it('a connector bolt joins without glue, two bolts to a short joint, and needs 18 mm to take its nut', () => {
    const { design, geo } = built()
    const choice = chooseJoint(design, geo, 'body', 'connector-bolt', testCatalog)
    expect(choice.findings).toEqual([])
    const applied = applyOperations(design, choice.operations, testCatalog)
    if (!applied.ok) throw new Error('not applied')
    const body = jointGroups(applied.value.design).find((g) => g.id === 'body')!.joints
    expect(body.every((u) => u.type === 'connector-bolt' && !u.glue && u.hardware[0].hardwareId === 'connector-bolt-m6')).toBe(true)
    const bolts = estimatePurchase(applied.value.design, geo, testCatalog).hardware.find((h) => h.hardware.role === 'connector-bolt')!
    expect(bolts.count).toBe(2 * body.length)
    const thin = built({ material: 'T15' })
    expect(chooseJoint(thin.design, thin.geo, 'body', 'connector-bolt', testCatalog).findings[0]).toMatchObject({ code: 'R2_JOINT_THICKNESS', severity: 'critical' })
  })

  it('a minifix comes with two loose dowels to a joint, and as few to a joint as a bolt', () => {
    const { design, geo } = built()
    const applied = applyOperations(design, chooseJoint(design, geo, 'body', 'cam-lock', testCatalog).operations, testCatalog)
    if (!applied.ok) throw new Error('not applied')
    const body = jointGroups(applied.value.design).find((g) => g.id === 'body')!.joints
    expect(body.every((u) => !u.glue && u.hardware.map((h) => [h.hardwareId, h.count]).join() === 'cam-lock-15,,dowel-8x40,2')).toBe(true)
    const count = (role: string) => estimatePurchase(applied.value.design, geo, testCatalog).hardware.find((h) => h.hardware.role === role)!.count
    expect([count('cam-lock'), count('dowel')]).toEqual([2 * body.length, 2 * body.length])
  })

  it('asks for nothing when the group already has that joint', () => {
    const { design, geo } = built()
    expect(chooseJoint(design, geo, 'back', 'glue-nail', testCatalog).operations).toEqual([])
  })
})

describe('a choice is of the group', () => {
  const bookcase = (shelves: number) =>
    cabinet({ dimensions: { width: 700, height: 1200, depth: 300 }, construction: { ...DEFAULT_CONSTRUCTION, shelves: 'fixed' }, columns: [{ width: 1, cells: [{ height: 1, content: 'open', shelves, doors: null }] }] })
  const dowelled = () => {
    const { design, geo } = built(bookcase(1))
    return { design, operations: chooseJoint(design, geo, 'body', 'dowel', testCatalog).operations }
  }
  const body = (design: Parameters<typeof jointGroups>[0]) => jointGroups(design).find((g) => g.id === 'body')!.joints.map((u) => u.type)

  it('the shelves a ficha gains later are joined as the body was chosen, with their dowels', () => {
    const { design } = rebuildFromPlan(bookcase(3), dowelled().operations, testCatalog)
    expect(new Set(body(design))).toEqual(new Set(['dowel']))
    expect(jointGroups(design).find((g) => g.id === 'body')!.joints.every((u) => u.hardware[0]?.hardwareId.startsWith('dowel'))).toBe(true)
    expect(jointGroups(design).find((g) => g.id === 'back')!.current).toBe('glue-nail')
  })

  it('a piece added by hand is joined as its group was chosen', () => {
    const { design, operations } = dowelled()
    const chosen = applyOperations(design, operations, testCatalog)
    if (!chosen.ok) throw new Error('not applied')
    const shelf = chosen.value.design.pieces.find((p) => p.role === 'shelf')!
    const lower = { ...shelf, id: 'shelf-x', y: { ...shelf.y, start: { type: 'ref' as const, ref: 'bottom.y1' as const, offset: 200 } } }
    const added = applyOperations(chosen.value.design, [{ op: 'addPiece', piece: lower }], testCatalog)
    if (!added.ok) throw new Error(JSON.stringify(added.errors))
    const joined = completeJoints(normalize(added.value.design, testCatalog), testCatalog, chosen.value.design)
    expect(body(joined)).toContain('butt-screw')
    expect(new Set(body(followChoice(joined, new Set(chosen.value.design.joints.map((u) => u.id)), testCatalog)))).toEqual(new Set(['dowel']))
  })

  it('one joint changed alone is not a choice: the rest of its group stays as it was', () => {
    const [one] = dowelled().operations
    const { design } = rebuildFromPlan(bookcase(3), [one], testCatalog)
    expect(body(design).filter((type) => type === 'dowel')).toHaveLength(1)
  })
})
