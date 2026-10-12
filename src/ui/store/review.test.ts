import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { currentDesign } from '../../domain/session/state'
import type { ExpertResponse, LLMProvider, ReviewRequest, ReviewResponse } from '../../ports/LLMProvider'
import { useStore } from '.'
import { testServices } from './services.test-util'

function delayedExpert() {
  const simulated = createSimulated(0)
  const calls: { request: ReviewRequest; signal: AbortSignal; onResponse?: () => void; resolve: (response: ExpertResponse<ReviewResponse>) => void; reject: (error: Error) => void }[] = []
  const expert: LLMProvider = {
    ...simulated,
    reviewPurchase: (request, signal, onResponse) => new Promise((resolve, reject) => calls.push({ request, signal, onResponse, resolve, reject })),
  }
  const finish = async (index: number) => calls[index].resolve(await simulated.reviewPurchase(calls[index].request, new AbortController().signal))
  return { expert, calls, finish }
}

const initial = useStore.getState()
beforeEach(() => useStore.setState(initial, true))
afterEach(() => useStore.getState().cancelReview())

function open(expert: LLMProvider) {
  const test = testServices(expert)
  useStore.getState().start(test.services)
  useStore.getState().fromExample({ name: exampleBookcase.name, design: exampleBookcase })
  return test
}

describe('purchase review lifecycle', () => {
  it('tracks real stages and saves a review for the current design', async () => {
    const pending = delayedExpert()
    const { repository } = open(pending.expert)
    const run = useStore.getState().review()
    expect(useStore.getState().reviewProgress).toMatchObject({ stage: 'waiting', version: 1 })
    expect(useStore.getState().reviewProgress?.startedAt).toBeGreaterThan(0)
    pending.calls[0].onResponse?.()
    expect(useStore.getState().reviewProgress?.stage).toBe('receiving')
    await pending.finish(0)
    await run
    expect(useStore.getState().reviewing).toBeNull()
    expect(useStore.getState().reviewProgress).toBeNull()
    expect(repository.load()?.review?.signature).toBeTruthy()
  })

  it('cancels immediately and a late answer cannot clear or save over a newer run', async () => {
    const pending = delayedExpert()
    const { repository } = open(pending.expert)
    const first = useStore.getState().review()
    useStore.getState().cancelReview()
    expect(pending.calls[0].signal.aborted).toBe(true)
    expect(useStore.getState().reviewing).toBeNull()
    expect(useStore.getState().reviewNotice).toContain('Cancelaste')
    const second = useStore.getState().review()
    const current = useStore.getState().reviewing
    pending.calls[0].onResponse?.()
    await pending.finish(0)
    await first
    expect(useStore.getState().reviewing).toBe(current)
    expect(useStore.getState().reviewProgress?.stage).toBe('waiting')
    expect(repository.load()?.review).toBeNull()
    await pending.finish(1)
    await second
    expect(repository.load()?.review).not.toBeNull()
  })

  it('cancels after a relevant edit without starting another expert request', async () => {
    const pending = delayedExpert()
    const { repository } = open(pending.expert)
    const run = useStore.getState().review()
    useStore.getState().addNote('El mueble debe caber bajo la ventana')
    expect(pending.calls[0].signal.aborted).toBe(true)
    expect(useStore.getState().reviewNotice).toContain('Cancelamos la revisión anterior')
    expect(pending.calls).toHaveLength(1)
    await pending.finish(0)
    await run
    expect(repository.load()?.review).toBeNull()
    expect(repository.load()?.requirements).toHaveLength(1)
  })

  it('cancels a review when the furniture is resized', async () => {
    const pending = delayedExpert()
    open(pending.expert)
    const run = useStore.getState().review()
    const width = currentDesign(useStore.getState().state!).dimensions.width
    const changed = useStore.getState().resizeFurniture('x', width + 100)
    expect(changed.ok).toBe(true)
    expect(currentDesign(useStore.getState().state!).dimensions.width).toBe(width + 100)
    expect(pending.calls[0].signal.aborted).toBe(true)
    await pending.finish(0)
    await run
    expect(useStore.getState().state?.review).toBeNull()
  })

  it('cancels when cutting settings change, but keeps finishes, walls and prices', async () => {
    const pending = delayedExpert()
    open(pending.expert)
    const run = useStore.getState().review()
    useStore.getState().chooseFinish('polyurethane')
    useStore.getState().chooseWall('concrete')
    const settings = useStore.getState().catalogSettings
    useStore.getState().saveCatalogSettings({ ...settings, prices: { T18: 700 } })
    expect(pending.calls[0].signal.aborted).toBe(false)
    useStore.getState().saveCatalogSettings({ ...settings, layout: { trim: 10, kerf: 4, clearance: 2 } })
    expect(pending.calls[0].signal.aborted).toBe(true)
    await pending.finish(0)
    await run
    expect(useStore.getState().state?.review).toBeNull()
  })

  it('keeps non-structural changes made during the review', async () => {
    const pending = delayedExpert()
    const { repository } = open(pending.expert)
    const run = useStore.getState().review()
    useStore.getState().chooseFinish('paint')
    await pending.finish(0)
    await run
    expect(currentDesign(repository.load()!).finish).toBe('paint')
    expect(repository.load()?.review).not.toBeNull()
  })

  it.each(['newDesign', 'swapTo', 'fromExample'] as const)('a late review never attaches after %s, even for identical furniture', async (action) => {
    const pending = delayedExpert()
    const { repository } = open(pending.expert)
    const run = useStore.getState().review()
    const example = { name: exampleBookcase.name, design: exampleBookcase }
    if (action === 'newDesign') useStore.getState().newDesign()
    else useStore.getState()[action](example)
    expect(pending.calls[0].signal.aborted).toBe(true)
    await pending.finish(0)
    await run
    expect(repository.load()?.review ?? null).toBeNull()
    expect(useStore.getState().reviewNotice).toBeNull()
  })

  it('a cancelled failure cannot replace the status of a retry', async () => {
    const pending = delayedExpert()
    open(pending.expert)
    const first = useStore.getState().review()
    useStore.getState().cancelReview()
    const second = useStore.getState().review()
    pending.calls[0].reject(new Error('The cancelled transport failed'))
    await first
    expect(useStore.getState().verdictError).toBeNull()
    expect(useStore.getState().reviewProgress?.stage).toBe('waiting')
    await pending.finish(1)
    await second
  })
})
