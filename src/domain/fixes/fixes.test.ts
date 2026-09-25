import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import type { Design } from '../design/schema'
import type { RuleCode } from '../structure/finding'
import { exampleWallCabinet } from '../fixtures/wallCabinet'
import { exampleNightstand } from '../fixtures/nightstand'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { fixesFor, fixesForNotice } from './fixes'

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

  it('a joint too thin on one side thickens only that piece, not the one it joins', () => {
    const thinTop = { ...exampleBookcase, pieces: exampleBookcase.pieces.map((p) => (p.id === 'top' ? { ...p, material: 'T12' } : p)) }
    const thin = findings(thinTop).find((h) => h.code === 'R2_JOINT_THICKNESS' && h.data.piece === 'top')!
    expect(thin.pieces).toEqual(expect.arrayContaining(['top', 'side-left']))
    const fix = fixesFor(thinTop, testCatalog, thin).find((f) => f.key === 'thicker-board')!
    expect(fix.operations).toEqual([{ op: 'changeMaterial', ids: ['top'], material: 'T15' }])
    const material = (id: string) => fix.design.pieces.find((p) => p.id === id)!.material
    expect([material('top'), material('side-left'), material('side-right')]).toEqual(['T15', 'T18', 'T18'])
  })

  it('a notice with several joints too thin thickens each thin piece once, and none of the pieces they join', () => {
    const thin = { ...exampleBookcase, pieces: exampleBookcase.pieces.map((p) => (p.id === 'top' || p.id === 'bottom' ? { ...p, material: 'T12' } : p)) }
    const tooThin = findings(thin).filter((h) => h.code === 'R2_JOINT_THICKNESS' && (h.data.piece === 'top' || h.data.piece === 'bottom'))
    expect(new Set(tooThin.map((h) => h.data.piece))).toEqual(new Set(['top', 'bottom']))
    const fix = fixesForNotice(thin, testCatalog, tooThin).find((f) => f.key === 'thicker-board')!
    expect(fix.operations).toHaveLength(1)
    expect(new Set(fix.operations.flatMap((o) => (o.op === 'changeMaterial' ? o.ids : [])))).toEqual(new Set(['top', 'bottom']))
    const material = (id: string) => fix.design.pieces.find((p) => p.id === id)!.material
    expect([material('side-left'), material('side-right')]).toEqual(['T18', 'T18'])
  })

  it('a sagging shelf can take a thicker board: every piece of the finding changes', () => {
    const wide = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 1000 }, pieces: exampleBookcase.pieces.map((p) => (p.id.startsWith('shelf-') ? { ...p, material: 'T15' } : p)) }
    const sag = findings(wide).find((h) => h.code === 'R1_SAG' && h.pieces.every((id) => id.startsWith('shelf-')))!
    const fix = fixesFor(wide, testCatalog, sag).find((f) => f.key === 'thicker-board')!
    expect(fix.operations).toEqual([{ op: 'changeMaterial', ids: sag.pieces, material: 'T18' }])
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

  it('the rigid rail takes the pocket screw for its board: 1" in 15 mm', () => {
    const thin = { ...exampleNightstand, pieces: exampleNightstand.pieces.map((p) => (p.material === 'T18' ? { ...p, material: 'T15' } : p)) }
    const racking = finding(thin, 'R5_RACKING')
    const fix = fixesFor(thin, testCatalog, racking).find((f) => f.key === 'rigid-apron')!
    expect(fix.design.joints.filter((u) => u.type === 'pocket-screw').flatMap((u) => u.hardware.map((h) => h.hardwareId))).toEqual(['pocket-screw-1', 'pocket-screw-1'])
    expect(findings(fix.design).some((h) => h.code === 'R3_SCREWS')).toBe(false)
  })

  it('a tall piece is anchored to the wall', () => {
    const loose = { ...exampleBookcase, wallAnchored: false }
    const [fix] = fixesFor(loose, testCatalog, finding(loose, 'R4_TIPPING'))
    expect(fix.design.wallAnchored).toBe(true)
  })
})
