import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { exampleSideboard, sideboardPlan } from '../../domain/furniture/examples'
import { currentDesign, type DesignState } from '../../domain/session/state'
import type { DesignRepository } from '../../ports/DesignRepository'
import { answerWith, type LLMProvider } from '../../ports/LLMProvider'
import { createUseCases, currentPlan } from '.'

const memory = (): DesignRepository => {
  let state: DesignState | null = null
  return { load: () => state, save: (s) => void (state = s), clear: () => void (state = null) }
}
let id = 0
const setup = () => createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: memory(), now: () => '2026-09-26T10:00:00Z', newId: () => `k${++id}` })
const signal = () => new AbortController().signal
const kindOf = (state: DesignState) => ({ kind: currentDesign(state).kind, source: currentDesign(state).kindSource })
const design = (c: ReturnType<typeof setup>, notes: string, kind: Parameters<typeof c.reconstruct>[0]['kind'] = null) =>
  c.reconstruct({ measures: null, photos: [], thumbnails: [], notes, kind }, signal())

describe('what a new design is', () => {
  it('the person’s choice wins over what the design and its words say', async () => {
    expect(kindOf(await design(setup(), 'Un librero con repisas', 'wardrobe'))).toEqual({ kind: 'wardrobe', source: 'person' })
  })

  it('without a choice, the plan says it', async () => {
    expect(kindOf(await design(setup(), 'Una zapatera de 90 de alto para 12 pares'))).toEqual({ kind: 'shoeRack', source: 'plan' })
  })

  it('the person’s choice routes the skeleton: «escritorio» makes a desk plan whatever the notes say', async () => {
    const state = await design(setup(), 'Algo para trabajar en casa', 'desk')
    expect(currentPlan(state).plan).toMatchObject({ kind: 'table', use: 'desk' })
  })

  it('an example says what it is, a plan example too', () => {
    const c = setup()
    expect(kindOf(c.fromExample(exampleBookcase))).toEqual({ kind: 'bookcase', source: 'example' })
    expect(kindOf(c.openExample(exampleSideboard))).toEqual({ kind: 'sideboard', source: 'example' })
  })
})

describe('changing what it is', () => {
  it('within the module: a version that keeps the plan and the pieces, and survives rebuilding from the plan', () => {
    const c = setup()
    const sideboard = c.openExample(exampleSideboard)
    const r = c.chooseKind(sideboard, 'tvStand')
    if (!r.ok) throw new Error('expected in place')
    expect(kindOf(r.state)).toEqual({ kind: 'tvStand', source: 'person' })
    expect(currentDesign(r.state).pieces).toEqual(currentDesign(sideboard).pieces)
    expect(currentPlan(r.state)).toMatchObject({ plan: sideboardPlan, diverged: false })
    expect(r.state.versions.at(-1)?.summary).toBe('Ahora es un mueble de TV')
    const plan = currentPlan(r.state).plan!
    const rebuilt = c.applyPlan(r.state, { ...plan, base: 'kick' } as typeof plan)
    if (!rebuilt.ok) throw new Error(rebuilt.message)
    expect(kindOf(rebuilt.state)).toEqual({ kind: 'tvStand', source: 'person' })
  })

  it('a table’s use lives in its plan: choosing another rebuilds it', async () => {
    const c = setup()
    const r = c.chooseKind(await design(c, 'Escritorio sencillo'), 'diningTable')
    if (!r.ok) throw new Error('expected in place')
    expect(currentPlan(r.state).plan).toMatchObject({ use: 'dining' })
    expect(kindOf(r.state)).toEqual({ kind: 'diningTable', source: 'person' })
  })

  it('choosing what it already is changes nothing', () => {
    const c = setup()
    const r = c.chooseKind(c.openExample(exampleSideboard), 'tvStand')
    if (!r.ok) throw new Error('expected in place')
    expect(c.chooseKind(r.state, 'tvStand')).toEqual({ ok: true, state: r.state })
  })

  it('across modules the plan cannot be converted: it asks to redo, and nothing changes', () => {
    const c = setup()
    const sideboard = c.openExample(exampleSideboard)
    expect(c.chooseKind(sideboard, 'bed')).toEqual({ ok: false, redo: true })
  })

  it('redoing it as a bed is a new version with a bed plan; the old one stays, and only the person’s notes carry over', async () => {
    const c = setup()
    const noted = c.addRequirement(c.openExample(exampleSideboard), 'Lo voy a pintar')
    const withExpertNote = { ...noted, requirements: [...noted.requirements, { id: 'space-width', text: 'Mi espacio mide 1.60', type: 'space' as const, axis: 'x' as const, min: null, max: 1600 }] }
    const state = await c.redoAs(withExpertNote, 'bed', signal())
    expect(state.versions).toHaveLength(2)
    expect(state.versions[0].plan?.kind).toBe('cabinet')
    expect(currentPlan(state).plan?.kind).toBe('bed')
    expect(kindOf(state)).toEqual({ kind: 'bed', source: 'person' })
    expect(state.requirements.map((r) => r.text)).toEqual(['Lo voy a pintar'])
    expect(state.chat.at(-2)?.text).toBe('Rehazlo como una cama.')
    expect(state.chat.at(-1)?.text).toMatch(/^Lo rehice como una cama\. Lo anterior sigue en el historial\./)
  })

  it('a redo that fails leaves the design as it was and says why', async () => {
    const c = setup()
    const sideboard = c.openExample(exampleSideboard)
    const state = await c.redoAs(sideboard, 'bench', signal())
    expect(state.versions).toEqual(sideboard.versions)
    expect(state.chat.at(-1)).toMatchObject({ author: 'expert', error: true })
  })
})

