import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { DEFAULT_CONSTRUCTION, type CabinetPlan } from '../../domain/furniture/modules/cabinet'
import { currentDesign, type DesignState } from '../../domain/session/state'
import type { DesignRepository } from '../../ports/DesignRepository'
import { answerWith, type LLMProvider, type PlanResponse, type ReconstructionRequest } from '../../ports/LLMProvider'
import { createUseCases } from '.'

const memory = (): DesignRepository => {
  let state: DesignState | null = null
  return { load: () => state, save: (s) => void (state = s), clear: () => void (state = null) }
}

const door = (height: number, doors: number) => ({ height, content: 'door' as const, shelves: 0, doors })
const wallCabinet = (cells: CabinetPlan['columns'][number]['cells']): CabinetPlan => ({
  kind: 'cabinet',
  name: 'Alacena',
  dimensions: { width: 800, height: 700, depth: 300 },
  material: 'T18',
  base: 'floor',
  wallMounted: true,
  construction: DEFAULT_CONSTRUCTION,
  columns: [{ width: 1, cells }],
})
/** The mistake the real expert made: the shelf in the middle as two openings, each with its two leaves. */
const FOUR_DOORS = wallCabinet([door(0.5, 2), door(0.5, 2)])
const TWO_DOORS = wallCabinet([{ ...door(1, 2), shelves: 1 }])

/** An expert whose skeleton answers these plans in order, keeping what it was asked. */
function expertAnswering(...plans: CabinetPlan[]) {
  const asked: ReconstructionRequest[] = []
  const llm: LLMProvider = {
    ...createSimulated(0),
    planDesign: async (r) => {
      asked.push(r)
      const plan = plans[Math.min(asked.length, plans.length) - 1]
      const value: PlanResponse = { explanation: 'Una alacena.', ...answerWith(plan), questions: [], requestedPhotos: [], requirements: [], suggestions: [] }
      return { value, origin: { promptId: 'test', provider: 'test', model: 'test' }, usage: {} }
    },
  }
  let id = 0
  const useCases = createUseCases({ llm: () => llm, catalog: testCatalog, repository: memory(), now: () => '2026-09-26T10:00:00Z', newId: () => `p${++id}` })
  const design = (notes: string) => useCases.reconstruct({ measures: null, photos: [], thumbnails: [], notes, kind: null }, new AbortController().signal)
  return { asked, design }
}

const doors = (state: DesignState) => currentDesign(state).pieces.filter((p) => p.role === 'door').length
const REQUEST = 'Alacena de pared con dos puertas y una repisa en medio, para platos'

describe('a cabinet plan with other doors or drawers than asked', () => {
  it('goes back once with the exact difference, and the corrected plan is kept', async () => {
    const { asked, design } = expertAnswering(FOUR_DOORS, TWO_DOORS)
    const state = await design(REQUEST)
    expect(asked).toHaveLength(2)
    expect(asked[1].correction?.errors).toEqual([expect.objectContaining({ code: 'E_PARTS', message: expect.stringContaining('Se pidieron 2 puertas y la ficha tiene 4.') })])
    expect(doors(state)).toBe(2)
    expect(state.trace.map((t) => [t.step, t.attempt, t.outcome])).toEqual([
      ['plan', 0, 'invalid'],
      ['plan', 1, 'ok'],
    ])
    expect(state.chat.at(-1)?.text).not.toContain('Ojo')
  })

  it('if the correction still misses, the closer plan stays and the person is told', async () => {
    const { asked, design } = expertAnswering(FOUR_DOORS, FOUR_DOORS)
    const state = await design(REQUEST)
    expect(asked).toHaveLength(2)
    expect(doors(state)).toBe(4)
    expect(state.chat.at(-1)?.text).toContain('Ojo: se pidieron 2 puertas y la ficha tiene 4. Si no es lo que querías, cámbialo en la pestaña Mueble.')
  })

  it('a plan with what was asked, or a request without a plain count, makes no second call', async () => {
    const right = expertAnswering(TWO_DOORS)
    await right.design(REQUEST)
    expect(right.asked).toHaveLength(1)
    const vague = expertAnswering(FOUR_DOORS)
    expect(doors(await vague.design('Alacena de pared con puertas, para platos'))).toBe(4)
    expect(vague.asked).toHaveLength(1)
  })
})
