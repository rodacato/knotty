import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import type { Design } from '../../design/schema'
import { faceSize } from '../../design/resolve'
import { gapBetween } from '../../design/validation/contact'
import { ASSUMPTIONS } from '../../assumptions'
import type { RuleCode } from '../../checks/structure/finding'
import { exampleWallCabinet } from '../../furniture/fixtures/wallCabinet'
import { exampleNightstand } from '../../furniture/fixtures/nightstand'
import { testCatalog } from '../../furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../../furniture/fixtures/bookcase'
import { buildPlan, FurniturePlan, MODULES } from '../../furniture/modules/plan'
import { applyOperations } from '../operations/apply'
import { fixForAlternative, fixesFor, fixesForNotice } from './fixes'

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

  it('legs too far apart get a support in the middle, under the bottom and between the aprons', () => {
    const sideboard = buildPlan(MODULES.cabinet.benchVariants().find(([name]) => name === 'aparador con patas')![1], testCatalog).design
    const drop = (id: string) => /^leg-(middle|rail)-/.test(id)
    const apart = { ...sideboard, pieces: sideboard.pieces.filter((p) => !drop(p.id)), joints: sideboard.joints.filter((u) => !drop(u.a) && !drop(u.b)) }
    const legs = findings(apart).find((h) => h.check === 'base.legs')!
    const fix = fixesFor(apart, testCatalog, legs).find((f) => f.key === 'center-support')!
    expect(fix.design.pieces.some((p) => p.id === 'support-bottom')).toBe(true)
    expect(findings(fix.design).some((h) => h.check === 'base.legs')).toBe(false)
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

describe('a support under a floor on a kick', () => {
  /** The open bookcase (GN-LIB-01) at another width: two columns of two openings with two shelves each, on a kick. */
  const bookcase = (width: number, columns: number[]) => {
    const cells = [0.55, 0.45].map((height) => ({ height, content: 'open', shelves: 2, doors: null }))
    const plan = FurniturePlan.parse({ kind: 'cabinet', name: 'Librero abierto', dimensions: { width, height: 1950, depth: 290 }, material: 'T18', base: 'kick', wallMounted: true, construction: { doors: 'overlay', drawerFronts: 'inset', top: 'between', back: 'nailed', shelves: 'movable', fronts: 'flat', hinges: 'outside', pulls: 'none' }, columns: columns.map((share) => ({ width: share, cells })), assembly: 'cams' })
    return buildPlan(plan, testCatalog).design
  }
  const sags = (d: Design) => findings(d).filter((h) => h.code === 'R1_SAG')
  const supportsOf = (d: Design, id: string) => d.pieces.filter((p) => p.id.startsWith(`support-${id}`))

  it('every piece of the notice stops being critical, the floor too: it sags on both sides of the support under its divider', () => {
    const wide = bookcase(2300, [1, 1])
    const critical = sags(wide).filter((h) => h.severity === 'critical')
    expect(critical.map((h) => h.pieces[0])).toEqual(['bottom', ...[1, 2].flatMap((c) => [1, 2].flatMap((h) => [1, 2].map((n) => `c${c}-h${h}-shelf-${n}`)))])
    expect(critical[0].data).toMatchObject({ span: 1123, sag: 20.2 })
    const fix = fixesForNotice(wide, testCatalog, critical).find((f) => f.key === 'center-divider')!
    expect(sags(fix.design).filter((h) => h.severity === 'critical')).toEqual([])
    expect(sags(fix.design).some((h) => h.pieces.includes('bottom'))).toBe(false)
    expect(supportsOf(fix.design, 'bottom')).toHaveLength(2)
    expect(fixForAlternative(wide, testCatalog, critical, 'center-divider')).not.toBeNull()
  })

  it('only the half that sags gets one, and a shelf gets one alone', () => {
    const uneven = bookcase(1740, [2, 1])
    const critical = sags(uneven).filter((h) => h.severity === 'critical')
    expect(critical.map((h) => h.pieces[0])).toContain('bottom')
    const fix = fixesForNotice(uneven, testCatalog, critical).find((f) => f.key === 'center-divider')!
    const divider = analyze(fix.design, testCatalog).geo!.boxes.get('div-1')!
    const [support, ...more] = supportsOf(fix.design, 'bottom')
    expect(more).toEqual([])
    expect(sags(fix.design).some((h) => h.pieces.includes('bottom'))).toBe(false)
    expect(analyze(fix.design, testCatalog).geo!.boxes.get(support.id)!.x1).toBeLessThan(divider.x0)
    for (const h of critical.filter((h) => h.pieces[0] !== 'bottom')) expect(supportsOf(fix.design, h.pieces[0])).toHaveLength(1)
    expect(sags(fix.design).filter((h) => h.severity === 'critical')).toEqual([])
  })
})

describe('fixes for hardware and drawers', () => {
  const variants = new Map(MODULES.cabinet.benchVariants())
  const built = (name: string) => buildPlan(variants.get(name)!, testCatalog).design
  const roleOf = (hardwareId: string) => testCatalog.hardware.find((h) => h.id === hardwareId)?.role
  /** The design with one piece of hardware of a role swapped for another, in the first joint that carries one. */
  const withHardware = (d: Design, role: string, hardwareId: string): Design => {
    const joint = d.joints.find((u) => u.hardware.some((h) => roleOf(h.hardwareId) === role))!
    return { ...d, joints: d.joints.map((u) => (u !== joint ? u : { ...u, hardware: u.hardware.map((h) => (roleOf(h.hardwareId) === role ? { ...h, hardwareId } : h)) })) }
  }
  const hardwareOf = (d: Design, role: string) => d.joints.flatMap((u) => u.hardware).filter((h) => roleOf(h.hardwareId) === role)

  it('a door with the hinge of another mount gets the one for its own, as many as it had', () => {
    const cabinet = built('alacena')
    const wrong = withHardware(cabinet, 'hinge', 'cup-hinge-35-inset')
    const mismatch = findings(wrong).find((h) => h.check === 'door.hinge-mount')!
    const [fix] = fixesFor(wrong, testCatalog, mismatch)
    expect(fix.key).toBe('matching-hinge')
    expect(hardwareOf(fix.design, 'hinge')).toEqual(hardwareOf(cabinet, 'hinge'))
    expect(findings(fix.design).some((h) => h.check === 'door.hinge-mount')).toBe(false)
  })

  it('a drawer with a slide of the wrong length gets the one its box takes', () => {
    const drawers = built('cajonera')
    const wrong = withHardware(drawers, 'drawer-slide', 'drawer-slide-30')
    const mismatch = findings(wrong).find((h) => h.alternatives.some((a) => a.key === 'matching-slide'))!
    const fix = fixesFor(wrong, testCatalog, mismatch).find((f) => f.key === 'matching-slide')!
    expect(hardwareOf(fix.design, 'drawer-slide')).toEqual(hardwareOf(drawers, 'drawer-slide'))
    expect(findings(fix.design).some((h) => h.alternatives.some((a) => a.key === 'matching-slide'))).toBe(false)
  })

  it.each([
    ['left', 'Apoyo de corredera izquierdo'],
    ['right', 'Apoyo de corredera derecho'],
  ])('a drawer with nothing on its %s gets a piece to screw the slide to, one drawer at a time', (which, name) => {
    const drawers = built('cajonera')
    const sides = drawers.pieces.filter((p) => p.role === 'side')
    const side = which === 'left' ? sides[0] : sides[sides.length - 1]
    const removed = applyOperations(drawers, [{ op: 'removePiece', id: side.id }], testCatalog)
    if (!removed.ok) throw new Error(removed.errors[0].message)
    const open = removed.value.design
    const unsupported = findings(open).filter((h) => h.check === 'drawer.no-slide-support')
    expect(unsupported.length).toBeGreaterThan(1)
    const [fix] = fixesFor(open, testCatalog, unsupported[0])
    expect(fix.operations.map((o) => o.op)).toEqual(['addPiece', 'addJoint'])
    const support = fix.design.pieces.find((p) => p.name === name)!
    const runner = fix.design.joints.find((u) => u.type === 'drawer-slide' && u.b === support.id)!
    const after = analyze(fix.design, testCatalog)
    if (!after.valid) throw new Error(after.errors[0].message)
    const [beside, box] = [after.geo.boxes.get(support.id)!, after.geo.boxes.get(runner.a)!]
    expect(gapBetween(beside, box)?.distance).toBe(ASSUMPTIONS.drawers.boxClearance)
    expect([beside.x0, ...faceSize(beside, support.normal)].filter((mm) => !Number.isInteger(mm))).toEqual([])
    expect(unsupported[0].alternatives.map((a) => a.description)).toEqual(['Una pieza junto al cajón, a 13 mm, para la corredera'])
    expect(findings(fix.design).filter((h) => h.check === 'drawer.no-slide-support')).toHaveLength(unsupported.length - 1)
    // One click for the whole notice would support only the first drawer: it is left to the expert.
    expect(fixForAlternative(open, testCatalog, unsupported, 'slide-support')).toBeNull()
  })

  it('offers nothing for a fix that is already in place', () => {
    const anchored = { ...exampleBookcase, wallAnchored: false }
    const tipping = finding(anchored, 'R4_TIPPING')
    expect(fixesFor({ ...anchored, wallAnchored: true }, testCatalog, tipping)).toEqual([])
  })
})
