import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import type { Design } from '../design/schema'
import { exampleWallCabinet } from '../fixtures/wallCabinet'
import { exampleNightstand } from '../fixtures/nightstand'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { newCriticals } from './review'
import { maxSpan, deflection, deflectionSeverity } from './rules/deflection'

const findings = (d: Design) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(JSON.stringify(a.errors))
  return a.findings
}

describe('R1 shelf sag', () => {
  it('reproduces the numbers of the proposal (18 mm, 300 deep, books, grain along)', () => {
    expect(deflection(600, 300, 18, 'heavy', 6000)).toBeCloseTo(1.28, 1)
    expect(deflection(900, 300, 18, 'heavy', 6000)).toBeCloseTo(6.47, 1)
    expect(deflection(441, 300, 18, 'heavy', 6000)).toBeCloseTo(0.37, 1)
    expect(deflection(600, 300, 15, 'heavy', 6000)).toBeCloseTo(2.21, 1)
  })

  it('grades by span', () => {
    expect(deflectionSeverity(1.28, 600)).toBeNull()
    expect(deflectionSeverity(2.21, 600)).toBe('recommendation')
    expect(deflectionSeverity(6.47, 900)).toBe('critical')
  })

  it('the longest span leaves the sag right at the recommended limit', () => {
    const span = maxSpan(300, 18, 'heavy', 6000)
    expect(deflection(span, 300, 18, 'heavy', 6000)).toBeCloseTo(span / 360, 5)
  })

  it('the bookcase widened to 90 cm is critical and proposes a center divider', () => {
    const wide = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 900 } }
    const r1 = findings(wide).filter((h) => h.code === 'R1_SAG')
    expect(r1.map((h) => h.pieces[0]).sort()).toEqual(['bottom', 'shelf-1', 'shelf-2', 'shelf-3', 'shelf-4'])
    expect(r1.every((h) => h.severity === 'critical')).toBe(true)
    const divider = r1[0].alternatives.find((a) => a.key === 'center-divider')!
    expect(divider.data.sag).toBeLessThan(1)
  })

  it('takes the lower modulus when the grain runs across', () => {
    const d = structuredClone(exampleBookcase)
    d.dimensions.width = 800
    const withGrain = findings(d).find((h) => h.pieces[0] === 'shelf-1')
    d.pieces.find((p) => p.id === 'shelf-1')!.grain = 'width'
    const againstGrain = findings(d).find((h) => h.pieces[0] === 'shelf-1')!
    expect(Number(againstGrain.data.sag)).toBeGreaterThan(Number(withGrain?.data.sag ?? 0))
  })
})

describe('R2 thickness per joint', () => {
  it('asks for at least 15 mm for a dowel and 15 mm to take an edge screw', () => {
    const d = structuredClone(exampleNightstand)
    for (const p of d.pieces) if (p.role === 'side') p.material = 'T12'
    const r2 = findings(d).filter((h) => h.code === 'R2_JOINT_THICKNESS')
    const byJoint = Object.fromEntries(r2.map((h) => [h.data.joint, h.severity]))
    expect(byJoint['j-shelf-left']).toBe('critical')
    expect(byJoint['j-top-left']).toBe('recommendation')
    expect(r2[0].alternatives[0].data.material).toBe('T15')
  })

  it('does not take screws in a 3 mm back', () => {
    const d = structuredClone(exampleNightstand)
    d.joints = d.joints.map((u) => (u.id === 'j-back-bottom' ? { ...u, type: 'butt-screw' } : u))
    expect(findings(d).some((h) => h.code === 'R2_JOINT_THICKNESS' && h.data.piece === 'back')).toBe(true)
  })
})

describe('R5 racking', () => {
  it('the fixtures with a fixed 6 mm back are fine', () => {
    expect(findings(exampleBookcase)).toEqual([])
    expect(findings(exampleWallCabinet).filter((h) => h.code === 'R5_RACKING')).toEqual([])
  })

  it('the nightstand with a nailed 3 mm back is a recommendation because it is low', () => {
    expect(findings(exampleNightstand).map((h) => [h.code, h.severity])).toEqual([['R5_RACKING', 'recommendation']])
  })

  it('is critical in a tall piece', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.find((p) => p.id === 'back')!.material = 'TR3'
    expect(findings(d).find((h) => h.code === 'R5_RACKING')?.severity).toBe('critical')
  })
})

describe('newCriticals', () => {
  it('counts only those that were not there before', () => {
    const before = findings({ ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 900 } })
    const after = findings({ ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 1000 } })
    expect(newCriticals(before, after)).toEqual([])
    expect(newCriticals([], after).length).toBe(5)
  })
})
