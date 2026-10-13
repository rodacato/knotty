import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createUseCases, currentPlan } from '../../application/useCases'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { NO_SETTINGS } from '../../domain/materials/catalog'
import { useStore } from '../store'
import type { Services } from '../services'
import { noLibrary } from '../../adapters/persistence/library'
import { connectNavigation } from './navigation'
import { useRoom } from '../room/store'
import { studioSource } from '../room/sources'

// Only the browser history boundary is simulated; designs, plans, commands and persistence run for real.
function browser(suffix = '', delayed = false) {
  const entries = [{ url: new URL(`https://example.test/knotty/catalog/${suffix}`), state: null as unknown }]
  let position = 0
  const listeners = new Map<string, Set<() => void>>()
  const moves: (() => void)[] = []
  const notify = () => { listeners.get('popstate')?.forEach((f) => f()); listeners.get('hashchange')?.forEach((f) => f()) }
  const push = (address: string, state: unknown = null) => { const url = new URL(address, entries[position].url); entries.splice(++position); entries.push({ url, state }) }
  const b = {
    get location() { return entries[position].url },
    history: {
      get state() { return entries[position].state },
      pushState: (state: unknown, _: string, address: string) => push(address, state),
      replaceState: (state: unknown, _: string, address: string) => { entries[position] = { url: new URL(address, entries[position].url), state } },
      go: (delta: number) => { const move = () => { const target = position + delta; if (target >= 0 && target < entries.length) { position = target; notify() } }; if (delayed) moves.push(move); else queueMicrotask(move) },
    },
    addEventListener: (type: string, listener: () => void) => { const set = listeners.get(type) ?? new Set(); set.add(listener); listeners.set(type, set) },
    removeEventListener: (type: string, listener: () => void) => listeners.get(type)?.delete(listener),
    confirm: () => false,
  }
  return {
    api: b as unknown as Parameters<typeof connectNavigation>[1],
    hash: () => b.location.hash,
    search: () => b.location.search,
    addresses: () => entries.map((e) => e.url.href),
    back: () => { if (position) { position--; notify() } },
    forward: () => { if (position + 1 < entries.length) { position++; notify() } },
    visit: (address: string) => { push(address); notify() },
    count: () => entries.length,
    completeMove: () => moves.shift()?.(),
  }
}

const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }

function services(): Services {
  let saved: DesignState | null = null
  return {
    useCases: createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: { load: () => saved, save: (s) => { saved = s }, clear: () => { saved = null } } }),
    catalog: testCatalog,
    materials: { load: async () => testCatalog, settings: () => NO_SETTINGS, saveSettings: () => {} },
    preferences: { vaultState: () => 'none' } as Services['preferences'],
    images: {} as Services['images'], files: {} as Services['files'], library: noLibrary, references: testReferences,
    debug: { visible: () => false, setVisible: () => {} },
  }
}

const initial = useStore.getState()
const base = testReferences.home().find((b) => b.plan.kind === 'cabinet')!
let disconnect: (() => void) | undefined
beforeEach(() => { useRoom.setState(useRoom.getInitialState(), true); useStore.setState(initial, true); useStore.getState().start(services()) })
afterEach(() => { disconnect?.(); disconnect = undefined })

