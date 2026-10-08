import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import type { TablePlan } from '../../domain/furniture/modules/table'
import { currentDesign } from '../../domain/session/state'
import { answerWith, type LLMProvider, type PlanAdjustment, type PlanAdjustRequest } from '../../ports/LLMProvider'
import { createUseCases, currentPlan } from './index'

const desk: TablePlan = {
  kind: 'table', use: 'desk', name: 'Escritorio de prueba', material: 'T18',
  dimensions: { width: 1370, height: 760, depth: 630 }, overhang: 0,
  shelf: false, pedestal: { side: 'none', drawers: 0 }, legs: 'panel',
}
const signal = () => new AbortController().signal
const origin = { provider: 'test', model: 'controlled', promptId: 'test' }
const response = (table: TablePlan | null, extra: Partial<PlanAdjustment> = {}): PlanAdjustment => ({
  explanation: 'Listo, lo cambié.', summary: 'Cambiar la ficha', action: 'plan', ...answerWith(table),
  questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [], ...extra,
})

function setup(answers: PlanAdjustment[], plan = desk) {
  const requests: PlanAdjustRequest[] = []
  const calls: string[] = []
  const simulated = createSimulated(0)
  const llm: LLMProvider = {
    ...simulated,
    adjustPlan: async (request) => {
      calls.push('plan')
      requests.push(request)
      return { value: answers[Math.min(requests.length - 1, answers.length - 1)], origin, usage: {} }
    },
    proposeAdjustment: async () => {
      calls.push('pieces')
      return { value: { explanation: 'No propuse cambios en las piezas.', summary: '', operations: [], questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [], acceptedRisks: [] }, origin, usage: {} }
    },
  }
  let id = 0
  const useCases = createUseCases({ llm: () => llm, catalog: testCatalog, repository: { load: () => null, save: () => {}, clear: () => {} }, now: () => '2026-10-05T18:00:00Z', newId: () => `table-${++id}` })
  const initial = useCases.openExample({ name: plan.name, plan, notes: 'Mueble inventado para regresión; no es un ejemplo de entrenamiento.' })
  return { useCases, initial, calls, requests }
}

