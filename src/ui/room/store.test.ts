import { openingProblem } from './layout'
import { beforeEach, describe, expect, it } from 'vitest'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import { issues, type FurnitureSource } from './layout'
import { baseSource, companions, studioSource } from './sources'
import { createUseCases } from '../../application/useCases'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { useRoom } from './store'

const source = (code: string): FurnitureSource => {
  const base = testReferences.home().find((b) => b.code === code)
  if (!base) throw new Error(`Missing test ficha ${code}`)
  return baseSource(base, testCatalog)
}
beforeEach(() => useRoom.setState(useRoom.getInitialState(), true))

describe('temporary room history and Studio handoff', () => {
  it('starts with a real ficha, a door and a window, and builds coherent bedroom, office and kitchen combinations', () => {
    for (const code of ['GN-CAM-01', 'KC-ESC-03', 'GN-COC-01']) {
      useRoom.setState(useRoom.getInitialState(), true)
      const chosen = source(code)
      useRoom.getState().launch(chosen)
      expect(useRoom.getState().layout!.openings.map((o) => o.kind)).toEqual(['door', 'window'])
      for (const base of companions(testReferences.home(), chosen).slice(0, 2)) useRoom.getState().add(baseSource(base, testCatalog))
      expect(useRoom.getState().layout!.items).toHaveLength(3)
      expect(issues(useRoom.getState().layout!)).toEqual([])
    }
  })

  it('undoes a whole drag and a removal, with redo available until a new action', () => {
    useRoom.getState().launch(source('GN-CAM-01'))
    const id = useRoom.getState().selected!,
      before = useRoom.getState().layout!
    useRoom.getState().beginMove()
    useRoom.getState().move(id, { x: 2000 }, false)
    useRoom.getState().move(id, { x: 2200 }, false)
    useRoom.getState().settle(id)
    useRoom.getState().undo()
    expect(useRoom.getState().layout).toEqual(before)
    useRoom.getState().redo()
    expect(useRoom.getState().layout!.items[0].x).toBe(2200)
    useRoom.getState().remove(id)
    expect(useRoom.getState().layout!.items).toHaveLength(0)
    useRoom.getState().undo()
    expect(useRoom.getState().layout!.items).toHaveLength(1)
    useRoom.getState().turn(id)
    expect(useRoom.getState().future).toEqual([])
  })

  it('updates only the instance taken to the Studio, even with two copies of the same ficha', () => {
    const original = source('GN-BUR-01')
    useRoom.getState().launch(original)
    const first = useRoom.getState().selected!
    useRoom.getState().duplicate(first)
    const duplicate = useRoom.getState().selected!
    const position = useRoom.getState().layout!.items.find((i) => i.id === duplicate)!
    useRoom.getState().edit(duplicate)
    const adjusted = {
      ...original,
      design: {
        ...original.design,
        dimensions: { ...original.design.dimensions, width: 550 },
      },
    }
    useRoom.getState().launch(adjusted)
    const after = useRoom.getState().layout!
    expect(after.items).toHaveLength(2)
    expect(after.items.find((i) => i.id === first)).toMatchObject({
      source: {
        design: { dimensions: { width: original.design.dimensions.width } },
      },
    })
    expect(after.items.find((i) => i.id === duplicate)).toMatchObject({
      x: position.x,
      z: position.z,
      source: { design: { dimensions: { width: 550 } } },
    })
    expect(after.anchorId).toBe(duplicate)
    useRoom.getState().launch(adjusted)
    expect(useRoom.getState().layout!.items).toHaveLength(2)
  })

  it('represents existing objects as blocks and restores a replaced ficha with its provenance', () => {
    useRoom.getState().launch(source('GN-BUR-01'))
    const id = useRoom.getState().selected!,
      before = useRoom.getState().layout!.items[0]
    useRoom.getState().replace(id, source('KC-BUR-03'))
    expect(useRoom.getState().layout!.items[0]).toMatchObject({
      id,
      x: before.x,
      z: before.z,
      source: { code: 'KC-BUR-03' },
    })
    useRoom.getState().undo()
    expect(useRoom.getState().layout!.items[0]).toEqual(before)
    useRoom.getState().addBlock('Refrigerador', { width: 700, depth: 650, height: 1700 })
    expect(useRoom.getState().layout!.items.at(-1)).toMatchObject({
      kind: 'block',
      name: 'Refrigerador',
    })
  })
  it('places added openings away from existing openings and preserves them through undo', () => {
    useRoom.getState().launch(source('GN-CAM-01'))
    const before = useRoom.getState().layout!
    useRoom.getState().addOpening('door')
    useRoom.getState().addOpening('window')
    const after = useRoom.getState().layout!
    for (const o of after.openings) expect(openingProblem(after.room, o, after.openings)).toBeNull()
    useRoom.getState().undo()
    useRoom.getState().undo()
    expect(useRoom.getState().layout).toBe(before)
  })
  it('keeps custom pieces, edge profiles and wall choices as previews instead of rebuilding an incomplete ficha', () => {
    let saved: DesignState | null = null
    const c = createUseCases({
      llm: () => createSimulated(0),
      catalog: testCatalog,
      repository: {
        load: () => saved,
        save: (state) => {
          saved = state
        },
        clear: () => {
          saved = null
        },
      },
    })
    const bases = testReferences.home(),
      base = bases.find((b) => b.code === 'GN-LIB-01')!
    const initial = c.openExample(base)
    expect(studioSource(initial, bases).example).not.toBeNull()
    const profiled = c.chooseEdgeProfiles(initial, 'top', ['front'], 'roundover-3')
    if (!profiled.ok) throw new Error(profiled.message)
    expect(currentDesign(profiled.state).edgeProfiles?.length).toBeGreaterThan(0)
    expect(studioSource(profiled.state, bases)).toMatchObject({ design: currentDesign(profiled.state), example: null })
    const shelf = currentDesign(initial).pieces.find((p) => p.role === 'shelf')!
    const moved = c.editPiece(initial, shelf.id, { kind: 'move', axis: 'y', delta: 10 })
    if (!moved.ok) throw new Error(moved.message)
    expect(studioSource(moved.state, bases)).toMatchObject({ design: currentDesign(moved.state), example: null })
    expect(studioSource(c.chooseWall(initial, 'brick'), bases).example).toBeNull()
  })
})
