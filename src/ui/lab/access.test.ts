import { beforeEach, describe, expect, it } from 'vitest'
import { createSandboxedRepository } from '../../adapters/persistence/sandbox'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createUseCases } from '../../application/useCases'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import { NO_SETTINGS } from '../../domain/materials/catalog'
import { currentDesign, type DesignState } from '../../domain/session/state'
import type { Services } from '../services'
import { useStore } from '../store'

// The workshop is entered only from the debug access, and what it does never reaches the saved design.

function services(debugVisible: boolean) {
  let saved: DesignState | null = null
  const repository = createSandboxedRepository({ load: () => saved, save: (e) => void (saved = e), clear: () => void (saved = null) })
  const useCases = createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository })
  const built: Services = {
    useCases,
    catalog: testCatalog,
    materials: { load: async () => testCatalog, settings: () => NO_SETTINGS, saveSettings: () => {} },
    preferences: { vaultState: () => 'none' } as unknown as Services['preferences'],
    images: {} as Services['images'],
    references: testReferences,
    debug: { visible: () => debugVisible } as unknown as Services['debug'],
    bench: {} as Services['bench'],
    sandbox: repository,
  }
  return built
}

const initial = useStore.getState()
const mine = { name: 'Mi librero', design: { ...exampleBookcase, name: 'Mi librero' } }
const variant = { name: 'Variante', design: { ...exampleBookcase, name: 'Variante' } }

beforeEach(() => useStore.setState(initial, true))

describe('the workshop', () => {
  it('does not open without the debug access', () => {
    useStore.getState().start(services(false))
    useStore.getState().fromExample(mine)
    useStore.getState().enterLab()
    expect(useStore.getState().phase).toBe('studio')
    expect(currentDesign(useStore.getState().state!).name).toBe('Mi librero')
  })

  it('keeps its own screen whatever it opens, and gives the saved design back on leaving', () => {
    const s = services(true)
    useStore.getState().start(s)
    useStore.getState().fromExample(mine)
    useStore.getState().enterLab()
    expect(useStore.getState().phase).toBe('lab')
    expect(useStore.getState().state).toBeNull()

    useStore.getState().fromExample(variant)
    expect(useStore.getState().phase).toBe('lab')
    useStore.getState().newDesign()
    expect(useStore.getState().phase).toBe('lab')
    useStore.getState().fromExample(variant)

    useStore.getState().leaveLab()
    expect(useStore.getState().phase).toBe('studio')
    expect(currentDesign(useStore.getState().state!).name).toBe('Mi librero')
    expect(currentDesign(s.useCases.load()!).name).toBe('Mi librero')
  })
})