describe('catalog and studio navigation', () => {
  it('keeps room layout in memory and the current design intact through Back and Forward', async () => {
    useStore.getState().fromExample(base)
    const saved = useStore.getState().state!
    const b = browser('#studio')
    disconnect = connectNavigation(useStore, b.api)
    useRoom.getState().launch(studioSource(saved, testReferences.home()))
    const layout = useRoom.getState().layout
    useStore.getState().setRoomOpen(true)
    await settle()
    expect(b.hash()).toBe('#space')
    expect(useStore.getState().services!.useCases.load()).toBe(saved)
    b.back()
    await settle()
    expect(useStore.getState()).toMatchObject({ phase: 'studio', roomOpen: false, state: saved })
    b.forward()
    await settle()
    expect(useStore.getState().roomOpen).toBe(true)
    expect(useRoom.getState().layout).toBe(layout)
    expect(useStore.getState().state).toBe(saved)
  })

  it('shows the Studio design as it is now when Forward reopens the room after a change', async () => {
    useStore.getState().fromExample(base)
    const b = browser('#studio')
    disconnect = connectNavigation(useStore, b.api)
    useRoom.getState().launch(studioSource(useStore.getState().state!, testReferences.home()))
    useStore.getState().setRoomOpen(true)
    await settle()
    b.back()
    await settle()
    useStore.getState().chooseFinish('paint')
    const changed = currentDesign(useStore.getState().state!)
    expect(changed.finish).toBe('paint')
    b.forward()
    await settle()
    expect(useRoom.getState().layout!.items).toHaveLength(1)
    expect(useRoom.getState().layout!.items[0]).toMatchObject({ source: { design: changed } })
  })

  it('falls back from a reloaded room view to the saved Studio without inventing a room', () => {
    useStore.getState().fromExample(base)
    const s = useStore.getState().services!,
      saved = s.useCases.load()
    useStore.setState(initial, true)
    useStore.getState().start(s)
    const b = browser('#space')
    disconnect = connectNavigation(useStore, b.api)
    expect(b.hash()).toBe('#studio')
    expect(useStore.getState()).toMatchObject({ roomOpen: false, state: saved, phase: 'studio' })
    expect(useRoom.getState().layout).toBeNull()
  })


  it('opens the catalog without clearing a saved design, and restores views with Back and Forward', async () => {
    useStore.getState().fromExample(base)
    const saved = useStore.getState().state!
    const b = browser()
    disconnect = connectNavigation(useStore, b.api)
    expect(useStore.getState()).toMatchObject({ phase: 'home', state: saved })
    expect(b.hash()).toBe('#catalog')
    useStore.getState().resumeDesign()
    await settle()
    expect(b.hash()).toBe('#studio')
    useStore.getState().setStudioTab('materials')
    await settle()
    expect(b.hash()).toBe('#studio/materials')
    b.back()
    await settle()
    expect(useStore.getState()).toMatchObject({ phase: 'studio', studioTab: 'chat' })
    b.back()
    await settle()
    expect(useStore.getState().phase).toBe('home')
    b.forward(); b.forward()
    expect(useStore.getState()).toMatchObject({ phase: 'studio', studioTab: 'materials' })
    expect(useStore.getState().state).toBe(saved)
    expect(useStore.getState().services!.useCases.load()).toBe(saved)
  })

  it('restores a studio panel after a fresh startup using the existing saved repository', () => {
    useStore.getState().fromExample(base)
    const s = useStore.getState().services!
    const saved = s.useCases.load()
    useStore.setState(initial, true)
    useStore.getState().start(s)
    const b = browser('#studio/history')
    disconnect = connectNavigation(useStore, b.api)
    expect(useStore.getState()).toMatchObject({ phase: 'studio', studioOverlay: 'history' })
    expect(useStore.getState().state).toBe(saved)
    expect(b.count()).toBe(1)
  })

  it('opens a catalog adjustment without replacing the design, and falls back for missing furniture', () => {
    useStore.getState().fromExample(base)
    const saved = useStore.getState().state
    const b = browser(`#catalog/adjust/${base.code}`)
    disconnect = connectNavigation(useStore, b.api)
    expect(useStore.getState()).toMatchObject({ phase: 'home', adjusting: base })
    expect(useStore.getState().state).toBe(saved)
    b.visit('#catalog/adjust/KC-NOPE-99')
    expect(useStore.getState()).toMatchObject({ phase: 'home', adjusting: null })
    expect(b.hash()).toBe('#catalog')
  })

  it('does not invent a studio design from a URL on a first visit', () => {
    const b = browser('#studio/materials')
    disconnect = connectNavigation(useStore, b.api)
    expect(useStore.getState()).toMatchObject({ phase: 'home', state: null })
    expect(b.hash()).toBe('#catalog')
  })

  it('leaves legacy ficha words for the existing link reader instead of overwriting them', () => {
    const b = browser('#ficha=KC-MES-03&acabado=paint')
    disconnect = connectNavigation(useStore, b.api)
    useStore.getState().openSettings(true)
    expect(b.hash()).toBe('#ficha=KC-MES-03&acabado=paint')
  })

  it('keeps unapplied edits and asks through the existing editor before leaving via Back', async () => {
    useStore.getState().fromExample(base)
    const b = browser('#studio')
    disconnect = connectNavigation(useStore, b.api)
    useStore.getState().edit('outside')
    await settle()
    const plan = currentPlan(useStore.getState().state!).plan!
    if (plan.kind !== 'cabinet') throw new Error('The fixture must have a cabinet plan')
    useStore.getState().editPlan({ ...plan, dimensions: { ...plan.dimensions, width: plan.dimensions.width + 100 } })
    const draft = useStore.getState().planDraft
    expect(draft).not.toBeNull()
    const count = b.count()
    b.back()
    await settle()
    expect(useStore.getState()).toMatchObject({ phase: 'studio', editing: 'outside', leaving: true })
    expect(useStore.getState().planDraft).toBe(draft)
    expect(b.hash()).toBe('#studio/edit/outside')
    expect(b.count()).toBe(count)
  })

  it('does not silently leave a new capture or cancel a running expert through history', async () => {
    const b = browser()
    disconnect = connectNavigation(useStore, b.api)
    useStore.getState().startCapture()
    await settle()
    b.back()
    await settle()
    expect(useStore.getState().phase).toBe('capture')
    expect(b.hash()).toBe('#design')
    useStore.setState({ phase: 'analyzing' })
    b.visit('#catalog')
    await settle()
    expect(useStore.getState().phase).toBe('analyzing')
    expect(b.hash()).toBe('#design')
  })

  it('restores the same selected piece after StrictMode setup runs twice', async () => {
    useStore.getState().fromExample(base)
    const piece = useStore.getState().state!.versions[0].design.pieces[0].id
    const b = browser(`#studio/piece/${encodeURIComponent(piece)}`)
    disconnect = connectNavigation(useStore, b.api)
    expect(useStore.getState().selection).toBe(piece)
    disconnect()
    disconnect = connectNavigation(useStore, b.api)
    await settle()
    expect(useStore.getState().selection).toBe(piece)
    expect(b.hash()).toBe(`#studio/piece/${encodeURIComponent(piece)}`)
    expect(b.count()).toBe(1)
  })

  it('restores historical catalog filters and keeps them when entering and returning from an adjustment', async () => {
    const b = browser('?q=librero&cuarto=oficina#catalog')
    disconnect = connectNavigation(useStore, b.api)
    expect(useStore.getState().browsing).toEqual({ text: 'librero', room: 'office' })
    useStore.getState().adjustBase(base)
    await settle()
    useStore.getState().closeAdjust()
    useStore.getState().browse({ text: 'buró', room: 'bedroom' })
    await settle()
    expect(b.search()).toContain('cuarto=recamara')
    b.back(); await settle()
    expect(useStore.getState()).toMatchObject({ adjusting: base, browsing: { text: 'librero', room: 'office' } })
    b.back(); await settle()
    expect(b.search()).toBe('?q=librero&cuarto=oficina')
    expect(useStore.getState().browsing).toEqual({ text: 'librero', room: 'office' })
    b.forward(); b.forward(); await settle()
    expect(useStore.getState().browsing).toEqual({ text: 'buró', room: 'bedroom' })
  })

  it.each(['apply', 'discard'] as const)('respects the pending Back destination when the user chooses to %s a draft', async (choice) => {
    useStore.getState().fromExample(base)
    const b = browser()
    disconnect = connectNavigation(useStore, b.api)
    useStore.getState().resumeDesign(); await settle()
    useStore.getState().setStudioTab('materials'); await settle()
    useStore.getState().edit('outside'); await settle()
    const s = useStore.getState()
    const plan = currentPlan(s.state!).plan!
    if (plan.kind !== 'cabinet') throw new Error('The fixture must have a cabinet plan')
    s.editPlan({ ...plan, dimensions: { ...plan.dimensions, width: plan.dimensions.width + 100 } })
    const addresses = b.addresses()
    b.back(); await settle()
    expect(b.hash()).toBe('#studio/edit/outside')
    expect(useStore.getState().leaving).toBe(true)
    const result = choice === 'apply' ? s.applyPlanDraft() : (s.discardPlanDraft(), { ok: true })
    expect(result.ok).toBe(true)
    s.edit(null)
    await settle()
    expect(b.addresses()).toEqual(addresses)
    expect(b.hash()).toBe('#studio/materials')
    expect(useStore.getState()).toMatchObject({ editing: null, studioTab: 'materials', planDraft: null })
    b.back(); await settle()
    expect(b.hash()).toBe('#studio')
    b.back(); await settle()
    expect(useStore.getState().phase).toBe('home')
  })

  it('keeps the original history and draft when pending navigation is canceled', async () => {
    useStore.getState().fromExample(base)
    const b = browser('#studio')
    disconnect = connectNavigation(useStore, b.api)
    useStore.getState().edit('outside'); await settle()
    const s = useStore.getState()
    const plan = currentPlan(s.state!).plan!
    if (plan.kind !== 'cabinet') throw new Error('The fixture must have a cabinet plan')
    s.editPlan({ ...plan, dimensions: { ...plan.dimensions, width: plan.dimensions.width + 100 } })
    const addresses = b.addresses()
    const draft = useStore.getState().planDraft
    b.back(); await settle()
    s.leave(false); await settle()
    expect(b.addresses()).toEqual(addresses)
    expect(b.hash()).toBe('#studio/edit/outside')
    expect(useStore.getState()).toMatchObject({ leaving: false, planDraft: draft, editing: 'outside' })
    b.back(); await settle()
    expect(useStore.getState().leaving).toBe(true)
  })

  it('records one history transition when opening notices from a selected piece', async () => {
    useStore.getState().fromExample(base)
    const b = browser('#studio')
    disconnect = connectNavigation(useStore, b.api)
    const piece = useStore.getState().state!.versions[0].design.pieces[0].id
    useStore.getState().select(piece); await settle()
    const count = b.count()
    useStore.getState().select(null)
    useStore.getState().setStudioOverlay('notices')
    await settle()
    expect(b.count()).toBe(count + 1)
    expect(b.hash()).toBe('#studio/notices')
    b.back(); await settle()
    expect(useStore.getState().selection).toBe(piece)
  })

  it('canonicalizes unavailable editing sides and pieces to an available view', () => {
    const table = testReferences.home().find((b) => b.plan.kind === 'table')!
    useStore.getState().fromExample(table)
    const b = browser('#studio/edit/inside')
    disconnect = connectNavigation(useStore, b.api)
    expect(useStore.getState().editing).toBeNull()
    expect(b.hash()).toBe('#studio')
    b.visit('#studio/piece/missing')
    expect(useStore.getState().selection).toBeNull()
    expect(b.hash()).toBe('#studio')
  })


  it('synchronizes a completed request while the browser is still returning from a blocked Back', async () => {
    const b = browser('', true)
    disconnect = connectNavigation(useStore, b.api)
    useStore.getState().startCapture(); await settle()
    useStore.setState({ phase: 'analyzing' })
    b.back()
    useStore.getState().fromExample(base)
    await settle()
    b.completeMove(); await settle()
    expect(useStore.getState().phase).toBe('studio')
    expect(b.hash()).toBe('#studio')
  })

  it.each(['apply', 'discard', 'cancel'] as const)('completes %s while a draft-protected history return is still queued', async (choice) => {
    useStore.getState().fromExample(base)
    const b = browser('#studio', true)
    disconnect = connectNavigation(useStore, b.api)
    useStore.getState().edit('outside'); await settle()
    const s = useStore.getState()
    const plan = currentPlan(s.state!).plan!
    if (plan.kind !== 'cabinet') throw new Error('The fixture must have a cabinet plan')
    s.editPlan({ ...plan, dimensions: { ...plan.dimensions, width: plan.dimensions.width + 100 } })
    b.back()
    const result = choice === 'apply' ? s.applyPlanDraft() : { ok: true }
    expect(result.ok).toBe(true)
    if (choice === 'cancel') s.leave(false)
    else { if (choice === 'discard') s.discardPlanDraft(); s.edit(null) }
    await settle()
    b.completeMove(); await settle()
    b.completeMove(); await settle()
    expect(b.hash()).toBe(choice === 'cancel' ? '#studio/edit/outside' : '#studio')
    expect(useStore.getState().leaving).toBe(false)
    expect(useStore.getState().editing).toBe(choice === 'cancel' ? 'outside' : null)
  })

})