describe('table adjustments through the real use cases', () => {
  it('changes only the requested width and keeps requirements and decisions', async () => {
    const next = { ...desk, dimensions: { ...desk.dimensions, width: 1450 } }
    const { useCases, initial, calls } = setup([response(next)])
    const requirements = [{ id: 'room', text: 'El fondo disponible es 63 cm.', type: 'space' as const, axis: 'z' as const, min: null, max: 630 }]
    const decisions = [{ topic: 'assembly', text: 'Armado fijo.' }]
    const state = await useCases.adjust({ ...initial, requirements, decisions }, 'Necesito un poco más de superficie hacia los lados; conserva el resto.', signal())
    expect(calls).toEqual(['plan'])
    expect(currentPlan(state).plan).toEqual(next)
    expect(currentDesign(state).dimensions).toEqual(next.dimensions)
    expect(state.requirements).toEqual(requirements)
    expect(state.decisions).toEqual(decisions)
    expect(state.versions).toHaveLength(2)
  })

  it('adds the three drawers to the built desk, not only to its plan', async () => {
    const next: TablePlan = { ...desk, pedestal: { side: 'left', drawers: 3 } }
    const { useCases, initial } = setup([response(next)])
    const pending = await useCases.adjust(initial, 'Me gustaría una cajonera para organizar los útiles.', signal())
    expect(pending.versions).toHaveLength(1)
    expect(pending.proposal?.design.pieces.filter((p) => p.role === 'drawer-front')).toHaveLength(3)
    const state = useCases.applyProposal(pending)
    expect(currentPlan(state).plan).toEqual(next)
    expect(currentDesign(state).pieces.filter((p) => p.role === 'drawer-front')).toHaveLength(3)
  })

  it('corrects an impossible dining pedestal before applying a width change', async () => {
    const dining: TablePlan = { ...desk, use: 'dining', name: 'Mesa de prueba', dimensions: { width: 1370, height: 760, depth: 850 } }
    const wider = { ...dining, dimensions: { ...dining.dimensions, width: 1450 } }
    const { useCases, initial, calls, requests } = setup([response({ ...wider, pedestal: { side: 'left', drawers: 2 } }), response(wider)], dining)
    const state = await useCases.adjust(initial, 'Necesito más superficie para poner los platos.', signal())
    expect(calls).toEqual(['plan', 'plan'])
    expect(requests[1].correction?.errors).toContain('Solo un escritorio lleva cajonera')
    expect(currentPlan(state).plan).toEqual(wider)
    expect(currentDesign(state).pieces.some((p) => p.role === 'drawer-front')).toBe(false)
    expect(state.trace.some((t) => t.outcome === 'invalid' && t.errors.some((e) => e.code === 'E_SCHEMA'))).toBe(true)
  })

  it('does not apply a pedestal that remains incoherent after correction', async () => {
    const { useCases, initial, calls } = setup([response({ ...desk, pedestal: { side: 'none', drawers: 3 } })])
    const state = await useCases.adjust(initial, 'Me gustaría otra distribución para guardar los útiles.', signal())
    expect(calls).toEqual(['plan', 'plan', 'pieces'])
    expect(currentPlan(state).plan).toEqual(desk)
    expect(state.versions).toHaveLength(1)
    expect(state.chat.at(-1)?.text).not.toContain('Listo, lo cambié')
  })

  it.each([
    response(null),
    response(desk, { action: 'answer' }),
    response(desk, { action: 'freeform' }),
  ])('does not show an inconsistent action as an applied change ($action)', async (answer) => {
    const { useCases, initial, calls } = setup([answer])
    const state = await useCases.adjust(initial, 'Quisiera revisar la distribución que propones.', signal())
    expect(calls).toEqual(['plan', 'pieces'])
    expect(state.versions).toHaveLength(1)
    expect(state.chat.at(-1)?.text).not.toContain('Listo, lo cambié')
  })

  it('an unchanged plan with explicit defaults makes no version and says nothing changed', async () => {
    const { useCases, initial, calls } = setup([response({ ...desk, assembly: 'glued' })])
    const state = await useCases.adjust(initial, '¿Puedes reconsiderar esta distribución?', signal())
    expect(calls).toEqual(['plan'])
    expect(state.versions).toHaveLength(1)
    expect(state.chat.at(-1)?.text).toBe('Ya está así en la ficha; no cambié nada.')
  })

  it('keeps questions pending even when the proposed plan is unchanged', async () => {
    const { useCases, initial } = setup([response(desk, { explanation: '¿Conservamos esta distribución?', questions: [{ text: '¿Conservamos esta distribución?', options: ['Sí', 'No'] }] })])
    const state = await useCases.adjust(initial, 'Quiero revisar si la distribución es adecuada.', signal())
    expect(state.versions).toHaveLength(1)
    expect(state.proposal?.holds).toContain('Hizo preguntas: el cambio espera tus respuestas.')
    expect(state.chat.at(-1)?.questions).toHaveLength(1)
  })

  it('keeps newly recorded requirements on an unchanged plan', async () => {
    const tool = { id: 'tools', text: 'Solo tengo taladro.', type: 'tool' as const, axis: null, min: null, max: null }
    const { useCases, initial } = setup([response(desk, { requirements: { add: [tool], remove: [] } })])
    const state = await useCases.adjust(initial, 'Ten en cuenta las herramientas que tengo para hacerlo.', signal())
    expect(state.requirements).toEqual([tool])
  })

  it('manual previews reject a desk shelf and leave the current design intact', () => {
    const { useCases, initial } = setup([])
    expect(useCases.previewPlan(initial, { ...desk, shelf: true })).toEqual({ ok: false, message: 'Un escritorio no lleva repisa baja: estorba las piernas.' })
    expect(currentPlan(initial).plan).toEqual(desk)
  })

  it('a top deeper than the sheet is refused by how much it is over and by the most its measure can be', () => {
    const { useCases, initial } = setup([])
    const deeper = useCases.previewPlan(initial, { ...desk, dimensions: { ...desk.dimensions, depth: 1200 } })
    expect(deeper).toEqual({ ok: false, message: '«Cubierta» mediría 1370 × 1200 mm y de una hoja salen tablas de hasta 2410 × 1188: le sobran 12 mm. «Fondo» puede ser de hasta 1188 mm.' })
    const fits = useCases.previewPlan(initial, { ...desk, dimensions: { ...desk.dimensions, depth: 1188 } })
    expect(fits.ok || fits.message).not.toContain('hoja')
  })

  it('with two measures changed at once it says the board and how much it is over, and names no measure', () => {
    const { useCases, initial } = setup([])
    const r = useCases.previewPlan(initial, { ...desk, dimensions: { ...desk.dimensions, width: 1500, depth: 1200 } })
    expect(r).toEqual({ ok: false, message: '«Cubierta» mediría 1500 × 1200 mm y de una hoja salen tablas de hasta 2410 × 1188: le sobran 12 mm.' })
  })

  it('a question answered with no plan changes neither version nor geometry', async () => {
    const { useCases, initial } = setup([response(null, { action: 'answer', explanation: 'La cajonera necesita un lado y un número de cajones.' })])
    const state = await useCases.adjust(initial, '¿Qué datos necesitas para una cajonera?', signal())
    expect(state.versions).toHaveLength(1)
    expect(currentDesign(state)).toEqual(currentDesign(initial))
    expect(state.chat.at(-1)?.text).toContain('necesita un lado')
  })
})
