import { describe, expect, it } from 'vitest'
import { analyze } from '../checks/analysis'
import { exampleWallCabinet } from '../furniture/fixtures/wallCabinet'
import { exampleNightstand } from '../furniture/fixtures/nightstand'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../furniture/fixtures/bookcase'
import type { Design } from './schema'
import { completeJoints } from './joints'

const signature = (d: Design) => d.joints.map((u) => `${u.a} → ${u.b} ${u.type}`).sort()
const criticals = (d: Design) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return a.findings.filter((h) => h.severity === 'critical')
}

describe('completeJoints', () => {
  it('without joints, rebuilds the hand-made ones of the fixtures except the special ones', () => {
    expect(signature(completeJoints({ ...exampleWallCabinet, joints: [] }, testCatalog))).toEqual(signature(exampleWallCabinet))
    // The fixture kick plate uses pocket screws and the nightstand shelf uses dowels: the expert declares those.
    const withoutKick = signature(exampleBookcase).filter((u) => !u.startsWith('kick → side'))
    expect(signature(completeJoints({ ...exampleBookcase, joints: [] }, testCatalog))).toEqual([...withoutKick, 'side-right → kick butt-screw', 'side-left → kick butt-screw'].sort())
    const withoutDowels = signature(exampleNightstand).filter((u) => !u.includes('dowel'))
    expect(signature(completeJoints({ ...exampleNightstand, joints: [] }, testCatalog))).toEqual([...withoutDowels, 'side-right → shelf butt-screw', 'side-left → shelf butt-screw'].sort())
  })

  it.each([exampleBookcase, exampleNightstand, exampleWallCabinet])('what it infers passes the structural review without criticals: $name', (design) => {
    expect(criticals(completeJoints({ ...design, joints: [] }, testCatalog))).toEqual([])
  })

  it('keeps the joints the expert declared and picks a screw that bites 25 mm into the edge', () => {
    const pocket = exampleBookcase.joints.filter((u) => u.b === 'side-left' && u.a === 'kick')
    const d = completeJoints({ ...exampleBookcase, joints: pocket }, testCatalog)
    expect(d.joints.filter((u) => [u.a, u.b].sort().join() === 'kick,side-left')).toEqual(pocket)
    expect(d.joints.find((u) => u.a === 'side-left' && u.b === 'bottom')?.hardware).toEqual([{ hardwareId: 'screw-8x2', count: null }])
  })

  it('given the previous design, does not bring back a joint removed on purpose', () => {
    const withoutOne = { ...exampleBookcase, joints: exampleBookcase.joints.filter((u) => u.id !== 'j-back-top') }
    expect(completeJoints(withoutOne, testCatalog, exampleBookcase).joints).toHaveLength(withoutOne.joints.length)
    expect(completeJoints(withoutOne, testCatalog).joints).toHaveLength(exampleBookcase.joints.length)
  })

  it('pieces the model grouped into parts still get their joints; only drawer parts are skipped', () => {
    const grouped = { ...exampleBookcase, joints: [], pieces: exampleBookcase.pieces.map((p) => ({ ...p, group: 'carcass' })) }
    expect(signature(completeJoints(grouped, testCatalog))).toEqual(signature(completeJoints({ ...exampleBookcase, joints: [] }, testCatalog)))
  })

  it('is deterministic', () => {
    const empty = { ...exampleBookcase, joints: [] }
    expect(completeJoints(empty, testCatalog)).toEqual(completeJoints(structuredClone(empty), testCatalog))
  })
})
