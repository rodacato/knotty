import { describe, expect, it } from 'vitest'
import { startAt, mm, makePiece, ref, extent, makeJoint } from '../builders'
import type { Design } from '../schema'
import { resolveGeometry } from '../resolve'
import { exampleWallCabinet } from '../../furniture/fixtures/wallCabinet'
import { exampleNightstand } from '../../furniture/fixtures/nightstand'
import { testCatalog } from '../../furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../../furniture/fixtures/bookcase'
import { validateGeometry } from './geometry'

const validate = (d: Design) => {
  const r = resolveGeometry(d, testCatalog)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return validateGeometry(d, r.value, testCatalog)
}
const codes = (d: Design) => validate(d).errors.map((e) => e.code)

describe('validateGeometry', () => {
  it.each([exampleBookcase, exampleNightstand, exampleWallCabinet])('the fixtures have no errors or warnings: $name', (d) => {
    const { errors, warnings } = validate(d)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('finds overlapping pieces', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.push(makePiece({ id: 'divider', name: 'Divisor', role: 'divider', material: 'T18', normal: 'x', x: startAt(mm(291)), y: extent(ref('bottom.y1'), ref('top.y0')), z: extent(ref('back.z1'), ref('furniture.z1')) }))
    d.joints.push(makeJoint('j-div-bottom', 'divider', 'bottom', 'butt-screw'))
    expect(codes(d)).toContain('E_OVERLAP')
  })

  it('lets a declared groove overlap', () => {
    const d = structuredClone(exampleBookcase)
    const bottom = d.pieces.find((p) => p.id === 'bottom')!
    bottom.x = extent(ref('side-left.x1', -6), ref('side-right.x0', 6))
    d.joints = d.joints.map((u) => (u.b === 'bottom' && u.a.startsWith('side') ? { ...u, type: 'dado', depth: 6 } : u))
    expect(codes(d)).toEqual([])
  })

  it('finds floating pieces and joints between pieces that do not touch', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.push(makePiece({ id: 'shelf-loose', name: 'Repisa suelta', role: 'shelf', material: 'T18', normal: 'y', x: extent(mm(100), mm(400)), y: startAt(mm(900)), z: extent(mm(100), mm(200)) }))
    d.joints.push(makeJoint('j-loose', 'shelf-loose', 'side-left', 'butt-screw'))
    expect(codes(d)).toEqual(expect.arrayContaining(['E_FLOATING', 'E_JOINT_WITHOUT_CONTACT']))
  })

  it('finds pieces outside the overall measures', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.find((p) => p.id === 'side-left')!.x = startAt(mm(-20))
    expect(codes(d)).toContain('E_OVERALL_SIZE')
  })

  it('finds pieces larger than the usable sheet', () => {
    const d = structuredClone(exampleBookcase)
    d.dimensions.height = 2500
    expect(codes(d)).toContain('E_TOO_BIG_FOR_SHEET')
  })

  it('warns about touching pieces with no joint', () => {
    const d = structuredClone(exampleBookcase)
    d.joints = d.joints.filter((u) => u.id !== 'j-kick-bottom')
    expect(validate(d).warnings.map((a) => a.data)).toEqual([{ a: 'kick', b: 'bottom' }])
  })
})

describe('a seam between two panels over a shared support', () => {
  const half = (id: string, from: number, to: number, role: 'bottom' | 'shelf' = 'bottom') => makePiece({ id, name: id, role, material: 'T18', normal: 'y', x: extent(mm(0), mm(1000)), y: extent(mm(72), mm(90)), z: extent(mm(from), mm(to)) })
  const spine = (length: number) => makePiece({ id: 'spine', name: 'Larguero', role: 'other', material: 'T18', normal: 'z', x: extent(mm(0), mm(length)), y: extent(mm(0), mm(72)), z: startAt(mm(491)) })
  const bed = (o: { length?: number; joined?: string[]; right?: 'bottom' | 'shelf' }): Design => ({
    schema: 1,
    name: 'Tableros',
    dimensions: { width: 1000, height: 90, depth: 1000 },
    wallAnchored: false,
    notes: '',
    pieces: [half('left', 0, 500), half('right', 500, 1000, o.right), spine(o.length ?? 1000)],
    joints: (o.joined ?? ['left', 'right']).map((id) => makeJoint(`j-${id}`, id, 'spine', 'butt-screw')),
  })
  const seamWarnings = (d: Design) => validate(d).warnings.filter((w) => w.data?.a === 'left' && w.data?.b === 'right')

  it('is not a joint when a support joined to both holds the whole seam', () => {
    expect(seamWarnings(bed({}))).toEqual([])
  })

  it('still warns when only one of the panels is joined to the support', () => {
    expect(seamWarnings(bed({ joined: ['left'] }))).toHaveLength(1)
  })

  it('still warns when the support holds only a short stretch of the seam', () => {
    expect(seamWarnings(bed({ length: 200 }))).toHaveLength(1)
  })

  it('does not take two pieces of different roles for a seam', () => {
    expect(seamWarnings(bed({ right: 'shelf' }))).toHaveLength(1)
  })
})

