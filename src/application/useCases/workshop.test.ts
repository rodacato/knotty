import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { jointGroups } from '../../domain/editing/joints/choice'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { DEFAULT_CONSTRUCTION, type CabinetPlan } from '../../domain/furniture/modules/cabinet'
import saved from '../../domain/session/state-v1.fixture.json'
import { migrateState } from '../../domain/session/migrate'
import { currentDesign, DesignState } from '../../domain/session/state'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import type { DesignRepository } from '../../ports/DesignRepository'
import { buildContext } from '../context'
import { createUseCases, currentPlan, reviewSignature } from '.'

const memory = (): DesignRepository => {
  let state: DesignState | null = null
  return { load: () => state, save: (s) => void (state = s), clear: () => void (state = null) }
}
let id = 0
const setup = () => createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: memory(), now: () => '2026-09-28T10:00:00Z', newId: () => `w${++id}` })
const sideboard = (extra: Partial<CabinetPlan> = {}): CabinetPlan => ({
  kind: 'cabinet',
  name: 'Aparador',
  dimensions: { width: 1200, height: 800, depth: 400 },
  material: 'T18',
  base: 'floor',
  wallMounted: false,
  construction: { ...DEFAULT_CONSTRUCTION, top: 'over' },
  columns: [{ width: 1, cells: [{ height: 1, content: 'open', shelves: 1, doors: null }] }],
  ...extra,
})

function planned(c: ReturnType<typeof setup>, plan = sideboard()) {
  const r = c.applyPlan(c.fromExample(exampleBookcase), plan)
  if (!r.ok) throw new Error(r.message)
  return r.state
}
const bodyOf = (state: DesignState) => jointGroups(currentDesign(state)).find((g) => g.id === 'body')!

describe('choosing a joint', () => {
  it('is a version whose joints carry the chosen type and hardware, kept when the plan is rebuilt', () => {
    const c = setup()
    const initial = planned(c)
    const r = c.chooseJoint(initial, 'body', 'pocket-screw')
    if (!r.ok) throw new Error(r.message)
    expect(bodyOf(r.state).joints.every((u) => u.type === 'pocket-screw' && u.hardware[0]?.hardwareId.startsWith('pocket-screw'))).toBe(true)
    expect(r.state.versions.at(-1)?.summary).toBe('Cuerpo: tornillo de bolsillo')
    expect(currentPlan(r.state)).toMatchObject({ diverged: false })
    const wider = c.applyPlan(r.state, sideboard({ dimensions: { width: 1300, height: 800, depth: 400 } }))
    if (!wider.ok) throw new Error(wider.message)
    expect(bodyOf(wider.state).current).toBe('pocket-screw')
  })

  it('refuses one the boards are too thin for, and leaves the design as it was', () => {
    const c = setup()
    const thin = planned(c, sideboard({ material: 'T12' }))
    const r = c.chooseJoint(thin, 'body', 'dowel')
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/^Con estos tableros no: Una unión con tarugo necesita al menos 15 mm/) })
    expect(bodyOf(thin).current).toBe('butt-screw')
  })
})

describe('choosing edge profiles', () => {
  it('stores the profile per edge, keeps it through a rebuild, and asks for no new review', () => {
    const c = setup()
    const initial = planned(c)
    const r = c.chooseEdgeProfiles(initial, 'top', ['front', 'left', 'right'], 'roundover-3')
    if (!r.ok) throw new Error(r.message)
    expect(currentDesign(r.state).edgeProfiles).toEqual(['front', 'left', 'right'].map((edge) => ({ piece: 'top', edge, profile: 'roundover-3' })))
    expect(r.state.versions.at(-1)?.summary).toBe('Cantos de cubierta: frente, izquierda y derecha, redondeo 3 mm')
    expect(reviewSignature(r.state, testCatalog)).toBe(reviewSignature(initial, testCatalog))
    expect(buildContext(r.state, testCatalog)).not.toContain('edgeProfiles')
    const taller = c.applyPlan(r.state, sideboard({ dimensions: { width: 1200, height: 900, depth: 400 } }))
    if (!taller.ok) throw new Error(taller.message)
    expect(currentDesign(taller.state).edgeProfiles).toHaveLength(3)
    const straight = c.chooseEdgeProfiles(taller.state, 'top', ['front', 'left', 'right'], null)
    expect(straight.ok && currentDesign(straight.state).edgeProfiles).toEqual([])
  })

  it('takes an edge that rests on another piece and a radius the board is too thin for, and ignores one that is not on the face', () => {
    const c = setup()
    const initial = planned(c)
    const hidden = c.chooseEdgeProfiles(initial, 'top', ['back'], 'eased')
    if (!hidden.ok) throw new Error(hidden.message)
    expect(currentDesign(hidden.state).edgeProfiles).toEqual([{ piece: 'top', edge: 'back', profile: 'eased' }])
    const thin = c.chooseEdgeProfiles(initial, 'back', ['top'], 'roundover-6')
    if (!thin.ok) throw new Error(thin.message)
    expect(currentDesign(thin.state).edgeProfiles).toEqual([{ piece: 'back', edge: 'top', profile: 'roundover-6' }])
    const off = c.chooseEdgeProfiles(initial, 'top', ['bottom'], 'eased')
    if (!off.ok) throw new Error(off.message)
    expect(currentDesign(off.state).edgeProfiles).toBeUndefined()
  })
})

describe('what was saved before', () => {
  it('a session saved by format 1 still loads, has no profiles, and takes them', () => {
    const state = DesignState.parse(migrateState(saved))
    expect(currentDesign(state).edgeProfiles).toBeUndefined()
    const piece = currentDesign(state).pieces.find((p) => p.role === 'shelf' || p.role === 'top')!
    const r = setup().chooseEdgeProfiles(state, piece.id, ['front'], 'eased')
    if (!r.ok) throw new Error(r.message)
    expect(DesignState.parse(JSON.parse(JSON.stringify(r.state)))).toEqual(r.state)
  })
})
