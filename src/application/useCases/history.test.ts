import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { createUseCases, type PieceEdit } from './index'

const setup = () => {
  let id = 0
  return createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: { load: () => null, save: () => {}, clear: () => {} }, now: () => '2026-10-08T00:00:00Z', newId: () => `h${++id}` })
}
const c = setup()
const initial = c.fromExample(exampleBookcase)
const edited = (state: DesignState, id: string, edit: PieceEdit) => {
  const r = c.editPiece(state, id, edit)
  if (!r.ok) throw new Error(r.message)
  return r.state
}
const piece = (state: DesignState, id: string) => currentDesign(state).pieces.find((p) => p.id === id)
const ids = (state: DesignState) => currentDesign(state).pieces.map((p) => p.id)
const said = (state: DesignState) => state.chat.at(-1)?.text

/** v2 thins the second shelf, v3 raises the first one. */
const thinnedThenMoved = edited(edited(initial, 'shelf-2', { kind: 'thickness', material: 'T15' }), 'shelf-1', { kind: 'move', axis: 'y', delta: 30 })

describe('undoChange', () => {
  it('has nothing to undo in the first version', () => {
    expect(c.undoChange(initial, 1)).toEqual({ ok: false, message: 'Es la primera versión: no hay nada antes.' })
  })

  it('undoes the last change by going back to the version before it, as a new version', () => {
    const undone = c.undoChange(thinnedThenMoved, 3)
    if (!undone.ok) throw new Error(undone.message)
    expect(undone.state.current).toBe(4)
    expect(currentDesign(undone.state)).toEqual(thinnedThenMoved.versions.find((v) => v.n === 2)!.design)
    expect(said(undone.state)).toMatch(/^Regresé al diseño de la v2 /)
  })

  it('undoes a finish, an edge profile or a kind the person chose, which a new design would keep', () => {
    const profiled = c.chooseEdgeProfiles(initial, 'shelf-1', ['front'], 'chamfer')
    const kind = c.chooseKind(initial, 'wardrobe')
    if (!profiled.ok || !kind.ok) throw new Error('the choice was refused')
    for (const chosen of [c.chooseFinish(initial, 'paint'), profiled.state, kind.state]) {
      expect(currentDesign(chosen)).not.toEqual(currentDesign(initial))
      const undone = c.undoChange(chosen, 2)
      if (!undone.ok) throw new Error(undone.message)
      expect(currentDesign(undone.state)).toEqual(currentDesign(initial))
    }
  })

  it('undoes an older change and keeps what came after it', () => {
    const undone = c.undoChange(thinnedThenMoved, 2)
    if (!undone.ok) throw new Error(undone.message)
    expect(piece(undone.state, 'shelf-2')?.material).toBe('T18')
    expect(piece(undone.state, 'shelf-1')).toEqual(piece(thinnedThenMoved, 'shelf-1'))
    expect(said(undone.state)).toBe('Regresé Entrepaño 2 como estaba antes de la v2.')
  })
})

describe('undo and redo', () => {
  const shown = (state: DesignState) => state.versions.findIndex((v) => JSON.stringify(v.design) === JSON.stringify(currentDesign(state))) + 1
  const step = (state: DesignState, way: 'undo' | 'redo') => {
    const r = c[way](state)
    if (!r.ok) throw new Error(r.message)
    return r.state
  }

  it('undo walks back one change at a time instead of going back and forth, and stops at the first', () => {
    const once = step(thinnedThenMoved, 'undo')
    const twice = step(once, 'undo')
    expect([shown(once), shown(twice)]).toEqual([2, 1])
    expect(c.undo(twice)).toEqual({ ok: false, message: 'Es la primera versión: no hay nada antes.' })
  })

  it('redo retraces each undo in turn, and has nothing to do before an undo or past the last change', () => {
    expect(c.redo(thinnedThenMoved)).toEqual({ ok: false, message: 'No hay nada que rehacer.' })
    const back = step(step(thinnedThenMoved, 'undo'), 'undo')
    const forward = step(back, 'redo')
    const again = step(forward, 'redo')
    expect([shown(forward), shown(again)]).toEqual([2, 3])
    expect(c.redo(again).ok).toBe(false)
    expect(shown(step(again, 'undo'))).toBe(2)
  })

  it('a new change after going back leaves nothing to redo, and undo then returns to where it was made from', () => {
    const branched = edited(step(thinnedThenMoved, 'undo'), 'shelf-1', { kind: 'move', axis: 'y', delta: -20 })
    expect(c.redo(branched).ok).toBe(false)
    expect(shown(step(branched, 'undo'))).toBe(2)
  })

  it('undo passes a change that no longer builds, and a design that does not build goes back to whatever came before', () => {
    const broken = (state: DesignState, n: number): DesignState => ({ ...state, versions: state.versions.map((v) => (v.n === n ? { ...v, design: { ...v.design, pieces: v.design.pieces.map((p) => ({ ...p, material: 'no-such-board' })) } } : v)) })
    expect(shown(step(broken(thinnedThenMoved, 2), 'undo'))).toBe(1)
    const fromBroken = broken(broken(thinnedThenMoved, 3), 2)
    expect(shown(step(fromBroken, 'undo'))).toBe(2)
  })

  it('going back to a version from the history is retraced by redo too', () => {
    const jumped = c.backToVersion(thinnedThenMoved, 1)
    expect(shown(step(jumped, 'redo'))).toBe(3)
  })
})

describe('restoreFromVersion', () => {
  it('needs a version before and at least one piece', () => {
    const nothing = { ok: false, message: 'No hay una versión anterior de dónde regresar.' }
    expect(c.restoreFromVersion(thinnedThenMoved, 1, ['shelf-2'])).toEqual(nothing)
    expect(c.restoreFromVersion(thinnedThenMoved, 2, [])).toEqual(nothing)
  })

  it('takes out the pieces a change added, and puts back the ones it cut', async () => {
    const divided = await c.adjust(initial, 'agrega un divisor al centro', new AbortController().signal)
    const touched = ids(divided).filter((id) => !ids(initial).includes(id)).concat(['shelf-1', 'shelf-2', 'shelf-3', 'shelf-4', 'bottom'])
    const restored = c.restoreFromVersion(divided, 2, touched)
    if (!restored.ok) throw new Error(restored.message)
    expect(ids(restored.state).sort()).toEqual(ids(initial).sort())
    expect(piece(restored.state, 'shelf-1')).toEqual(piece(initial, 'shelf-1'))
    expect(said(restored.state)).toMatch(/^Regresé Divisor, .+ como estaban antes de la v2\.$/)
  })

  it('refuses to bring back a piece into what changed after it, and leaves the design alone', async () => {
    const divided = await c.adjust(initial, 'agrega un divisor al centro', new AbortController().signal)
    const refused = c.restoreFromVersion(divided, 2, ['shelf-1'])
    expect(refused).toMatchObject({ ok: false, message: expect.stringMatching(/^No se puede regresar así: .+/) })
  })
})