describe('which module the skeleton is asked about', () => {
  /** The simulated expert, with the photo reading it says and every skeleton request kept. */
  const watched = (photoKind: string) => {
    const asked: (string | null | undefined)[] = []
    const simulated = createSimulated(0)
    const llm: LLMProvider = {
      ...simulated,
      readPhoto: async (r, s) => {
        const read = await simulated.readPhoto(r, s)
        return { ...read, value: { ...read.value, kind: photoKind } }
      },
      planDesign: (r, s) => {
        asked.push(r.routeKind)
        return simulated.planDesign!(r, s)
      },
    }
    const c = createUseCases({ llm: () => llm, catalog: testCatalog, repository: memory(), now: () => '2026-09-26T10:00:00Z', newId: () => `r${++id}` })
    return { c, asked }
  }
  const photo = [{ angle: 'front', base64: 'AAA' }]
  const run = (c: ReturnType<typeof setup>, notes: string, kind: Parameters<typeof c.reconstruct>[0]['kind'], photos = photo) =>
    c.reconstruct({ measures: null, photos, thumbnails: [], notes, kind }, signal()).catch(() => null)

  it('the person’s choice, over the photo and the words', async () => {
    const { c, asked } = watched('clóset')
    await run(c, 'Un librero para la sala', 'desk')
    expect(asked).toEqual(['desk'])
  })

  it('without a choice, the photo over the words', async () => {
    const { c, asked } = watched('clóset')
    await run(c, 'Un librero para la sala', null)
    expect(asked).toEqual(['wardrobe'])
  })

  it('without a choice or a photo, the words; with none of them, every module', async () => {
    const { c, asked } = watched('')
    await run(c, 'Un librero para la sala', null, [])
    await run(c, 'Algo para guardar cosas en la entrada', null, [])
    expect(asked).toEqual(['bookcase', null])
  })
})

describe('what the plan adjustment is told the furniture is', () => {
  it('the design’s kind, so its guide can come along', async () => {
    const asked: (string | null | undefined)[] = []
    const simulated = createSimulated(0)
    const llm: LLMProvider = {
      ...simulated,
      adjustPlan: async (r) => {
        asked.push(r.kind)
        return {
          value: { explanation: 'Así queda.', summary: 'Responder', action: 'answer', ...answerWith(null), questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [] },
          origin: { promptId: 'test', provider: 'test', model: 'test' },
          usage: {},
        }
      },
    }
    const c = createUseCases({ llm: () => llm, catalog: testCatalog, repository: memory(), now: () => '2026-09-26T10:00:00Z', newId: () => `a${++id}` })
    await c.adjust(c.openExample(exampleSideboard), 'Cambia el cajoncito de arriba por un nicho abierto', signal())
    expect(asked).toEqual(['sideboard'])
  })
})
