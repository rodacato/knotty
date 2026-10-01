import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { testCatalog } from '../../furniture/fixtures/catalog.test-util'
import { buildCabinet, CabinetPlan, DEFAULT_CONSTRUCTION } from '../../furniture/modules/cabinet'
import { estimatePurchase } from '../../materials/purchase'
import { applyOperations } from '../operations/apply'
import { chooseJoint, jointGroups } from './choice'

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

  it('asks for nothing when the group already has that joint', () => {
    const { design, geo } = built()
    expect(chooseJoint(design, geo, 'back', 'glue-nail', testCatalog).operations).toEqual([])
  })
})
