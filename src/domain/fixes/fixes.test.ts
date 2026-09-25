import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import type { Design } from '../diseno/schema'
import type { RuleCode } from '../structure/finding'
import { exampleWallCabinet } from '../fixtures/wallCabinet'
import { exampleNightstand } from '../fixtures/nightstand'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { fixesFor } from './fixes'

const findings = (d: Design) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return a.findings
}
const finding = (d: Design, code: RuleCode) => findings(d).find((h) => h.code === code)!

describe('fixesFor', () => {
  it('a sagging shelf gets a support under its middle, and stops sagging', () => {
    const wide = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 1100 } }
    const sag = finding(wide, 'R1_SAG')
    const fix = fixesFor(wide, testCatalog, sag).find((f) => f.key === 'center-divider')!
    expect(fix.design.pieces.some((p) => p.id === `support-${sag.pieces[0]}`)).toBe(true)
    expect(findings(fix.design).some((h) => h.code === 'R1_SAG' && h.pieces.includes(sag.pieces[0]))).toBe(false)
  })

  it('a wall cabinet gets its hanging rail', () => {
    const rail = finding(exampleWallCabinet, 'R10_USE')
    const [fix] = fixesFor(exampleWallCabinet, testCatalog, rail)
    expect(fix.key).toBe('hanging-rail')
    expect(findings(fix.design).some((h) => h.code === 'R10_USE')).toBe(false)
  })

  it('a box that can rack gets a rigid rail with pocket screws, and is square', () => {
    const racking = finding(exampleNightstand, 'R5_RACKING')
    const fix = fixesFor(exampleNightstand, testCatalog, racking).find((f) => f.key === 'rigid-apron')!
    expect(fix.design.joints.filter((u) => u.type === 'pocket-screw')).toHaveLength(2)
    expect(findings(fix.design).some((h) => h.code === 'R5_RACKING')).toBe(false)
  })

  it('a tall piece is anchored to the wall', () => {
    const loose = { ...exampleBookcase, wallAnchored: false }
    const [fix] = fixesFor(loose, testCatalog, finding(loose, 'R4_TIPPING'))
    expect(fix.design.wallAnchored).toBe(true)
  })
})
