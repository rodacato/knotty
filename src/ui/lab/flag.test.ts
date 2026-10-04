import { beforeEach, describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createBench } from '../../application/bench/bench'
import { named } from '../../application/named'
import { createUseCases } from '../../application/useCases'
import { analyze } from '../../domain/checks/analysis'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import { buildPlan } from '../../domain/furniture/modules/plan'
import { NO_SETTINGS } from '../../domain/materials/catalog'
import type { DesignState } from '../../domain/session/state'
import type { Services } from '../services'
import { useStore } from '../store'
import { piecesNamedIn } from './pieces'

const bench = createBench({ llm: () => createSimulated(0), catalog: testCatalog })

function firstWarning() {
  for (const v of bench.variants()) {
    const design = buildPlan(v.plan, testCatalog).design
    const a = analyze(design, testCatalog)
    if (a.valid && a.warnings.length) return { design, warning: a.warnings[0] }
  }
  throw new Error('no module variant has a geometry warning any more: pick another source for this test')
}

describe('naming and flagging the pieces of a warning', () => {
  it('names the two pieces a geometry warning is about, and finds them in the design', () => {
    const { design, warning } = firstWarning()
    const pieces = piecesNamedIn(design, warning.data)
    expect(pieces).toHaveLength(2)
    const text = named(design, warning.message)
    for (const id of pieces) expect(text).not.toContain(`"${id}"`)
    expect(text).toContain('«')
  })

  it('ignores ids the design does not have', () => {
    expect(piecesNamedIn(exampleBookcase, { a: 'nope', b: 3, c: [exampleBookcase.pieces[0].id] })).toEqual([exampleBookcase.pieces[0].id])
  })
})

function services(): Services {
  let saved: DesignState | null = null
  return {
    useCases: createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: { load: () => saved, save: (s) => void (saved = s), clear: () => void (saved = null) } }),
    catalog: testCatalog,
    materials: { load: async () => testCatalog, settings: () => NO_SETTINGS, saveSettings: () => {} },
    preferences: { vaultState: () => 'none' } as unknown as Services['preferences'],
    images: {} as Services['images'],
    references: testReferences,
    debug: { visible: () => false, setVisible: () => {} } as unknown as Services['debug'],
    bench: {} as Services['bench'],
    sandbox: { enter: () => {}, leave: () => {}, active: () => false },
  }
}

describe('the flag on the 3D', () => {
  const initial = useStore.getState()
  beforeEach(() => {
    useStore.setState(initial, true)
    useStore.getState().start(services())
    useStore.getState().fromExample({ name: exampleBookcase.name, design: exampleBookcase })
  })

  it('marks the pieces, clears them when asked again, and never touches the design', () => {
    const before = useStore.getState().state
    const [a, b] = exampleBookcase.pieces
    useStore.getState().flag([a.id, b.id])
    expect(useStore.getState().flagged).toEqual([a.id, b.id])
    useStore.getState().flag([b.id, a.id])
    expect(useStore.getState().flagged).toEqual([])
    useStore.getState().flag([a.id])
    expect(useStore.getState().state).toBe(before)
  })

  it('drops the mark when another design opens', () => {
    useStore.getState().flag([exampleBookcase.pieces[0].id])
    useStore.getState().fromExample({ name: exampleBookcase.name, design: exampleBookcase })
    expect(useStore.getState().flagged).toEqual([])
  })
})
