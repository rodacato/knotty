import { beforeEach, describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createUseCases } from '../../application/useCases'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { NO_SETTINGS } from '../../domain/materials/catalog'
import type { Services } from '../services'
import { ANY } from '../capture/catalog'
import { draftOf, hiddenIn, useStore } from '.'
import { currentPlan } from '../../application/useCases'
import type { CabinetPlan } from '../../domain/furniture/modules/cabinet'

// The store composed from its slices, driven with the simulated expert and in-memory adapters.

function services(): Services {
  let saved: DesignState | null = null
  const useCases = createUseCases({
    llm: () => createSimulated(0),
    catalog: testCatalog,
    repository: { load: () => saved, save: (e) => void (saved = e), clear: () => void (saved = null) },
  })
  return {
    useCases,
    catalog: testCatalog,
    materials: { load: async () => testCatalog, settings: () => NO_SETTINGS, saveSettings: () => {} },
    preferences: { vaultState: () => 'none' } as unknown as Services['preferences'],
    images: {} as Services['images'],
    references: testReferences,
    debug: { visible: () => false, setVisible: () => {} } as unknown as Services['debug'],
  }
}

const initial = useStore.getState()

beforeEach(() => {
  useStore.setState(initial, true)
  useStore.getState().start(services())
})

