import { describe, expect, it } from 'vitest'
import { analyze } from '../checks/analysis'
import { exampleWallCabinet } from '../furniture/fixtures/wallCabinet'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import { testReferences } from '../furniture/fixtures/references.test-util'
import { exampleDesign, exampleOf } from '../furniture/examples'
import { estimatePurchase } from '../estimate/purchase'
import { hangsFromWall } from './installation'

it('a standing adaptation of a wall cabinet gets anti-tip hardware and no hanging-rail warning', () => {
  const example = exampleOf(testReferences.latest('GN-COC-04')!)
  if (!('plan' in example) || example.plan.kind !== 'cabinet') throw new Error('fixture')
  const { design } = exampleDesign({ ...example, plan: { ...example.plan, base: 'legs' } }, testCatalog)
  const analysis = analyze(design, testCatalog)
  expect(analysis.valid).toBe(true)
  if (!analysis.valid) return
  expect(hangsFromWall(design)).toBe(false)
  expect(analysis.findings.some((f) => f.check?.startsWith('wall-cabinet'))).toBe(false)
  const purchase = estimatePurchase({ ...design, wall: 'concrete' }, analysis.geo, testCatalog)
  expect(purchase.anchoring?.hung).toBe(false)
  expect(purchase.hardware.filter((h) => h.hardware.role === 'anti-tip').map((h) => h.count)).toEqual([1])
})
describe('hanging identification', () => {
  it('recognizes real hanging cabinets and supports name inference for legacy designs', () => {
    expect(hangsFromWall(exampleWallCabinet)).toBe(true)
    expect(hangsFromWall({ ...exampleWallCabinet, kind: undefined })).toBe(true)
  })
})
