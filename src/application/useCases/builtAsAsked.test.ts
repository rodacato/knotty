import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createBundledReferences } from '../../adapters/references/store'
import { exampleOf } from '../../domain/furniture/examples'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import type { BedPlan } from '../../domain/furniture/modules/bed'
import type { CabinetPlan } from '../../domain/furniture/modules/cabinet'
import { splitCell, type CellPath } from '../../domain/furniture/modules/cabinetCells'
import { buildPlan, builtAsAsked, MODULES, type FurniturePlan } from '../../domain/furniture/modules/plan'
import type { TablePlan } from '../../domain/furniture/modules/table'
import { currentDesign } from '../../domain/session/state'
import { answerWith, type LLMProvider, type PlanAdjustment, type PlanAdjustRequest } from '../../ports/LLMProvider'
import { createUseCases, currentPlan } from './index'

const store = createBundledReferences()
const origin = { provider: 'test', model: 'controlled', promptId: 'test' }
const signal = () => new AbortController().signal

/** The use cases over a ficha, with an expert that answers each plan request with the next of `answers`. */
function setup(code: string, answers: FurniturePlan[] = []) {
  const requests: PlanAdjustRequest[] = []
  const calls: string[] = []
  const llm: LLMProvider = {
    ...createSimulated(0),
    adjustPlan: async (request) => {
      calls.push('plan')
      requests.push(request)
      const value: PlanAdjustment = { explanation: 'Listo, lo cambié.', summary: 'Cambiar la ficha', action: 'plan', ...answerWith(answers[Math.min(requests.length - 1, answers.length - 1)]), questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [] }
      return { value, origin, usage: {} }
    },
    proposeAdjustment: async () => {
      calls.push('pieces')
      return { value: { explanation: 'No propuse cambios en las piezas.', summary: '', operations: [], questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [], acceptedRisks: [] }, origin, usage: {} }
    },
  }
  let id = 0
  const useCases = createUseCases({ llm: () => llm, catalog: testCatalog, repository: { load: () => null, save: () => {}, clear: () => {} }, now: () => '2026-10-09T18:00:00Z', newId: () => `asked-${++id}` })
  const reference = store.latest(code)!
  return { useCases, initial: useCases.openExample(exampleOf(reference)), plan: reference.plan!, calls, requests }
}

const drawerFronts = (design: { pieces: { role: string }[] }) => design.pieces.filter((p) => p.role === 'drawer-front').length

/** The ficha's drawer cell split into two rows: two drawers, each too low for a drawer. */
const SPLIT: [string, CellPath][] = [['GN-APA-01', [1, 1]], ['KC-OTR-04', [0, 1]]]
const split = (plan: FurniturePlan, path: CellPath) => splitCell(plan as CabinetPlan, path, 'rows', 2)!

