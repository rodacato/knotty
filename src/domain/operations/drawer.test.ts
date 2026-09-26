import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { startAt, ref } from '../design/builders'
import type { Design } from '../design/schema'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { estimatePurchase } from '../materials/purchase'
import { applyOperations } from './apply'
import type { Operation } from './schema'

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

const withDrawer = (base: Design, ops: Operation[] = [drawer()]) => {
  const r = applyOperations(base, ops, testCatalog)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value.design
}
const analysis = (d: Design) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(JSON.stringify(a.errors))
  return a
}

describe('addDrawer', () => {
  it('builds six grouped pieces, valid and with nothing to report, with the longest runner that fits', () => {
    const d = withDrawer(deep)
    const pieces = d.pieces.filter((p) => p.group === 'drawer-1')
    expect(pieces.map((p) => p.id).sort()).toEqual(['drawer-1-back', 'drawer-1-bottom', 'drawer-1-front', 'drawer-1-side-left', 'drawer-1-side-right', 'drawer-1-subfront'])
    const a = analysis(d)
    expect(a.findings).toEqual([])
    expect(d.joints.find((u) => u.id === 'j-drawer-1-slide-left')?.hardware[0].hardwareId).toBe('drawer-slide-45')
    const front = a.geo.boxes.get('drawer-1-front')!
    expect(front.z1).toBe(500)
    expect(front.x0).toBe(20)
    const side = a.geo.boxes.get('drawer-1-side-left')!
    expect(side.x0).toBeCloseTo(18 + 12.7, 5)
  })

  it('follows by itself when the furniture gets wider', () => {
    const d = withDrawer(deep, [drawer(), { op: 'resizeFurniture', axis: 'x', value: 800, rule: 'stretch' }])
    const a = analysis(d)
    expect(a.geo.boxes.get('drawer-1-front')).toMatchObject({ x0: 20, x1: 780 })
    expect(a.findings.filter((h) => h.code === 'R9_DRAWERS')).toEqual([])
  })

  it('goes into the purchase: runners and drawer pieces', () => {
    const d = withDrawer(deep)
    const purchase = estimatePurchase(d, analysis(d).geo, testCatalog)
    expect(purchase.hardware.find((h) => h.hardware.id === 'drawer-slide-45')?.count).toBe(1)
    expect(purchase.sheets.map((h) => h.material.id)).toContain('T15')
  })

  it('comes out whole with removeGroup', () => {
    const d = withDrawer(withDrawer(deep), [{ op: 'removeGroup', group: 'drawer-1' }])
    expect(d.pieces.some((p) => p.group === 'drawer-1')).toBe(false)
    expect(d.joints.some((u) => u.id.includes('drawer-1'))).toBe(false)
    expect(analyze(d, testCatalog).valid).toBe(true)
  })

  it('does not fit in a very shallow piece', () => {
    const r = applyOperations(exampleBookcase, [drawer()], testCatalog)
    expect(r.ok || r.errors[0]).toMatchObject({ code: 'E_INVALID_OPERATION', message: expect.stringContaining('No cabe un cajón') })
  })
})

describe('R9 drawers and screws into a face', () => {
  const findingsOf = (d: Design) => analysis(d).findings

  it('a runner without its exact gap is critical', () => {
    const d = withDrawer(deep)
    d.pieces.find((p) => p.id === 'drawer-1-side-left')!.x = startAt(ref('side-left.x1', 8))
    const r9 = findingsOf(d).filter((h) => h.code === 'R9_DRAWERS')
    expect(r9).toEqual([expect.objectContaining({ severity: 'critical', message: expect.stringContaining('no entra') })])
  })

  it('a 3 mm bottom in a wide drawer sags', () => {
    const d = withDrawer({ ...deep, dimensions: { ...deep.dimensions, width: 700 } }, [drawer({ bottomMaterial: 'TR3' })])
    expect(findingsOf(d).filter((h) => h.code === 'R9_DRAWERS').map((h) => [h.severity, h.pieces[0]])).toEqual([['recommendation', 'drawer-1-bottom']])
  })

  it('3 mm only holds under 300 mm of width: a drawer of 400 already asks for 6', () => {
    const r9 = (width: number) => findingsOf(withDrawer({ ...deep, dimensions: { ...deep.dimensions, width } }, [drawer({ bottomMaterial: 'TR3' })])).filter((h) => h.check === 'drawer.thin-bottom')
    expect(r9(400).map((h) => h.alternatives[0].data.material)).toEqual(['TR6'])
    expect(r9(320)).toEqual([])
  })

  it('a screw into a face must not come out the other side', () => {
    const d = withDrawer(deep)
    d.joints = d.joints.map((u) => (u.id === 'j-drawer-1-subfront-front' ? { ...u, hardware: [{ hardwareId: 'screw-8x2', count: 4 }] } : u))
    expect(findingsOf(d).map((h) => [h.code, h.severity, h.data.joint])).toEqual([['R3_SCREWS', 'critical', 'j-drawer-1-subfront-front']])
  })
})
