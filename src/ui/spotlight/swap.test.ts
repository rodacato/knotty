import { beforeEach, describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createUseCases, currentPlan } from '../../application/useCases'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import { NO_SETTINGS } from '../../domain/materials/catalog'
import type { CabinetPlan } from '../../domain/furniture/modules/cabinet'
import type { DesignState } from '../../domain/session/state'
import { verdictsOf } from '../lab/verdicts'
import type { Services } from '../services'
import { useStore } from '../store'
import { swapLoss } from './swap'

let saved: DesignState | null = null

function services(): Services {
  saved = null
  return {
    useCases: createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: { load: () => saved, save: (s) => void (saved = s), clear: () => void (saved = null) } }),
    catalog: testCatalog,
    materials: { load: async () => testCatalog, settings: () => NO_SETTINGS, saveSettings: () => {} },
    preferences: { vaultState: () => 'none' } as unknown as Services['preferences'],
    images: {} as Services['images'],
    references: testReferences,
    debug: { visible: () => false, setVisible: () => {} },
  }
}

const [first, second] = testReferences.home().filter((b) => b.plan.kind === 'cabinet')
const loss = () => swapLoss(useStore.getState().phase, useStore.getState().state)

const initial = useStore.getState()
beforeEach(() => {
  useStore.setState(initial, true)
  useStore.getState().start(services())
})

describe('what swapping the furniture would lose', () => {
  it('is nothing on the home screen, or on a ficha as it was opened', () => {
    expect(loss()).toBeNull()
    useStore.getState().swapTo(first)
    expect(loss()).toBeNull()
  })

  it('is the design once the person changed its plan, wrote a note or set something aside', () => {
    useStore.getState().swapTo(first)
    const plan = currentPlan(useStore.getState().state!).plan as CabinetPlan
    const r = useStore.getState().applyPlan({ ...plan, dimensions: { ...plan.dimensions, width: plan.dimensions.width + 100 } })
    expect(r.ok).toBe(true)
    expect(loss()).toBe('design')

    useStore.getState().swapTo(first)
    useStore.getState().addNote('Que quepa la impresora')
    expect(loss()).toBe('design')
  })

  it('is the design when it does not come from a ficha, even untouched: it cannot be opened again', () => {
    useStore.getState().fromExample({ name: exampleBookcase.name, design: exampleBookcase })
    expect(loss()).toBe('design')
  })

  it('is the capture while it is being written, and the expert\'s run while it designs', () => {
    useStore.getState().startCapture()
    expect(loss()).toBe('capture')
    expect(swapLoss('analyzing', null)).toBe('analyzing')
  })
})

describe('swapping the furniture', () => {
  it('opens the other ficha in the Studio and saves it over the one that was there', () => {
    useStore.getState().swapTo(first)
    useStore.getState().select(useStore.getState().state!.versions[0].design.pieces[0].id)
    useStore.getState().swapTo(second)
    const s = useStore.getState()
    expect(s).toMatchObject({ phase: 'studio', selection: null, thinking: false })
    expect(s.state!.ficha).toEqual({ code: second.code, version: second.version })
    expect(saved?.ficha?.code).toBe(second.code)
  })

  it('leaves a capture behind for the Studio', () => {
    useStore.getState().startCapture()
    useStore.getState().swapTo(first)
    expect(useStore.getState()).toMatchObject({ phase: 'studio', draft: null })
  })
})

describe('the debug mark of each base', () => {
  it('says what probe recorded in its ficha, and none is invalid', () => {
    const verdicts = verdictsOf(testReferences.home(), testCatalog)
    for (const base of testReferences.home()) {
      const verdict = verdicts.get(base.id)!
      expect([base.code, verdict.valid, verdict.notes.length]).toEqual([base.code, true, testReferences.latest(base.code)!.expect.findings?.length ?? 0])
    }
  })
})
