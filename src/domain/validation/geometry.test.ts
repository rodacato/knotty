import { describe, expect, it } from 'vitest'
import { startAt, mm, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { Design } from '../diseno/schema'
import { resolveGeometry } from '../diseno/resolve'
import { exampleWallCabinet } from '../fixtures/wallCabinet'
import { exampleNightstand } from '../fixtures/nightstand'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { validateGeometry } from './geometry'

const validate = (d: Design) => {
  const r = resolveGeometry(d, testCatalog)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return validateGeometry(d, r.value, testCatalog)
}
const codes = (d: Design) => validate(d).errors.map((e) => e.code)

describe('validateGeometry', () => {
  it.each([exampleBookcase, exampleNightstand, exampleWallCabinet])('the fixtures have no errors or warnings: $nombre', (d) => {
    const { errors, warnings } = validate(d)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('finds overlapping pieces', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.push(makePiece({ id: 'divisor', name: 'Divisor', role: 'divider', material: 'T18', normal: 'x', x: startAt(mm(291)), y: extent(ref('piso.y1'), ref('techo.y0')), z: extent(ref('trasera.z1'), ref('mueble.z1')) }))
    d.joints.push(makeJoint('u-div-piso', 'divisor', 'piso', 'butt-screw'))
    expect(codes(d)).toContain('E_OVERLAP')
  })

  it('lets a declared groove overlap', () => {
    const d = structuredClone(exampleBookcase)
    const piso = d.pieces.find((p) => p.id === 'piso')!
    piso.x = extent(ref('lat-izq.x1', -6), ref('lat-der.x0', 6))
    d.joints = d.joints.map((u) => (u.b === 'piso' && u.a.startsWith('lat') ? { ...u, type: 'dado', depth: 6 } : u))
    expect(codes(d)).toEqual([])
  })

  it('finds floating pieces and joints between pieces that do not touch', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.push(makePiece({ id: 'repisa-suelta', name: 'Repisa suelta', role: 'shelf', material: 'T18', normal: 'y', x: extent(mm(100), mm(400)), y: startAt(mm(900)), z: extent(mm(100), mm(200)) }))
    d.joints.push(makeJoint('u-suelta', 'repisa-suelta', 'lat-izq', 'butt-screw'))
    expect(codes(d)).toEqual(expect.arrayContaining(['E_FLOATING', 'E_JOINT_WITHOUT_CONTACT']))
  })

  it('finds pieces outside the overall measures', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.find((p) => p.id === 'lat-izq')!.x = startAt(mm(-20))
    expect(codes(d)).toContain('E_OVERALL_SIZE')
  })

  it('finds pieces larger than the usable sheet', () => {
    const d = structuredClone(exampleBookcase)
    d.dimensions.height = 2500
    expect(codes(d)).toContain('E_TOO_BIG_FOR_SHEET')
  })

  it('warns about touching pieces with no joint', () => {
    const d = structuredClone(exampleBookcase)
    d.joints = d.joints.filter((u) => u.id !== 'u-zoclo-piso')
    expect(validate(d).warnings.map((a) => a.data)).toEqual([{ a: 'zoclo', b: 'piso' }])
  })
})
