import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { exampleWallCabinet } from '../fixtures/wallCabinet'
import { exampleNightstand } from '../fixtures/nightstand'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import type { Design } from './schema'
import { completeJoints } from './joints'

const signature = (d: Design) => d.joints.map((u) => `${u.a} → ${u.b} ${u.type}`).sort()
const criticals = (d: Design) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return a.findings.filter((h) => h.severity === 'critico')
}

describe('completeJoints', () => {
  it('without joints, rebuilds the hand-made ones of the fixtures except the special ones', () => {
    expect(signature(completeJoints({ ...exampleWallCabinet, joints: [] }, testCatalog))).toEqual(signature(exampleWallCabinet))
    // The fixture kick plate uses pocket screws and the nightstand shelf uses dowels: the expert declares those.
    const withoutKick = signature(exampleBookcase).filter((u) => !u.startsWith('zoclo → lat'))
    expect(signature(completeJoints({ ...exampleBookcase, joints: [] }, testCatalog))).toEqual([...withoutKick, 'lat-der → zoclo butt-screw', 'lat-izq → zoclo butt-screw'].sort())
    const withoutDowels = signature(exampleNightstand).filter((u) => !u.includes('dowel'))
    expect(signature(completeJoints({ ...exampleNightstand, joints: [] }, testCatalog))).toEqual([...withoutDowels, 'lat-der → entrepano butt-screw', 'lat-izq → entrepano butt-screw'].sort())
  })

  it.each([exampleBookcase, exampleNightstand, exampleWallCabinet])('what it infers passes the structural review without criticals: $nombre', (diseno) => {
    expect(criticals(completeJoints({ ...diseno, joints: [] }, testCatalog))).toEqual([])
  })

  it('keeps the joints the expert declared and picks a screw that bites 25 mm into the edge', () => {
    const pocket = exampleBookcase.joints.filter((u) => u.b === 'lat-izq' && u.a === 'zoclo')
    const d = completeJoints({ ...exampleBookcase, joints: pocket }, testCatalog)
    expect(d.joints.filter((u) => [u.a, u.b].sort().join() === 'lat-izq,zoclo')).toEqual(pocket)
    expect(d.joints.find((u) => u.a === 'lat-izq' && u.b === 'piso')?.hardware).toEqual([{ hardwareId: 'tornillo-8x2', count: null }])
  })

  it('given the previous design, does not bring back a joint removed on purpose', () => {
    const withoutOne = { ...exampleBookcase, joints: exampleBookcase.joints.filter((u) => u.id !== 'u-trasera-techo') }
    expect(completeJoints(withoutOne, testCatalog, exampleBookcase).joints).toHaveLength(withoutOne.joints.length)
    expect(completeJoints(withoutOne, testCatalog).joints).toHaveLength(exampleBookcase.joints.length)
  })

  it('pieces the model grouped into parts still get their joints; only drawer parts are skipped', () => {
    const grouped = { ...exampleBookcase, joints: [], pieces: exampleBookcase.pieces.map((p) => ({ ...p, grupo: 'casco' })) }
    expect(signature(completeJoints(grouped, testCatalog))).toEqual(signature(completeJoints({ ...exampleBookcase, joints: [] }, testCatalog)))
  })

  it('is deterministic', () => {
    const empty = { ...exampleBookcase, joints: [] }
    expect(completeJoints(empty, testCatalog)).toEqual(completeJoints(structuredClone(empty), testCatalog))
  })
})
