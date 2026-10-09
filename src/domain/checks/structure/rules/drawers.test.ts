import { describe, expect, it } from 'vitest'
import { analyze } from '../../analysis'
import { startAt, endAt, makePiece, ref, extent, makeJoint } from '../../../design/builders'
import type { Design } from '../../../design/schema'
import { gapBetween } from '../../../design/validation/contact'
import { cutList } from '../../../estimate/cutList'
import { ASSUMPTIONS } from '../../../assumptions'
import { testCatalog } from '../../../furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../../../furniture/fixtures/bookcase'
import { completeJoints } from '../../../design/joints'
import { fixesFor } from '../../../editing/fixes/fixes'
import { applyOperations } from '../../../editing/operations/apply'
import type { Operation } from '../../../editing/operations/schema'

const drawer = (extra: Partial<Extract<Operation, { op: 'addDrawer' }>> = {}): Operation => ({
  op: 'addDrawer',
  group: 'drawer-1',
  name: 'Cajón 1',
  left: 'side-left.x1',
  right: 'side-right.x0',
  bottom: 'bottom.y1',
  top: 'shelf-1.y0',
  front: 'furniture.z1',
  back: 'back.z1',
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

const geometry = (d: Design) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(JSON.stringify(a.errors))
  return a.geo
}
/** The pieces that do not start and end at a whole millimetre across the furniture, where a slide's gap is: the fixture's heights are not whole. */
const fractional = (d: Design) => {
  const { boxes } = geometry(d)
  return d.pieces.filter((p) => [boxes.get(p.id)!.x0, boxes.get(p.id)!.x1].some((mm) => Math.abs(mm - Math.round(mm)) > 1e-6)).map((p) => p.id)
}
/** The drawer of `build(deep, [drawer()])` with its box this far from each side of the carcass. */
const boxAt = (d: Design, gap: number): Design => ({
  ...d,
  pieces: d.pieces.map((p) =>
    p.id === 'drawer-1-side-left'
      ? { ...p, x: startAt(ref('side-left.x1', gap)) }
      : p.id === 'drawer-1-side-right'
        ? { ...p, x: endAt(ref('side-right.x0', -gap)) }
        : p.id === 'drawer-1-bottom'
          ? { ...p, x: extent(ref('side-left.x1', gap), ref('side-right.x0', -gap)) }
          : p,
  ),
})
/** The gap the box leaves on each side once it is cut to the measures the cut list prints. */
const printedGap = (d: Design) => {
  const { boxes } = geometry(d)
  const opening = boxes.get('side-right')!.x0 - boxes.get('side-left')!.x1
  const side = (id: string) => boxes.get(id)!.x1 - boxes.get(id)!.x0
  const across = cutList(d, geometry(d)).find((l) => l.ids.includes('drawer-1-subfront'))!.length
  return (opening - across - side('drawer-1-side-left') - side('drawer-1-side-right')) / 2
}

describe('what Knotty builds toward a slide aims at the middle of what the slide takes', () => {
  const declared = build(deep, [drawer()])

  it.each([
    ['too tight, with its runner joints', 8, declared, 'drawer.slide-clearance'],
    ['too loose, with its runner joints', 16, declared, 'drawer.slide-clearance'],
    ['too tight, freeform', 8, freeform(declared), 'drawer.slide-gap'],
    ['too loose, freeform', 16, freeform(declared), 'drawer.slide-gap'],
  ])('a box %s is told to leave the gap a new drawer gets, and comes out whole', (_, gap, base, check) => {
    const wrong = boxAt(base, gap)
    const found = r9(wrong)
    expect(found.map((h) => [h.check, h.severity, h.data.needs])).toEqual(Array(2).fill([check, 'critical', 12.7]))
    const alternatives = found.flatMap((h) => h.alternatives)
    expect(alternatives).toEqual(Array(2).fill({ key: 'fit-box', description: 'Dejar 13 mm por lado entre la caja y el mueble', data: { clearance: ASSUMPTIONS.drawers.boxClearance } }))
    const fitted = boxAt(wrong, alternatives[0].data.clearance as number)
    expect(r9(fitted)).toEqual([])
    expect(printedGap(fitted)).toBe(13)
    expect(fractional(fitted)).toEqual([])
  })

  it.each([
    ['with its runner joints', declared],
    ['freeform', freeform(declared)],
  ])('a box at exactly what the slide asks, %s, is left as it is: nothing to report and nothing to repair', (_, base) => {
    const saved = boxAt(base, 12.7)
    expect(analyze(saved, testCatalog)).toMatchObject({ valid: true, findings: [] })
    expect(printedGap(boxAt(base, 13.5))).toBe(13.5)
    expect(r9(boxAt(base, 13.5))).toEqual([])
  })

  it.each([
    ['with its runner joints', declared],
    ['freeform', freeform(declared)],
  ])('the band the rule takes is the slide’s, %s: a tenth under what it asks or a tenth over its tolerance is still refused', (_, base) => {
    expect(r9(boxAt(base, 12.6)).map((h) => h.message)).toEqual(Array(2).fill(expect.stringContaining('solo hay 12.6 mm')))
    expect(r9(boxAt(base, 13.6)).map((h) => h.message)).toEqual(Array(2).fill(expect.stringContaining('hay 13.6 mm')))
  })

  it.each([
    ['too tight, with its runner joints', 12.6, declared],
    ['too loose, with its runner joints', 13.6, declared],
    ['too tight, freeform', 12.6, freeform(declared)],
    ['too loose, freeform', 13.6, freeform(declared)],
  ])('a box %s reads what the slide takes and why its repair says another number, in the same notice', (_, gap, base) => {
    for (const { message, alternatives } of r9(boxAt(base, gap))) {
      expect(message).toMatch(/ La corredera toma de 12\.7 a 13\.5 mm por lado y Knotty deja 13, para que medio milímetro de error al cortar no deje el cajón fuera\.$/)
      expect(alternatives[0].description).toBe('Dejar 13 mm por lado entre la caja y el mueble')
      expect(message).not.toMatch(/(necesita|ocupa) 12\.7/)
    }
  })

  it('a slide that asks for as much as Knotty builds is told by its band alone', () => {
    const wide = { ...testCatalog, hardware: testCatalog.hardware.map((h) => (h.sideClearance === null ? h : { ...h, sideClearance: 13 })) }
    const found = analyze(boxAt(declared, 12.6), wide)
    const messages = found.valid ? found.findings.filter((h) => h.check === 'drawer.slide-clearance').map((h) => h.message) : []
    expect(messages).toHaveLength(2)
    for (const message of messages) {
      expect(message).toMatch(/ La corredera toma de 13 a 13\.8 mm por lado\.$/)
      expect(message).not.toContain('Knotty deja')
    }
  })
})

describe('R9 for freeform drawers', () => {
  it('reads the carcass sides as runner supports when they sit at the runner gap', () => {
    expect(r9(freeform(build(deep, [drawer()])))).toEqual([])
  })

  it('gets its runners from the pieces beside the box, one pair of hardware per drawer', () => {
    const runners = completeJoints(freeform(build(deep, [drawer()])), testCatalog).joints.filter((u) => u.type === 'drawer-slide')
    expect(runners.map((u) => [u.a, u.b, u.hardware.length])).toEqual([
      ['drawer-1-side-left', 'side-left', 1],
      ['drawer-1-side-right', 'side-right', 0],
    ])
  })

  it('the runners it adds are as long as the box, like the ones the drawer brings: not the first slide in the catalog', () => {
    const built = build(deep, [drawer()])
    const brought = built.joints.find((u) => u.type === 'drawer-slide' && u.hardware.length)!.hardware[0].hardwareId
    const inferred = completeJoints(freeform(built), testCatalog).joints.find((u) => u.type === 'drawer-slide' && u.hardware.length)!.hardware[0].hardwareId
    expect(brought).toBe('drawer-slide-45')
    expect(inferred).toBe(brought)
  })

  it('a box side with nothing beside it has nowhere to screw the runner, and Knotty can put a piece there', () => {
    const d = freeform(build(deep, [drawer()]))
    // The box sits 100 mm in from the left side, with nothing beside it.
    d.pieces = d.pieces.map((p) =>
      p.id === 'drawer-1-side-left' ? { ...p, x: startAt({ type: 'mm', mm: 120 }) } : p.id === 'drawer-1-bottom' ? { ...p, x: extent(ref('drawer-1-side-left.x0'), ref('drawer-1-side-right.x1')) } : p,
    )
    const [finding] = r9(d)
    expect(finding).toMatchObject({ severity: 'critical', message: expect.stringContaining('no tiene dónde atornillar la corredera') })
    expect(finding.message).toMatch(/hace falta una pieza junto a la caja\. La corredera toma de 12\.7 a 13\.5 mm por lado y Knotty deja 13, para que/)
    expect(finding.message).not.toContain('a 12.7 mm de la caja')
    const [fix] = fixesFor(d, testCatalog, finding)
    expect(fix.key).toBe('slide-support')
    expect(finding.alternatives[0].description).toBe('Una pieza junto al cajón, a 13 mm, para la corredera')
    expect(r9(fix.design).filter((h) => h.severity === 'critical')).toEqual([])
    const { boxes } = geometry(fix.design)
    expect(gapBetween(boxes.get('support-drawer-1-left')!, boxes.get('drawer-1-side-left')!)?.distance).toBe(ASSUMPTIONS.drawers.boxClearance)
    expect(boxes.get('support-drawer-1-left')!.x0).toBe(120 - 13 - 18)
    expect(fractional(fix.design)).toEqual([])
    expect(fix.design.joints.some((u) => u.type === 'drawer-slide' && u.a === 'drawer-1-side-left')).toBe(true)
  })

  const withSlide = (d: Design, hardwareId: string): Design => ({ ...d, joints: d.joints.map((u) => (u.type === 'drawer-slide' && u.hardware.length ? { ...u, hardware: [{ hardwareId, count: 1 }] } : u)) })

  it('a slide longer than its box does not fit, and Knotty puts the one as long as the box', () => {
    const d = withSlide(build(deep, [drawer()]), 'drawer-slide-50')
    const [finding] = r9(d)
    expect(finding).toMatchObject({ check: 'drawer.slide-too-long', severity: 'critical', data: { slide: 500, box: 450 } })
    const [fix] = fixesFor(d, testCatalog, finding)
    expect(fix.key).toBe('matching-slide')
    expect(r9(fix.design)).toEqual([])
    expect(fix.design.joints.find((u) => u.type === 'drawer-slide' && u.hardware.length)!.hardware).toEqual([{ hardwareId: 'drawer-slide-45', count: 1 }])
  })

  it('a slide much shorter than its box leaves the drawer half open', () => {
    const [finding] = r9(withSlide(build(deep, [drawer()]), 'drawer-slide-30'))
    expect(finding).toMatchObject({ check: 'drawer.slide-too-short', severity: 'recommendation', alternatives: [{ key: 'matching-slide', data: { hardwareId: 'drawer-slide-45' } }] })
    expect(finding.message).toContain('no abre completo')
  })

  it('a drawer that reaches the ground drags on it', () => {
    const low: Design = {
      schema: 1,
      name: 'Cajonera baja',
      dimensions: { width: 500, height: 300, depth: 450 },
      wallAnchored: false,
      notes: '',
      pieces: [
        makePiece({ id: 'back', name: 'Trasera', role: 'back', material: 'TR6', normal: 'z', x: extent(ref('furniture.x0'), ref('furniture.x1')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: startAt(ref('furniture.z0')) }),
        makePiece({ id: 'side-left', name: 'Lateral izquierdo', role: 'side', material: 'T18', normal: 'x', x: startAt(ref('furniture.x0')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: extent(ref('back.z1'), ref('furniture.z1')) }),
        makePiece({ id: 'side-right', name: 'Lateral derecho', role: 'side', material: 'T18', normal: 'x', x: endAt(ref('furniture.x1')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: extent(ref('back.z1'), ref('furniture.z1')) }),
        makePiece({ id: 'top', name: 'Techo', role: 'top', material: 'T18', normal: 'y', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: endAt(ref('furniture.y1')), z: extent(ref('back.z1'), ref('furniture.z1')) }),
      ],
      joints: [makeJoint('j-top-left', 'side-left', 'top', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]), makeJoint('j-top-right', 'side-right', 'top', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }])],
    }
    const d = build(low, [drawer({ bottom: 'furniture.y0', top: 'top.y0' })])
    expect(r9(d).map((h) => h.message)).toEqual([expect.stringContaining('llega al suelo')])
  })
})
