import { beforeEach, describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createUseCases } from '../../application/useCases'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { NO_SETTINGS } from '../../domain/materials/catalog'
import type { DebugEvent, DebugLog } from '../../ports/DebugLog'
import { instrumentStore } from '../debug/instrument'
import type { Services } from '../services'
import { useStore } from '.'

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
    debug: {} as Services['debug'],
    bench: {} as Services['bench'],
  }
}

const initial = useStore.getState()

beforeEach(() => {
  useStore.setState(initial, true)
  useStore.getState().start(services())
})

describe('store', () => {
  it('keeps every action of the four slices under its name', () => {
    const s = useStore.getState()
    const actions = [
      // session
      'start', 'newDesign', 'startCapture', 'fromExample', 'openState', 'applyProposal', 'chooseOption', 'discardProposal', 'backToVersion', 'confirmPiece', 'addNote', 'removeNote', 'removeDecision', 'applyPlan', 'applyFix', 'toggleTray', 'acceptNotice', 'reopenNotice', 'restoreFromVersion', 'undoChange', 'editPiece', 'resizeFurniture',
      // expert
      'reconstruct', 'adjust', 'sendTray', 'cancel', 'retryReconstruction', 'review', 'cancelReview',
      // scene
      'select', 'toggleExploded', 'toggleDimensions', 'viewFrom', 'toggleProposal', 'viewVersion', 'previewFix',
      // settings
      'openSettings', 'unlock', 'forgetKeys', 'switchToSimulated', 'closeGate', 'refreshVault', 'saveCatalogSettings',
    ] as const
    expect(actions.filter((name) => typeof s[name] !== 'function')).toEqual([])
    expect(s.phase).toBe('home')
    expect(s.vault).toBe('none')
  })

  it('without an open design, session commands do nothing or say why', () => {
    const s = useStore.getState()
    s.addNote('algo')
    expect(useStore.getState().state).toBeNull()
    expect(s.undoChange(1)).toEqual({ ok: false, message: 'No hay un diseño abierto.' })
    expect(s.editPiece('x', { kind: 'move', axis: 'y', delta: 10 })).toEqual({ ok: false, message: 'No hay un diseño abierto.', alternatives: [] })
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

  it('the debug log wraps actions by name without changing what they do', () => {
    const events: Omit<DebugEvent, 'at'>[] = []
    const stop = instrumentStore({ record: (e: Omit<DebugEvent, 'at'>) => events.push(e) } as unknown as DebugLog)
    useStore.getState().fromExample({ name: exampleBookcase.name, design: exampleBookcase })
    stop()
    expect(events.map((e) => e.summary)).toEqual([`Abrir el ejemplo ${exampleBookcase.name}`])
    expect(useStore.getState().phase).toBe('studio')
  })
})
