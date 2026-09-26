import { describe, expect, it } from 'vitest'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import { exampleWallCabinet } from '../furniture/fixtures/wallCabinet'
import { exampleBookcase } from '../furniture/fixtures/bookcase'
import { hardwareByRole } from '../materials/catalog'
import { makeJoint } from './builders'
import { completeJoints } from './joints'
import { JOINTS } from './jointSpecs'
import { JointType, type Design } from './schema'

describe('joint registry', () => {
  it('describes every joint type, with a name for the person', () => {
    expect(Object.keys(JOINTS).sort()).toEqual([...JointType.options].sort())
    for (const spec of Object.values(JOINTS)) {
      expect(spec.label.singular).not.toBe('')
      expect(spec.label.plural).not.toBe('')
    }
  })

  it('every hardware a joint takes is in the catalog', () => {
    const missing = JointType.options.filter((t) => JOINTS[t].hardware && !hardwareByRole(testCatalog, JOINTS[t].hardware!).length)
    expect(missing).toEqual([])
  })

  it('keeps what the rules knew: the rigid joints, the ones that hold a back and the ones without glue', () => {
    const where = (f: (s: (typeof JOINTS)[JointType]) => boolean) => JointType.options.filter((t) => f(JOINTS[t]))
    expect(where((s) => s.rigid)).toEqual(['pocket-screw', 'dowel', 'cam-lock', 'dado', 'rabbet', 'bracket'])
    expect(where((s) => s.holdsThinBoard)).toEqual(['dado', 'rabbet', 'glue-nail'])
    expect(where((s) => !s.glue)).toEqual(['shelf-pin', 'cup-hinge', 'drawer-slide'])
    expect(JointType.options.filter((t) => !makeJoint('j', 'a', 'b', t).glue)).toEqual(['shelf-pin', 'cup-hinge', 'drawer-slide'])
  })

  it('keeps the minimum thicknesses', () => {
    expect(JOINTS['butt-screw'].minThickness).toEqual({ b: 15, bCritical: 12 })
    expect(JOINTS['pocket-screw'].minThickness).toEqual({ a: 12, b: 12 })
    expect(JOINTS['cup-hinge'].minThickness).toEqual({ a: 15 })
    expect(JointType.options.filter((t) => JOINTS[t].minThickness === null)).toEqual(['bracket', 'glue-nail', 'drawer-slide'])
  })
})

describe('inferred joints pick their hardware by role', () => {
  const hardwareOf = (d: Design) => d.joints.map((u) => `${u.a} → ${u.b} ${u.hardware.map((h) => h.hardwareId).join()}`).sort()

  it('the same items the hand-made fixtures name', () => {
    expect(hardwareOf(completeJoints({ ...exampleWallCabinet, joints: [] }, testCatalog))).toEqual(hardwareOf(exampleWallCabinet))
    const inferred = completeJoints({ ...exampleBookcase, joints: [] }, testCatalog)
    const handMade = new Set(hardwareOf(exampleBookcase))
    expect(hardwareOf(inferred).filter((u) => !u.includes('kick')).every((u) => handMade.has(u))).toBe(true)
  })

  it('with no item of the role in the catalog, the joint goes without hardware', () => {
    const catalog = { ...testCatalog, hardware: testCatalog.hardware.filter((h) => h.role !== 'hinge' && h.role !== 'nail') }
    const d = completeJoints({ ...exampleWallCabinet, joints: [] }, catalog)
    expect(d.joints.filter((u) => u.type === 'cup-hinge' || u.type === 'glue-nail').flatMap((u) => u.hardware)).toEqual([])
  })
})