describe('store', () => {
  it('keeps every action of the five slices under its name', () => {
    const s = useStore.getState()
    const actions = [
      // session
      'start', 'newDesign', 'setDebugVisible', 'flag', 'startCapture', 'browse', 'browseAll', 'adjustBase', 'closeAdjust', 'fromExample', 'swapTo', 'applyProposal', 'chooseOption', 'discardProposal', 'backToVersion', 'confirmPiece', 'addNote', 'removeNote', 'removeDecision', 'applyPlan', 'applyFix', 'toggleTray', 'acceptNotice', 'reopenNotice', 'dismissQuestion', 'reopenQuestion', 'restoreFromVersion', 'undoChange', 'editPiece', 'resizeFurniture', 'lockField', 'findSavings',
      // expert
      'reconstruct', 'adjust', 'sendTray', 'cancel', 'retryReconstruction', 'review', 'cancelReview',
      // scene
      'select', 'hide', 'showAll', 'setMode', 'edit', 'leave', 'toggleDimensions', 'viewFrom', 'toggleProposal', 'viewVersion', 'previewFix',
      // plan draft
      'editPlan', 'undoPlanEdit', 'discardPlanDraft', 'applyPlanDraft', 'selectCell', 'selectPart',
      // settings
      'openSettings', 'unlock', 'forgetKeys', 'switchToSimulated', 'closeGate', 'refreshVault', 'saveCatalogSettings',
    ] as const
    expect(actions.filter((name) => typeof s[name] !== 'function')).toEqual([])
    expect(s.phase).toBe('home')
    expect(s.vault).toBe('none')
  })

  it('the logo shows every piece of furniture, and only the logo: leaving a base or the form keeps the filter', () => {
    const filtered = { text: 'mesa', room: 'dining' } as const
    const base = testReferences.home()[0]
    useStore.getState().browse(filtered)
    useStore.getState().adjustBase(base)
    useStore.getState().closeAdjust()
    expect(useStore.getState().browsing).toEqual(filtered)
    useStore.getState().startCapture()
    useStore.getState().goHome()
    expect(useStore.getState()).toMatchObject({ phase: 'home', browsing: filtered })

    useStore.getState().browseAll()
    expect(useStore.getState()).toMatchObject({ phase: 'home', browsing: ANY })

    useStore.getState().browse(filtered)
    useStore.getState().adjustBase(base)
    useStore.getState().browseAll()
    expect(useStore.getState()).toMatchObject({ phase: 'home', adjusting: null, browsing: ANY })
  })

  it('without an open design, session commands do nothing or say why', () => {
    const s = useStore.getState()
    s.addNote('algo')
    expect(useStore.getState().state).toBeNull()
    expect(s.undoChange(1)).toEqual({ ok: false, message: 'No hay un diseño abierto.' })
    expect(s.editPiece('x', { kind: 'move', axis: 'y', delta: 10 })).toEqual({ ok: false, message: 'No hay un diseño abierto.', alternatives: [] })
  })

  it('adjusting a base is a step of the home screen: it saves nothing, and going home or opening the Studio ends it', () => {
    const base = testReferences.home()[0]
    useStore.getState().adjustBase(base)
    expect(useStore.getState()).toMatchObject({ adjusting: base, phase: 'home', state: null })
    useStore.getState().closeAdjust()
    expect(useStore.getState().adjusting).toBeNull()
    useStore.getState().adjustBase(base)
    useStore.getState().goHome()
    expect(useStore.getState()).toMatchObject({ adjusting: null, phase: 'home' })
    useStore.getState().adjustBase(base)
    useStore.getState().fromExample(base)
    expect(useStore.getState()).toMatchObject({ adjusting: null, phase: 'studio' })
  })

  it('a session command replaces the state and animates the change in the scene', () => {
    useStore.getState().fromExample({ name: exampleBookcase.name, design: exampleBookcase })
    const opened = useStore.getState()
    expect(opened.phase).toBe('studio')
    expect(opened.reveal).toBe(1)
    const r = opened.editPiece('shelf-1', { kind: 'move', axis: 'y', delta: 40 })
    if (!r.ok) throw new Error(r.message)
    const after = useStore.getState()
    expect(after.state).toBe(r.state)
    expect(after.state!.versions).toHaveLength(2)
    expect(after.changes.nonce).toBe(opened.changes.nonce + 1)
    expect(after.changes.modified).toContain('shelf-1')
  })

  it('opening another design leaves behind what the scene kept about the one before', () => {
    const bookcase = { name: exampleBookcase.name, design: exampleBookcase }
    useStore.getState().fromExample(bookcase)
    const r = useStore.getState().editPiece('shelf-1', { kind: 'move', axis: 'y', delta: 40 })
    if (!r.ok) throw new Error(r.message)
    useStore.getState().viewVersion(1)
    useStore.getState().hide('shelf-1')
    useStore.getState().fromExample(bookcase)
    expect(useStore.getState()).toMatchObject({ viewedVersion: null, preview: null, hidden: [], selection: null })
    useStore.getState().viewVersion(1)
    useStore.getState().newDesign()
    expect(useStore.getState()).toMatchObject({ viewedVersion: null, state: null, phase: 'home' })
  })

  it('an expert request shows the message at once and the answer when it arrives', async () => {
    useStore.getState().fromExample({ name: exampleBookcase.name, design: exampleBookcase })
    const asking = useStore.getState().adjust('Hazlo de 90 cm de ancho')
    expect(useStore.getState().thinking).toBe(true)
    expect(useStore.getState().state!.chat.at(-1)!.id).toBe('pending')
    await asking
    const s = useStore.getState()
    expect(s.thinking).toBe(false)
    expect(s.stage).toBeNull()
    expect(s.state!.chat.some((m) => m.id === 'pending')).toBe(false)
    expect(s.changes.nonce).toBe(1)
    expect(currentDesign(s.state!).name).toBe(exampleBookcase.name)
  })

  it('coming apart or opening turns the camera to the front three-quarter view; closing again leaves the view', () => {
    const s = useStore.getState()
    for (const mode of ['exploded', 'open'] as const) {
      s.viewFrom('front')
      s.setMode(mode)
      expect(useStore.getState()).toMatchObject({ mode, view: { name: 'three-quarter' } })
      useStore.getState().viewFrom('side')
      useStore.getState().setMode('closed')
      expect(useStore.getState()).toMatchObject({ mode: 'closed', view: { name: 'side' } })
    }
  })

  it('open and apart replace each other, and choosing the mode it is in changes nothing', () => {
    const s = useStore.getState()
    s.setMode('open')
    useStore.getState().setMode('exploded')
    expect(useStore.getState().mode).toBe('exploded')
    useStore.getState().viewFrom('top')
    useStore.getState().setMode('exploded')
    expect(useStore.getState().view.name).toBe('top')
  })

  it('hiding the piece that opened a part keeps the part open and forgets the piece, and leaves another part\'s piece alone', () => {
    useStore.getState().fromExample({ name: exampleBookcase.name, design: exampleBookcase })
    useStore.getState().selectPart('body', 'top')
    useStore.getState().hide('back')
    expect(useStore.getState().part).toEqual({ id: 'body', piece: 'top' })
    useStore.getState().hide('top')
    expect(useStore.getState().part).toEqual({ id: 'body', piece: null })
  })

  it('hides a piece without touching the design, and shows them all again', () => {
    useStore.getState().fromExample({ name: exampleBookcase.name, design: exampleBookcase })
    const before = useStore.getState().state
    useStore.getState().select('shelf-1')
    useStore.getState().hide('shelf-1')
    useStore.getState().hide('shelf-1')
    useStore.getState().hide('back')
    let s = useStore.getState()
    expect(s.hidden).toEqual(['shelf-1', 'back'])
    expect(s.selection).toBeNull()
    expect(s.state).toBe(before)
    expect(currentDesign(s.state!).pieces.map((p) => p.id)).toContain('shelf-1')
    s.showAll()
    expect(useStore.getState().hidden).toEqual([])
    s = useStore.getState()
    s.hide('top')
    s.fromExample({ name: exampleBookcase.name, design: exampleBookcase })
    expect(useStore.getState().hidden).toEqual([])
  })

  it('a hidden piece a change removed no longer counts', () => {
    const withoutShelf = { ...exampleBookcase, pieces: exampleBookcase.pieces.filter((p) => p.id !== 'shelf-4') }
    expect(hiddenIn(['shelf-4', 'top'], withoutShelf)).toEqual(['top'])
  })
})

