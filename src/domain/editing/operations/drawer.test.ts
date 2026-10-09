import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { startAt, ref } from '../../design/builders'
import type { Design } from '../../design/schema'
import { withFrontCuts } from '../../design/frontCuts'
import { testCatalog } from '../../furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../../furniture/fixtures/bookcase'
import { estimatePurchase } from '../../estimate/purchase'
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
    expect(side.x0).toBe(18 + 13)
  })

  it('its front, set inside the opening, takes a finger notch in the middle of its top edge, and the design says so', () => {
    const d = withDrawer(deep)
    const front = d.pieces.find((p) => p.id === 'drawer-1-front')!
    expect(front.cuts).toEqual([expect.objectContaining({ x: { from: 'center', offset: 0, length: 100 }, y: expect.objectContaining({ from: 'end' }) })])
    expect(d.pieces.filter((p) => p.cuts?.length).map((p) => p.id)).toEqual(['drawer-1-front'])
    expect([d.pulls, d.pullsOf]).toEqual([undefined, { 'drawer-1-front': 'notch' }])
    // The same notch a module cuts in an inset drawer front.
    const bare = { ...d, pieces: d.pieces.map((p) => (p.id === front.id ? { ...p, cuts: undefined } : p)) }
    expect(withFrontCuts(bare, analysis(d).geo.boxes, () => ({ notch: true, grooved: false })).pieces.find((p) => p.id === front.id)!.cuts).toEqual(front.cuts)
  })

  it('the notch buys nothing, and a second drawer keeps the first one\'s', () => {
    const one = withDrawer(deep)
    const bought = (d: Design) => estimatePurchase(d, analysis(d).geo, testCatalog).hardware.some((h) => h.hardware.role === 'handle')
    expect(bought(one)).toBe(false)
    const two = withDrawer(deep, [drawer(), drawer({ group: 'drawer-2', name: 'Cajón 2', bottom: 'shelf-1.y1', top: 'shelf-2.y0' })])
    expect(two.pullsOf).toEqual({ 'drawer-1-front': 'notch', 'drawer-2-front': 'notch' })
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

  it('the runner gap takes up to 0.8 mm more than the slide asks, and nothing less', () => {
    const r9 = (gap: number) => {
      const d = withDrawer(deep)
      d.pieces.find((p) => p.id === 'drawer-1-side-left')!.x = startAt(ref('side-left.x1', gap))
      return findingsOf(d).filter((h) => h.check === 'drawer.slide-clearance').map((h) => h.message)
    }
    expect(r9(12.7)).toEqual([])
    expect(r9(13.5)).toEqual([])
    expect(r9(12.6)).toEqual([expect.stringContaining('no entra')])
    expect(r9(13.6)).toEqual([expect.stringContaining('flojo')])
  })

  it('a front with no gap to the side rubs', () => {
    const d = withDrawer(deep)
    d.pieces.find((p) => p.id === 'drawer-1-front')!.x = { ...d.pieces.find((p) => p.id === 'drawer-1-front')!.x, from: ref('side-left.x1') }
    expect(findingsOf(d).filter((h) => h.check === 'drawer.front-rubs').map((h) => h.pieces)).toEqual([['drawer-1-front', 'side-left']])
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
    // The longest that stays in: through 15 and into 15, 3 mm short of coming out (ta + tb − 3).
    expect(findingsOf(d)[0].alternatives[0].data.length).toBe(27)
  })

  // An opening of 97 leaves a box of 59 (97 − 12 under, − 6 of bottom, − 20 over): too low for two screws 25 mm from each end.
  const lowDrawer = () => {
    const d = structuredClone(deep)
    d.pieces.find((p) => p.id === 'shelf-1')!.y = startAt(ref('bottom.y1', 97))
    return withDrawer(d)
  }
  const boxScrews = (d: Design) => estimatePurchase(d, analysis(d).geo, testCatalog).hardware.find((h) => h.hardware.id === 'screw-8x2')?.count

  it('a low box takes one screw in the middle of each corner, and R3 has nothing to say', () => {
    const d = lowDrawer()
    const side = analysis(d).geo.boxes.get('drawer-1-side-left')!
    expect(side.y1 - side.y0).toBeCloseTo(59, 5)
    expect(findingsOf(d).filter((h) => h.code === 'R3_SCREWS')).toEqual([])
    expect(boxScrews(withDrawer(deep))! - boxScrews(d)!).toBe(4)
  })

  it('two screws said outright in a low box are still too close to the ends', () => {
    const d = lowDrawer()
    d.joints = d.joints.map((u) => (u.id === 'j-drawer-1-side-left-back' ? { ...u, hardware: [{ ...u.hardware[0], count: 2 }] } : u))
    expect(findingsOf(d).map((h) => [h.check, h.data.joint])).toEqual([['screw.end-distance', 'j-drawer-1-side-left-back']])
  })
})
