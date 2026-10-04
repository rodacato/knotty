import { beforeEach, describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createUseCases } from '../../application/useCases'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import { NO_SETTINGS } from '../../domain/materials/catalog'
import type { DesignState } from '../../domain/session/state'
import type { Services } from '../services'
import { useStore } from '../store'

// One value says whether the debug tools show; the settings switch, Ctrl+Shift+D and the Konami code all go through it.

function services(saved: boolean) {
  let visible = saved
  const calls: boolean[] = []
  let state: DesignState | null = null
  const built: Services = {
    useCases: createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: { load: () => state, save: (e) => void (state = e), clear: () => void (state = null) } }),
    catalog: testCatalog,
    materials: { load: async () => testCatalog, settings: () => NO_SETTINGS, saveSettings: () => {} },
    preferences: { vaultState: () => 'none' } as unknown as Services['preferences'],
    images: {} as Services['images'],
    references: testReferences,
    debug: { visible: () => visible, setVisible: (v: boolean) => void ((visible = v), calls.push(v)) } as unknown as Services['debug'],
    bench: {} as Services['bench'],
    sandbox: { enter: () => {}, leave: () => {}, active: () => false },
  }
  return { built, calls }
}

const initial = useStore.getState()
beforeEach(() => useStore.setState(initial, true))

describe('the debug visibility', () => {
  it('starts from what was saved', () => {
    useStore.getState().start(services(false).built)
    expect(useStore.getState().debugVisible).toBe(false)
    useStore.setState(initial, true)
    useStore.getState().start(services(true).built)
    expect(useStore.getState().debugVisible).toBe(true)
  })

  it('saves what is chosen, and shows and hides from the same value', () => {
    const { built, calls } = services(false)
    useStore.getState().start(built)
    useStore.getState().setDebugVisible(true)
    expect(useStore.getState().debugVisible).toBe(true)
    useStore.getState().setDebugVisible(false)
    expect(useStore.getState().debugVisible).toBe(false)
    expect(calls).toEqual([true, false])
  })
})
