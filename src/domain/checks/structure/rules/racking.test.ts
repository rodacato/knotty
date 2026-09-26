import { describe, expect, it } from 'vitest'
import { Design } from '../../../design/schema'
import { testCatalog } from '../../../furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../../../furniture/fixtures/bookcase'
import { exampleNightstand } from '../../../furniture/fixtures/nightstand'
import { fixesFor } from '../../../editing/fixes/fixes'
import { analyze } from '../../analysis'
import { baysOf } from './racking'
import stand from './steppedStand.fixture.json'

/** A stepped plant stand as a real expert drew it: three stools of 250, 500 and 750 mm, each a shelf butt-screwed on its own two sides. */
const steppedStand = Design.parse(stand)
const racking = (design: Design) => {
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors.map((e) => e.message).join(' '))
  return a.findings.filter((h) => h.code === 'R5_RACKING')
}

describe('R5 judges each box the sides make', () => {
  it('a cabinet, and anything one piece joins whole, is one box as always', () => {
    expect(baysOf(exampleBookcase)).toEqual([exampleBookcase.pieces.filter((p) => p.role === 'side').map((p) => p.id)])
  })

  it('a stepped stand is a box per step, each as tall as its own step', () => {
    expect(baysOf(steppedStand)).toEqual([
      ['side-left-3', 'side-right-3'],
      ['side-left-2', 'side-right-2'],
      ['side-left-1', 'side-right-1'],
    ])
    expect(racking(steppedStand).map((h) => [h.pieces.join(' '), h.severity, h.data.height])).toEqual([
      ['side-left-3 side-right-3', 'critical', 732],
      ['side-left-2 side-right-2', 'recommendation', 482],
      ['side-left-1 side-right-1', 'recommendation', 232],
    ])
  })

  it('the tall step gets rails Knotty builds, back and front with pocket screws, and stops racking; the others are untouched', () => {
    const tall = racking(steppedStand)[0]
    const fix = fixesFor(steppedStand, testCatalog, tall).find((f) => f.key === 'rigid-apron')!
    const added = fix.design.pieces.filter((p) => !steppedStand.pieces.some((q) => q.id === p.id))
    expect(added.map((p) => [p.name, p.role])).toEqual([
      ['Faja trasera', 'apron'],
      ['Faja delantera', 'apron'],
    ])
    expect(fix.design.joints.filter((u) => u.type === 'pocket-screw').map((u) => [u.a, u.b].sort().join(' '))).toHaveLength(4)
    expect(racking(fix.design).map((h) => h.pieces.join(' '))).toEqual(['side-left-2 side-right-2', 'side-left-1 side-right-1'])
  })

  it('a box that already has a rigid rail gets only the one at the back, as before', () => {
    const [nightstand] = racking(exampleNightstand)
    const fix = fixesFor(exampleNightstand, testCatalog, nightstand).find((f) => f.key === 'rigid-apron')!
    expect(fix.design.pieces.filter((p) => p.role === 'apron').map((p) => p.name)).toEqual(['Faja trasera'])
  })
})