describe('the plan draft', () => {
  const openCabinet = () => {
    const base = testReferences.home().find((b) => b.plan?.kind === 'cabinet')!
    useStore.getState().fromExample(base)
    const s = useStore.getState()
    return { plan: currentPlan(s.state!).plan as CabinetPlan, version: s.state!.current }
  }
  const wider = (plan: CabinetPlan, by: number): CabinetPlan => ({ ...plan, dimensions: { ...plan.dimensions, width: plan.dimensions.width + by } })

  it('builds each change at once and shows it, without making a version', () => {
    const { plan, version } = openCabinet()
    useStore.getState().editPlan(wider(plan, 100))
    const s = useStore.getState()
    expect(draftOf(s)?.design?.dimensions.width).toBe(plan.dimensions.width + 100)
    expect(s.state!.current).toBe(version)
  })

  it('undoes one change at a time, and back at the applied plan there is no draft', () => {
    const { plan } = openCabinet()
    const s = useStore.getState()
    s.editPlan(wider(plan, 100))
    s.editPlan(wider(plan, 200))
    s.undoPlanEdit()
    expect((draftOf(useStore.getState())!.plan as CabinetPlan).dimensions.width).toBe(plan.dimensions.width + 100)
    s.undoPlanEdit()
    expect(draftOf(useStore.getState())).toBeNull()
  })

  it('says of a change only what the builder did not already say of the applied plan', () => {
    const notched = testReferences.home().find((b) => b.plan?.kind === 'cabinet' && b.plan.construction.pulls === 'notch')!
    const plan = notched.plan as CabinetPlan
    useStore.getState().fromExample(notched)
    useStore.getState().editPlan(wider(plan, 100))
    expect(draftOf(useStore.getState())!.notes.filter((n) => n.startsWith('Muesca'))).toEqual([])

    useStore.getState().fromExample({ ...notched, plan: { ...plan, construction: { ...plan.construction, pulls: 'none' } } })
    useStore.getState().editPlan(plan)
    expect(draftOf(useStore.getState())!.notes.filter((n) => n.startsWith('Muesca'))).toHaveLength(1)
  })

  const sized = (plan: CabinetPlan, size: Partial<CabinetPlan['dimensions']>): CabinetPlan => ({ ...plan, dimensions: { ...plan.dimensions, ...size } })
  const draftSize = () => (draftOf(useStore.getState())?.plan as CabinetPlan | undefined)?.dimensions
  /** Each character of a measure as the form sends it: the plan so far, with the key of its field. */
  const type = (from: CabinetPlan, side: 'width' | 'height', text: string) =>
    [...text].reduce((plan, _, i) => {
      const next = sized(plan, { [side]: Number(text.slice(0, i + 1)) })
      useStore.getState().editPlan(next, `dimensions.${side}`)
      return next
    }, from)

  it('undoes a typed measure whole, never back to one half typed', () => {
    const { plan } = openCabinet()
    type(plan, 'width', '1200')
    expect(draftSize()?.width).toBe(1200)
    expect(draftOf(useStore.getState())!.steps).toEqual([plan])
    useStore.getState().undoPlanEdit()
    expect(draftOf(useStore.getState())).toBeNull()
  })

  it('undoes two measures typed in a row one at a time', () => {
    const { plan } = openCabinet()
    type(type(plan, 'width', '1200'), 'height', '1500')
    expect(draftSize()).toMatchObject({ width: 1200, height: 1500 })
    useStore.getState().undoPlanEdit()
    expect(draftSize()).toMatchObject({ width: 1200, height: plan.dimensions.height })
    useStore.getState().undoPlanEdit()
    expect(draftOf(useStore.getState())).toBeNull()
  })

  it('typing in a field again after another change or an undo is a step of its own', () => {
    const { plan } = openCabinet()
    const typed = type(plan, 'width', '1200')
    const deeper = sized(typed, { depth: plan.dimensions.depth + 50 })
    useStore.getState().editPlan(deeper)
    type(deeper, 'width', '1300')
    useStore.getState().undoPlanEdit()
    expect(draftSize()).toMatchObject({ width: 1200, depth: plan.dimensions.depth + 50 })
    type(deeper, 'width', '1400')
    useStore.getState().undoPlanEdit()
    expect(draftSize()).toMatchObject({ width: 1200, depth: plan.dimensions.depth + 50 })
    useStore.getState().undoPlanEdit()
    expect(draftSize()).toMatchObject({ width: 1200, depth: plan.dimensions.depth })
    useStore.getState().undoPlanEdit()
    expect(draftOf(useStore.getState())).toBeNull()
  })

  it('keeps a plan that cannot be built, with why and nothing to show', () => {
    const { plan } = openCabinet()
    useStore.getState().editPlan({ ...plan, base: 'legs', legHeight: 150, dimensions: { ...plan.dimensions, height: 300 } })
    const draft = draftOf(useStore.getState())!
    expect(draft.design).toBeNull()
    expect(draft.message).toMatch(/patas/)
    expect(useStore.getState().applyPlanDraft().ok).toBe(false)
  })

  it('applying makes one version and ends the draft', () => {
    const { plan, version } = openCabinet()
    useStore.getState().editPlan(wider(plan, 100))
    expect(useStore.getState().applyPlanDraft().ok).toBe(true)
    const s = useStore.getState()
    expect(s.state!.current).toBe(version + 1)
    expect(draftOf(s)).toBeNull()
  })

  it('editing inside looks from the front with no piece chosen, and leaving goes back to how the person was looking', () => {
    openCabinet()
    const s = useStore.getState()
    s.setMode('exploded')
    s.viewFrom('side')
    s.select('side-left')
    s.edit('inside')
    expect(useStore.getState()).toMatchObject({ editing: 'inside', mode: 'closed', view: { name: 'front' }, selection: null })
    useStore.getState().selectCell([0, 0])
    useStore.getState().edit(null)
    expect(useStore.getState()).toMatchObject({ editing: null, mode: 'exploded', view: { name: 'side' }, cell: null })
  })

  it('editing outside looks from three-quarter with the drawers in, whatever the person was looking at', () => {
    openCabinet()
    const s = useStore.getState()
    s.setMode('open')
    s.viewFrom('top')
    s.edit('outside')
    expect(useStore.getState()).toMatchObject({ editing: 'outside', mode: 'closed', view: { name: 'three-quarter' } })
  })

  it('leaving with changes not applied asks first and stays; without any, it leaves', () => {
    const { plan } = openCabinet()
    useStore.getState().edit('outside')
    useStore.getState().editPlan(wider(plan, 100))
    useStore.getState().leave()
    expect(useStore.getState()).toMatchObject({ editing: 'outside', leaving: true })
    useStore.getState().leave(false)
    expect(useStore.getState()).toMatchObject({ editing: 'outside', leaving: false })
    useStore.getState().discardPlanDraft()
    useStore.getState().leave()
    expect(useStore.getState()).toMatchObject({ editing: null, leaving: false })
  })

  it('opening a part lets go of the chosen piece, and moving to the other side closes it but keeps where to go back', () => {
    openCabinet()
    const s = useStore.getState()
    s.edit('outside')
    s.select('side-left')
    s.selectPart('body', 'side-left')
    expect(useStore.getState()).toMatchObject({ selection: null, part: { id: 'body', piece: 'side-left' } })
    useStore.getState().edit('inside')
    expect(useStore.getState()).toMatchObject({ part: null, beforeEditing: { mode: 'closed', view: 'three-quarter' } })
  })

  it('is left behind by a version made anywhere else', () => {
    const { plan } = openCabinet()
    useStore.getState().editPlan(wider(plan, 100))
    useStore.getState().applyPlan(wider(plan, 300))
    expect(draftOf(useStore.getState())).toBeNull()
  })
})
