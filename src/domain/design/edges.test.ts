import { describe, expect, it } from 'vitest'
import { analyze } from '../checks/analysis'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetPlan } from '../furniture/modules/cabinet'
import { profileFit } from '../materials/edgeProfiles'
import { edgeNeighbours, profiledEdges, withPieceProfiles } from './edges'

const plan = (top: CabinetPlan['construction']['top']): CabinetPlan => ({
  kind: 'cabinet',
  name: 'Aparador',
  dimensions: { width: 1200, height: 800, depth: 400 },
  material: 'T18',
  base: 'floor',
  legHeight: 150,
  wallMounted: false,
  construction: { ...DEFAULT_CONSTRUCTION, top },
  columns: [{ width: 1, cells: [{ height: 1, content: 'open', shelves: 1, doors: null }] }],
})

function built(top: CabinetPlan['construction']['top']) {
  const design = buildCabinet(plan(top), testCatalog).design
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
  return { design, geo: a.geo }
}

const against = (top: CabinetPlan['construction']['top'], piece: string) => Object.fromEntries(edgeNeighbours(built(top).design, built(top).geo, piece).map((n) => [n.edge, n.against]))

describe('edges against another piece', () => {
  it('a top over the sides shows its front and both ends; its back rests on the back panel', () => {
    expect(against('over', 'top')).toEqual({ front: null, left: null, right: null, back: 'back' })
  })

  it('a top between the sides shows only its front', () => {
    expect(against('between', 'top')).toEqual({ front: null, left: 'side-left', right: 'side-right', back: 'back' })
  })

  it('a side shows its front and its top when the top sits between them', () => {
    expect(against('between', 'side-left')).toEqual({ front: null, top: null, bottom: null, back: 'back' })
  })
})

describe('profiled edges', () => {
  it('lists what the person chose on free edges with their length, and drops one that rests on another piece (the top stops at the 6 mm back)', () => {
    const { design, geo } = built('over')
    const profiled = withPieceProfiles(design, 'top', [
      { edge: 'front', profile: 'roundover-3' },
      { edge: 'left', profile: 'roundover-3' },
      { edge: 'back', profile: 'roundover-3' },
    ])
    expect(profiledEdges(profiled, geo)).toEqual([{ piece: 'top', edges: ['front', 'left'], profile: 'roundover-3', length: 1200 + (400 - 6) }])
  })

  it('a router profile does not fit without a router, and no radius fits past half the board', () => {
    expect(profileFit('roundover-6', 2, 18)).toEqual({ ok: false, reason: 'router' })
    expect(profileFit('roundover-6', 3, 18)).toEqual({ ok: true })
    expect(profileFit('roundover-3', 1, 18)).toEqual({ ok: true })
    expect(profileFit('roundover-6', 3, 6)).toEqual({ ok: false, reason: 'thin', minThickness: 12 })
    expect(profileFit('chamfer', 1, 3)).toEqual({ ok: true })
  })
})
