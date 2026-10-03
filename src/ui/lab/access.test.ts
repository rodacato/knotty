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

// The sandbox is a state of the app: it starts when something from the bench opens, only with the debug access, and what it does never reaches the saved design.

function services(debugVisible: boolean) {
  let saved: DesignState | null = null
  const repository = createSandboxedRepository({ load: () => saved, save: (e) => void (saved = e), clear: () => void (saved = null) })
  const built: Services = {
    useCases: createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository }),
    catalog: testCatalog,
    materials: { load: async () => testCatalog, settings: () => NO_SETTINGS, saveSettings: () => {} },
    preferences: { vaultState: () => 'none' } as unknown as Services['preferences'],
    images: {} as Services['images'],
    references: testReferences,
    debug: { visible: () => debugVisible, setVisible: () => {} } as unknown as Services['debug'],
    bench: {} as Services['bench'],
    sandbox: repository,
  }
  return built
}

const initial = useStore.getState()
const mine = { name: 'Mi librero', design: { ...exampleBookcase, name: 'Mi librero' } }
const variant = { name: 'Variante', design: { ...exampleBookcase, name: 'Variante' } }
const name = () => currentDesign(useStore.getState().state!).name

beforeEach(() => useStore.setState(initial, true))

describe('the sandbox', () => {
  it('does not start without the debug access', () => {
    useStore.getState().start(services(false))
    useStore.getState().fromExample(mine)
    useStore.getState().sandboxExample(variant)
    expect(useStore.getState().sandboxed).toBe(false)
    expect(name()).toBe('Mi librero')
  })

  it('starts when something opens, keeps every screen working inside, and gives the saved design back on leaving', () => {
    const s = services(true)
    useStore.getState().start(s)
    useStore.getState().fromExample(mine)

    useStore.getState().sandboxExample(variant)
    expect(useStore.getState().sandboxed).toBe(true)
    expect(useStore.getState().phase).toBe('studio')
    expect(name()).toBe('Variante')

    useStore.getState().newDesign()
    expect(useStore.getState().phase).toBe('capture')
    expect(useStore.getState().sandboxed).toBe(true)
    useStore.getState().fromExample(variant)

    useStore.getState().leaveSandbox()
    expect(useStore.getState().sandboxed).toBe(false)
    expect(useStore.getState().phase).toBe('studio')
    expect(name()).toBe('Mi librero')
    expect(currentDesign(s.useCases.load()!).name).toBe('Mi librero')
  })

  it('opens from Home, where there is no design, and leaves back to Home', () => {
    useStore.getState().start(services(true))
    expect(useStore.getState().phase).toBe('home')
    useStore.getState().sandboxExample(variant)
    expect(useStore.getState().phase).toBe('studio')
    useStore.getState().leaveSandbox()
    expect(useStore.getState().phase).toBe('home')
    expect(useStore.getState().state).toBeNull()
  })

  it('remembers the ficha a design came from, and forgets it on leaving', () => {
    useStore.getState().start(services(true))
    useStore.getState().sandboxExample(variant, 'KC-APA-01')
    expect(useStore.getState().sandboxOrigin).toBe('KC-APA-01')
    useStore.getState().sandboxState(useStore.getState().state!)
    expect(useStore.getState().sandboxOrigin).toBeNull()
    useStore.getState().sandboxExample(variant, 'KC-APA-01')
    useStore.getState().leaveSandbox()
    expect(useStore.getState().sandboxOrigin).toBeNull()
  })
})
