import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { currentPlan } from '../../application/useCases'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import type { CabinetPlan } from '../../domain/furniture/modules/cabinet'
import { currentDesign } from '../../domain/session/state'
import type { LLMProvider } from '../../ports/LLMProvider'
import { useStore } from '.'
import { testServices } from './services.test-util'

const [cabinet, anotherCabinet] = testReferences.home().filter((b) => b.plan.kind === 'cabinet')
const bookcase = { name: exampleBookcase.name, design: exampleBookcase }

/** A design that is already whole and that the store under test never saw: another session built it. */
const elsewhere = () => testServices().services.useCases.openExample(anotherCabinet)

/** An expert that answers only when released, and whose answer no cancelling stops: the late answer always arrives. */
function lateExpert() {
  const simulated = createSimulated(0)
  const unstoppable = new AbortController().signal
  let release = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  const late = <A, R>(call: (request: A, signal: AbortSignal) => Promise<R>) => async (request: A) => {
    await held
    return call(request, unstoppable)
  }
  const reviews: AbortSignal[] = []
  const expert: LLMProvider = {
    ...simulated,
    reconstruct: late(simulated.reconstruct),
    proposeAdjustment: late(simulated.proposeAdjustment),
    planDesign: simulated.planDesign && late(simulated.planDesign),
    adjustPlan: simulated.adjustPlan && late(simulated.adjustPlan),
    reviewPurchase: async (request, signal) => {
      reviews.push(signal)
      await held
      return simulated.reviewPurchase(request, unstoppable)
    },
  }
  return { expert, release: () => release(), reviews }
}

const wider = (plan: CabinetPlan, by: number): CabinetPlan => ({ ...plan, dimensions: { ...plan.dimensions, width: plan.dimensions.width + by } })

const initial = useStore.getState()
beforeEach(() => useStore.setState(initial, true))
afterEach(() => useStore.getState().cancelReview())

function started(expert?: LLMProvider) {
  const test = testServices(expert)
  useStore.getState().start(test.services)
  return test
}

describe('opening a design that is already whole', () => {
  it('lands in the Studio on it, appearing from scratch, and it is the one saved', () => {
    const { services } = started()
    const design = elsewhere()
    useStore.getState().viewFrom('top')
    const before = useStore.getState()
    useStore.getState().openDesign(design)
    const s = useStore.getState()
    expect(s.state).toBe(design)
    expect(s).toMatchObject({ phase: 'studio', reveal: before.reveal + 1, view: { name: 'three-quarter', nonce: before.view.nonce + 1 } })
    expect(services.useCases.load()).toBe(design)
  })

  it('takes the place of the design that was open, in the Studio and in what is saved', () => {
    const { repository } = started()
    useStore.getState().fromExample(bookcase)
    useStore.getState().addNote('Que quepa la impresora')
    const design = elsewhere()
    useStore.getState().openDesign(design)
    expect(useStore.getState().state).toBe(design)
    expect(repository.load()).toBe(design)
    expect(repository.load()!.requirements).toEqual([])
  })

  it('leaves the capture and the home behind', () => {
    started()
    useStore.getState().adjustBase(cabinet)
    useStore.getState().startCapture()
    useStore.getState().openDesign(elsewhere())
    expect(useStore.getState()).toMatchObject({ phase: 'studio', adjusting: null, draft: null, reconstructionError: null })
  })

  it('does nothing before the app has started', () => {
    useStore.getState().openDesign(elsewhere())
    expect(useStore.getState()).toMatchObject({ state: null, phase: 'home', reveal: 0 })
  })

  it('stops the expert while it answers, and the late answer replaces nothing in the Studio or in what is saved', async () => {
    const pending = lateExpert()
    const { repository } = started(pending.expert)
    useStore.getState().fromExample(bookcase)
    const asking = useStore.getState().adjust('Hazlo de 90 cm de ancho')
    const call = useStore.getState().controller!
    expect(useStore.getState().thinking).toBe(true)
    const design = elsewhere()
    useStore.getState().openDesign(design)
    expect(call.signal.aborted).toBe(true)
    expect(useStore.getState()).toMatchObject({ thinking: false, stage: null, controller: null })
    pending.release()
    await asking
    expect(useStore.getState().state).toBe(design)
    expect(useStore.getState()).toMatchObject({ phase: 'studio', thinking: false })
    expect(repository.load()).toBe(design)
  })

  it('stops the expert while it designs, and the furniture it finishes late never opens', async () => {
    const pending = lateExpert()
    const { repository } = started(pending.expert)
    const designing = useStore.getState().reconstruct({ measures: null, photos: [], thumbnails: [], notes: 'Un librero con repisas para libros', kind: null })
    const call = useStore.getState().controller!
    expect(useStore.getState().phase).toBe('analyzing')
    const design = elsewhere()
    useStore.getState().openDesign(design)
    expect(call.signal.aborted).toBe(true)
    expect(useStore.getState()).toMatchObject({ phase: 'studio', draft: null, stage: null, controller: null })
    pending.release()
    await designing
    expect(useStore.getState().state).toBe(design)
    expect(useStore.getState()).toMatchObject({ phase: 'studio', reconstructionError: null })
    expect(repository.load()).toBe(design)
  })

  it('carries nothing over of how the design before was being seen, edited or reviewed', async () => {
    const pending = lateExpert()
    const { repository } = started(pending.expert)
    const s = () => useStore.getState()
    s().fromExample(cabinet)
    const plan = currentPlan(s().state!).plan as CabinetPlan
    expect(s().applyPlan(wider(plan, 100)).ok).toBe(true)
    const [one, two] = currentDesign(s().state!).pieces.map((p) => p.id)
    s().setMode('exploded')
    s().edit('outside')
    s().editPlan(wider(plan, 200))
    s().leave()
    s().viewVersion(1)
    s().select(one)
    s().hide(two)
    s().flag([one])
    s().toggleProposal()
    s().openTakeAway(true)
    s().setStudioTab('materials')
    s().setStudioOverlay('history')
    const reviewing = s().review()
    expect(s()).toMatchObject({ selection: one, focus: one, hidden: [two], flagged: [one], viewedVersion: 1, editing: 'outside', leaving: true, showProposal: false, takeAway: true })
    expect(s().planDraft).not.toBeNull()
    expect(s().reviewing).not.toBeNull()

    const design = elsewhere()
    s().openDesign(design)
    expect(s()).toMatchObject({
      selection: null,
      focus: null,
      hidden: [],
      flagged: [],
      viewedVersion: null,
      preview: null,
      planDraft: null,
      cell: null,
      part: null,
      editing: null,
      beforeEditing: null,
      leaving: false,
      mode: 'closed',
      showProposal: true,
      takeAway: false,
      studioTab: 'chat',
      studioOverlay: null,
      reviewing: null,
      reviewProgress: null,
      reviewNotice: null,
      verdictError: null,
    })
    expect(pending.reviews[0].aborted).toBe(true)
    pending.release()
    await reviewing
    expect(s().state).toBe(design)
    expect(s().reviewNotice).toBeNull()
    expect(repository.load()).toBe(design)
    expect(repository.load()!.review).toBeNull()
  })
})