describe('a plan is built as asked', () => {
  it('holds for every shipped ficha and every bench variant, and not for one whose drawer no longer fits', () => {
    const plans = store.all().flatMap((r) => (r.plan ? [r.plan] : []))
    expect(plans).toHaveLength(61)
    for (const plan of [...plans, ...Object.values(MODULES).flatMap((m) => m.benchVariants().map(([, p]) => p as FurniturePlan))]) expect(builtAsAsked(plan, buildPlan(plan, testCatalog).design)).toBeNull()
    const low = split(store.latest('GN-APA-01')!.plan!, [1, 1])
    expect(builtAsAsked(low, buildPlan(low, testCatalog).design)).toBe('Solo caben 0 de 2 cajones en esos huecos.')
  })

  it.each(SPLIT)('the draft of %s refuses its drawer split in two, and says so', (code, path) => {
    const { useCases, initial, plan } = setup(code)
    expect(drawerFronts(currentDesign(initial))).toBe(1)
    expect(useCases.previewPlan(initial, split(plan, path))).toEqual({ ok: false, message: expect.stringMatching(/^Solo caben 0 de 2 cajones en esos huecos\. No cup(o|ieron): /) })
    expect(useCases.applyPlan(initial, split(plan, path))).toEqual({ ok: false, message: expect.stringMatching(/^Solo caben 0 de 2 cajones en esos huecos\. No cup(o|ieron): /) })
  })

  it('accepts a change that leaves every drawer in', () => {
    const { useCases, initial, plan } = setup('GN-APA-01')
    const wider = { ...plan, dimensions: { ...(plan as CabinetPlan).dimensions, width: (plan as CabinetPlan).dimensions.width + 100 } } as FurniturePlan
    const r = useCases.previewPlan(initial, wider)
    expect(r.ok && drawerFronts(r.design)).toBe(1)
  })

  it('refuses a desk too low for the drawers of its pedestal and a bed too low for its own', () => {
    const { useCases, initial } = setup('GN-APA-01')
    const desk: TablePlan = { kind: 'table', use: 'desk', name: 'Escritorio', material: 'T18', dimensions: { width: 1300, height: 760, depth: 600 }, overhang: 0, shelf: false, pedestal: { side: 'left', drawers: 4 }, legs: 'panel' }
    expect(useCases.previewPlan(initial, desk).ok).toBe(true)
    expect(useCases.previewPlan(initial, { ...desk, dimensions: { ...desk.dimensions, height: 500 } })).toEqual({ ok: false, message: 'Solo caben 0 de 4 cajones en esa cajonera. No cupieron: Cajón 1, Cajón 2, Cajón 3, Cajón 4. El hueco de 384 × 89 mm es muy chico para un cajón.' })
    const bed = MODULES.bed.benchVariants().map(([, p]) => p).find((p) => p.drawers.side === 'left' && p.drawers.count === 3) as BedPlan
    expect(useCases.previewPlan(initial, bed).ok).toBe(true)
    expect(useCases.previewPlan(initial, { ...bed, height: 150 })).toEqual({ ok: false, message: expect.stringMatching(/^Solo caben 0 de 3 cajones bajo esa cama\. No cup(o|ieron): /) })
  })

  it('still opens a saved plan that no longer builds as asked, and refuses the next change with the reason', () => {
    const { useCases, plan } = setup('GN-APA-01')
    const low = split(plan, [1, 1]) as CabinetPlan
    const opened = useCases.openExample({ name: 'Aparador', plan: low, notes: '' })
    expect(currentPlan(opened).plan).toEqual(low)
    expect(drawerFronts(currentDesign(opened))).toBe(0)
    expect(useCases.previewPlan(opened, { ...low, dimensions: { ...low.dimensions, width: low.dimensions.width + 100 } })).toEqual({ ok: false, message: expect.stringMatching(/^Solo caben 0 de 2 cajones en esos huecos\. No cup(o|ieron): /) })
  })

  it('sends the expert back a plan with a drawer that does not fit, saying which and why, and never applies it', async () => {
    const plan = store.latest('GN-APA-01')!.plan as CabinetPlan
    const request = 'Quiero guardar los cubiertos separados de los manteles.'
    const wider = { ...plan, dimensions: { ...plan.dimensions, width: plan.dimensions.width + 100 } }
    const fits = setup('GN-APA-01', [wider])
    expect(currentPlan(await fits.useCases.adjust(fits.initial, request, signal())).plan).toEqual(wider)
    expect(fits.calls).toEqual(['plan'])

    const low = setup('GN-APA-01', [split(plan, [1, 1])])
    const refused = await low.useCases.adjust(low.initial, request, signal())
    expect(low.calls).toEqual(['plan', 'plan', 'pieces'])
    expect(low.requests[1].correction?.errors).toContain('Solo caben 0 de 2 cajones en esos huecos.')
    expect(low.requests[1].correction?.errors).toMatch(/Cajón 1: El hueco de \d+ × \d+ mm es muy chico para un cajón\./)
    expect(currentPlan(refused).plan).toEqual(plan)
    expect(refused.versions).toHaveLength(1)
    expect(refused.proposal).toBeNull()
  })
})
