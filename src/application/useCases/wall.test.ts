import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { DEFAULT_CONSTRUCTION } from '../../domain/furniture/modules/cabinet'
import { currentDesign, type DesignState } from '../../domain/session/state'
import type { DesignRepository } from '../../ports/DesignRepository'
import { buildContext } from '../context'
import { createUseCases, reviewSignature } from '.'

const memory = (): DesignRepository => {
  let state: DesignState | null = null
  return { load: () => state, save: (s) => void (state = s), clear: () => void (state = null) }
}
let id = 0
const setup = () => createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: memory(), now: () => '2026-10-11T10:00:00Z', newId: () => `w${++id}` })
const plan = {
  kind: 'cabinet' as const,
  name: 'Cajonera',
  dimensions: { width: 500, height: 900, depth: 450 },
  material: 'T18',
  base: 'kick' as const,
  legHeight: 150,
  wallMounted: true,
  construction: DEFAULT_CONSTRUCTION,
  columns: [{ width: 1, cells: [0, 1, 2].map(() => ({ height: 1, content: 'drawer' as const, shelves: null, doors: null })) }],
}

describe('saying the wall', () => {
  it('is a version of its own with the same pieces, and saying it again changes nothing', () => {
    const c = setup()
    const initial = c.fromExample(exampleBookcase)
    const state = c.chooseWall(initial, 'block')
    expect(state.versions).toHaveLength(initial.versions.length + 1)
    expect(currentDesign(state)).toEqual({ ...currentDesign(initial), wall: 'block' })
    expect(c.chooseWall(state, 'block')).toBe(state)
  })

  it('stays when the plan is rebuilt, and can be taken back', () => {
    const c = setup()
    const built = c.applyPlan(c.fromExample(exampleBookcase), plan)
    if (!built.ok) throw new Error(built.message)
    const said = c.chooseWall(built.state, 'concrete')
    const taller = c.applyPlan(said, { ...plan, dimensions: { ...plan.dimensions, height: 1000 } })
    if (!taller.ok) throw new Error(taller.message)
    expect(currentDesign(taller.state).wall).toBe('concrete')
    expect(currentDesign(c.chooseWall(said, 'unknown')).wall).toBe('unknown')
  })

  it('is not told to the expert and asks for no new review', () => {
    const c = setup()
    const initial = c.fromExample(exampleBookcase)
    const state = c.chooseWall(initial, 'drywall')
    expect(buildContext(state, testCatalog)).not.toMatch(/drywall|"wall"/)
    expect(reviewSignature(state, testCatalog)).toBe(reviewSignature(initial, testCatalog))
  })
})