describe('an example opened over a design the expert is working on', () => {
  it('stops the answer in progress, which never comes back over the example', async () => {
    const pending = lateExpert()
    const { repository } = started(pending.expert)
    useStore.getState().fromExample(bookcase)
    const asking = useStore.getState().adjust('Hazlo de 90 cm de ancho')
    const call = useStore.getState().controller!
    useStore.getState().fromExample(cabinet)
    const example = useStore.getState().state
    expect(call.signal.aborted).toBe(true)
    expect(useStore.getState().thinking).toBe(false)
    pending.release()
    await asking
    expect(useStore.getState().state).toBe(example)
    expect(repository.load()).toBe(example)
  })

  it('stops the design in progress, which never opens over the example', async () => {
    const pending = lateExpert()
    const { repository } = started(pending.expert)
    const designing = useStore.getState().reconstruct({ measures: null, photos: [], thumbnails: [], notes: 'Un librero con repisas para libros', kind: null })
    useStore.getState().fromExample(cabinet)
    const example = useStore.getState().state
    pending.release()
    await designing
    expect(useStore.getState().state).toBe(example)
    expect(repository.load()).toBe(example)
  })
})

describe('a design the expert finishes', () => {
  it('opens without what the Studio kept about the design that was saved before', async () => {
    started()
    const s = () => useStore.getState()
    s().fromExample(cabinet)
    const plan = currentPlan(s().state!).plan as CabinetPlan
    expect(s().applyPlan(wider(plan, 100)).ok).toBe(true)
    s().setMode('exploded')
    s().editPlan(wider(plan, 200))
    s().viewVersion(1)
    s().flag([currentDesign(s().state!).pieces[0].id])
    s().setStudioOverlay('history')
    s().startCapture()
    await s().reconstruct({ measures: null, photos: [], thumbnails: [], notes: 'Un librero con repisas para libros', kind: null })
    expect(s()).toMatchObject({ phase: 'studio', viewedVersion: null, planDraft: null, flagged: [], mode: 'closed', studioOverlay: null })
  })
})
