import { describe, expect, it } from 'vitest'
import { analyze } from '../../analysis'
import { startAt, endAt, makePiece, ref, extent, makeJoint } from '../../diseno/builders'
import type { Design } from '../../diseno/schema'
import { testCatalog } from '../../fixtures/catalog.test-util'
import { exampleBookcase } from '../../fixtures/bookcase'
import { completeJoints } from '../../diseno/joints'
import { fixesFor } from '../../fixes/fixes'
import { applyOperations } from '../../operaciones/apply'
import type { Operation } from '../../operaciones/schema'

const drawer = (extra: Partial<Extract<Operation, { op: 'addDrawer' }>> = {}): Operation => ({
  op: 'addDrawer',
  group: 'cajon-1',
  name: 'Cajón 1',
  left: 'lat-izq.x1',
  right: 'lat-der.x0',
  bottom: 'piso.y1',
  top: 'entrepano-1.y0',
  front: 'mueble.z1',
  back: 'trasera.z1',
  material: 'T15',
  bottomMaterial: 'TR6',
  ...extra,
})
const deep: Design = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, depth: 500 } }
const build = (base: Design, ops: Operation[]) => {
  const r = applyOperations(base, ops, testCatalog)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value.design
}
/** A drawer as a freeform design would have it: its pieces, but no runner joints. */
const freeform = (d: Design): Design => ({ ...d, joints: d.joints.filter((u) => u.type !== 'drawer-slide') })
const r9 = (d: Design) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(JSON.stringify(a.errors))
  return a.findings.filter((h) => h.code === 'R9_DRAWERS')
}

describe('R9 for freeform drawers', () => {
  it('reads the carcass sides as runner supports when they sit at the runner gap', () => {
    expect(r9(freeform(build(deep, [drawer()])))).toEqual([])
  })

  it('gets its runners from the pieces beside the box, one pair of hardware per drawer', () => {
    const runners = completeJoints(freeform(build(deep, [drawer()])), testCatalog).joints.filter((u) => u.type === 'drawer-slide')
    expect(runners.map((u) => [u.a, u.b, u.hardware.length])).toEqual([
      ['cajon-1-costado-izq', 'lat-izq', 1],
      ['cajon-1-costado-der', 'lat-der', 0],
    ])
  })

  it('a box side with nothing beside it has nowhere to screw the runner, and Knotty can put a piece there', () => {
    const d = freeform(build(deep, [drawer()]))
    // The box sits 100 mm in from the left side, with nothing beside it.
    d.pieces = d.pieces.map((p) =>
      p.id === 'cajon-1-costado-izq' ? { ...p, x: startAt({ type: 'mm', mm: 120 }) } : p.id === 'cajon-1-fondo' ? { ...p, x: extent(ref('cajon-1-costado-izq.x0'), ref('cajon-1-costado-der.x1')) } : p,
    )
    const [finding] = r9(d)
    expect(finding).toMatchObject({ severity: 'critical', message: expect.stringContaining('no tiene dónde atornillar la corredera') })
    const [fix] = fixesFor(d, testCatalog, finding)
    expect(fix.key).toBe('slide-support')
    expect(r9(fix.design).filter((h) => h.severity === 'critical')).toEqual([])
    expect(fix.design.joints.some((u) => u.type === 'drawer-slide' && u.a === 'cajon-1-costado-izq')).toBe(true)
  })

  it('a drawer that reaches the ground drags on it', () => {
    const low: Design = {
      schema: 1,
      name: 'Cajonera baja',
      dimensions: { width: 500, height: 300, depth: 450 },
      wallAnchored: false,
      notes: '',
      pieces: [
        makePiece({ id: 'trasera', name: 'Trasera', role: 'back', material: 'TR6', normal: 'z', x: extent(ref('mueble.x0'), ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: startAt(ref('mueble.z0')) }),
        makePiece({ id: 'lat-izq', name: 'Lateral izquierdo', role: 'side', material: 'T18', normal: 'x', x: startAt(ref('mueble.x0')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('mueble.z1')) }),
        makePiece({ id: 'lat-der', name: 'Lateral derecho', role: 'side', material: 'T18', normal: 'x', x: endAt(ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('mueble.z1')) }),
        makePiece({ id: 'techo', name: 'Techo', role: 'top', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: endAt(ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('mueble.z1')) }),
      ],
      joints: [makeJoint('u-techo-izq', 'lat-izq', 'techo', 'butt-screw', [{ hardwareId: 'tornillo-8x2', count: null }]), makeJoint('u-techo-der', 'lat-der', 'techo', 'butt-screw', [{ hardwareId: 'tornillo-8x2', count: null }])],
    }
    const d = build(low, [drawer({ bottom: 'mueble.y0', top: 'techo.y0' })])
    expect(r9(d).map((h) => h.message)).toEqual([expect.stringContaining('llega al suelo')])
  })
})
