import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createUseCases } from '../../application/useCases'
import { analyze, type Analysis } from '../../domain/checks/analysis'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { markedPieces, overlayAfter, proposalChanges, shownInstead, shownOf } from './view'

const useCases = createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: { load: () => null, save: () => {}, clear: () => {} } })

/** A bookcase with two versions: the example, and the same with a shelf moved up. */
function twoVersions(): DesignState {
  const r = useCases.editPiece(useCases.openExample({ name: exampleBookcase.name, design: exampleBookcase }), 'shelf-1', { kind: 'move', axis: 'y', delta: 40 })
  if (!r.ok) throw new Error(r.message)
  return r.state
}

const looking = { viewedVersion: null, showProposal: true, preview: null }

describe('what the Studio shows', () => {
  const state = twoVersions()
  const first = state.versions[0].design
  const proposed = { ...state, proposal: { design: first } as DesignState['proposal'] }

  it('shows the current design when nothing else is in view', () => {
    expect(shownOf(state, looking)).toEqual({ design: currentDesign(state), proposal: null })
  })

  it('shows the proposal while it is on, and the current design when the person turns it off', () => {
    expect(shownOf(proposed, looking)).toEqual({ design: first, proposal: first })
    expect(shownOf(proposed, { ...looking, showProposal: false })).toEqual({ design: currentDesign(state), proposal: null })
  })

  it('an old version in view is not a proposal, even with one pending', () => {
    expect(shownOf(proposed, { ...looking, viewedVersion: 1 })).toEqual({ design: first, proposal: null })
  })

  it('a previewed fix comes before everything else and counts as the proposal', () => {
    const fix = { ...currentDesign(state), name: 'Con la solución' }
    expect(shownOf(proposed, { ...looking, viewedVersion: 1, preview: { design: fix } })).toEqual({ design: fix, proposal: fix })
  })

  it('says what is on screen in place of the current design, and nothing while it is the current one', () => {
    const fix = { ...currentDesign(state), name: 'Con la solución' }
    expect(shownInstead(proposed, looking)).toBe('la propuesta sin aplicar')
    expect(shownInstead(proposed, { ...looking, viewedVersion: 1 })).toBe('la v1')
    expect(shownInstead(state, { ...looking, preview: { design: fix } })).toBe('una solución sin aplicar')
    expect(shownInstead(state, { ...looking, preview: { design: fix, draft: true } })).toBe('los cambios de la ficha sin aplicar')
    expect(shownInstead(state, looking)).toBeNull()
    expect(shownInstead(proposed, { ...looking, showProposal: false })).toBeNull()
    expect(shownInstead(state, { ...looking, viewedVersion: state.current })).toBeNull()
  })

  it('a proposal marks what it changes, and nothing without one', () => {
    const current = currentDesign(state)
    const [now, before] = [analyze(current, testCatalog), analyze(first, testCatalog)]
    expect(proposalChanges(current, now, first, before).changed).toContain('shelf-1')
    expect(proposalChanges(current, now, null, now)).toEqual({ added: [], changed: [] })
  })

  it('a proposal that is not a piece of furniture yet marks nothing', () => {
    const current = currentDesign(state)
    const broken: Analysis = { valid: false, errors: [] }
    expect(proposalChanges(current, analyze(current, testCatalog), first, broken)).toEqual({ added: [], changed: [] })
  })

  it('marks the pieces the errors name and the flagged ones, once each, and only those the design has', () => {
    const design = currentDesign(state)
    const errors = [{ code: 'E_X', message: '', data: { piece: 'shelf-1', other: 'gone', gap: 3 } }] as unknown as Extract<Analysis, { valid: false }>['errors']
    expect(markedPieces(design, { valid: false, errors }, ['shelf-1', 'top', 'removed'])).toEqual(['shelf-1', 'top'])
    expect(markedPieces(design, analyze(design, testCatalog), [])).toEqual([])
  })
})

describe('what a header button does to notices and history', () => {
  it('opens the one asked for, also in place of the other', () => {
    expect(overlayAfter(null, 'notices', false)).toBe('notices')
    expect(overlayAfter('history', 'notices', false)).toBe('notices')
  })

  it('closes the one in sight when it is asked for again', () => {
    expect(overlayAfter('notices', 'notices', false)).toBeNull()
  })

  it('never closes one the person cannot see: under the piece sheet it is shown', () => {
    expect(overlayAfter('notices', 'notices', true)).toBe('notices')
    expect(overlayAfter(null, 'history', true)).toBe('history')
  })
})
