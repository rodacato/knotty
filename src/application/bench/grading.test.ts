import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { currentVersion, type DesignState } from '../../domain/session/state'
import type { AdjustmentResponse, LLMProvider } from '../../ports/LLMProvider'
import { createBench, type BenchResult } from './bench'
import { BENCH_CASES, type BenchCase } from './cases'
import { caseFingerprint, GRADER_VERSION, gradeStep, outcomeOf, scenarioOf, type ExpectationResult, type StepResult } from './grading'
import { problemsOf } from './report'

const signal = () => new AbortController().signal
const bookcase = BENCH_CASES.find((c) => c.id === 'bookcase')!
const original = (id: string) => BENCH_CASES.find((c) => c.id === id)!

const response = (partial: Partial<AdjustmentResponse> = {}): AdjustmentResponse => ({
  explanation: 'Listo',
  summary: 'Cambio',
  operations: [],
  questions: [],
  suggestions: [],
  requirements: { add: [], remove: [] },
  decisions: [],
  acceptedRisks: [],
  ...partial,
})

/** On the bookcase: 700 and 760 apply, 900 adds criticals and waits for the person, 1200 cannot be built. */
const resize = (value: number) => response({ operations: [{ op: 'resizeFurniture', axis: 'x', value, rule: 'stretch' }] })

/** The simulated expert, except that each call to change the design is answered by the next script entry, the last one again when a correction round asks for more. */
const scripted = (script: (() => AdjustmentResponse)[]): LLMProvider => {
  let next = 0
  return { ...createSimulated(0), proposeAdjustment: async () => ({ value: script[Math.min(next++, script.length - 1)]!(), origin: { promptId: 'scripted@1', provider: 'scripted', model: 'test' }, usage: {} }) }
}

const run = (c: BenchCase, script: (() => AdjustmentResponse)[] = []) => createBench({ llm: () => scripted(script), catalog: testCatalog }).runCase(c, signal())

const stepsOf = (r: BenchResult) => r.steps!
const failed = (step: StepResult) => step.expectations.filter((e) => e.status === 'fail').map((e) => e.id)
const find = (step: StepResult, id: string): ExpectationResult => step.expectations.find((e) => e.id === `${step.step}:${id}`)!

const asked = (change: Partial<BenchCase>): BenchCase => ({ ...bookcase, ...change })

describe('the scenario of a case', () => {
  it('derives its steps from the legacy fields: the reconstruction, then one step per request', () => {
    const scenario = scenarioOf(original('shoe-rack'))
    expect(scenario.steps.map((s) => [s.label, s.request])).toEqual([
      ['diseño inicial', null],
      ['«Sin zoclo»', 'Sin zoclo'],
      ['«¿Cuántas hojas?»', '¿Cuántas hojas?'],
    ])
    const kinds = (i: number) => scenario.steps[i].expect.map((e) => e.kind)
    expect(kinds(0)).toEqual(expect.arrayContaining(['outcome', 'verdict', 'dimensions', 'origin', 'parts', 'planField']))
    expect(kinds(1)).toEqual(expect.arrayContaining(['outcome', 'verdict', 'noNewCritical', 'preserved', 'dimensions', 'parts', 'pieces']))
    expect(kinds(1)).not.toContain('origin')
  })

  it('carries what the shape asked for to the later steps, and a step that declares the same thing replaces it', () => {
    const [, , change] = scenarioOf(original('sideboard')).steps
    const parts = change.expect.filter((e) => e.kind === 'parts').map((e) => e.kind === 'parts' && [e.part, e.count])
    expect(parts).toEqual(expect.arrayContaining([['doors', 3], ['drawers', 2], ['open', 4]]))
    expect(parts).toHaveLength(3)
  })

  it('every case defaults to viable, and a step defaults to anything but a rejection or an error', () => {
    for (const c of BENCH_CASES) {
      const steps = scenarioOf(c).steps
      for (const s of steps) expect(s.expect).toContainEqual({ kind: 'verdict', allowed: ['viable'] })
      expect(steps[0].expect).toContainEqual({ kind: 'outcome', allowed: ['applied'] })
    }
    expect(scenarioOf({ ...bookcase, adjust: ['Hazla más bonita'] }).steps[1].expect).toContainEqual({ kind: 'outcome', allowed: ['applied', 'pending', 'answer'] })
  })

  it('fingerprints a case as canonical JSON: the key order does not matter, any change does', () => {
    const shuffled = Object.fromEntries(Object.entries(bookcase).reverse()) as BenchCase
    expect(caseFingerprint(shuffled)).toBe(caseFingerprint(bookcase))
    expect(caseFingerprint({ ...bookcase, notes: `${bookcase.notes}.` })).not.toBe(caseFingerprint(bookcase))
    expect(caseFingerprint({ ...bookcase, expected: { ...bookcase.expected, width: [800, 801] } })).not.toBe(caseFingerprint(bookcase))
    expect(typeof GRADER_VERSION).toBe('string')
  })
})

describe('positive controls: a design that does what was asked is green', () => {
  it.each(['bookcase', 'bed-drawers', 'shoe-rack', 'wall-cabinet', 'coffee-table', 'shoe-cabinet'])('%s, with the simulated expert', async (id) => {
    const r = await run(original(id))
    expect(r.steps!.flatMap(failed)).toEqual([])
    expect(problemsOf(r)).toEqual([])
  })

  it('the reconstruction keeps its own grade, and the top-level fields are the final design’s', async () => {
    const r = await run(original('shoe-rack'))
    expect(r.graderVersion).toBe(GRADER_VERSION)
    expect(r.steps).toHaveLength(3)
    expect(r.reconstruction).toMatchObject({ verdict: 'viable', criticals: 0, reasonable: true })
    expect(r.measures).toBe(r.steps![2].design.measures)
    expect(r.pieces).toBe(r.steps![2].design.pieces)
  })

  it('a request changes what it says and keeps the rest: narrowing is graded on the narrowed design', async () => {
    const narrower = asked({
      adjust: ['Hazlo de 70 cm de ancho'],
      afterRequest: { 'Hazlo de 70 cm de ancho': { outcomes: ['applied'], changes: ['width'], expect: [{ kind: 'dimensions', ranges: { height: [1800, 1800], width: [700, 700], depth: [300, 300] } }] } },
    })
    const r = await run(narrower, [() => resize(700)])
    expect(stepsOf(r)[1]).toMatchObject({ outcome: 'applied', design: { measures: '1800 × 700 × 300' } })
    expect(r.steps!.flatMap(failed)).toEqual([])
    expect(r.measures).toBe('1800 × 700 × 300')
    expect(r.reconstruction!.measures).toBe('1800 × 800 × 300')
  })
})

describe('negative controls: the grader rejects what is wrong', () => {
  it('a wrong adjustment: asked for 70 cm of width, got another', async () => {
    const narrower = asked({
      adjust: ['Hazlo de 70 cm de ancho'],
      afterRequest: { 'Hazlo de 70 cm de ancho': { outcomes: ['applied', 'pending'], changes: ['width'], expect: [{ kind: 'dimensions', ranges: { height: [1800, 1800], width: [700, 700], depth: [300, 300] } }] } },
    })
    const r = await run(narrower, [() => resize(760)])
    expect(stepsOf(r)[1].design.measures).toBe('1800 × 760 × 300')
    expect(failed(stepsOf(r)[1])).toEqual(['1:dimensions'])
    expect(problemsOf(r)).toEqual(['«Hazlo de 70 cm de ancho»: medidas 1800 × 760 × 300 fuera de lo esperado'])
    expect(r.reasonable).toBe(false)
  })

  it('an unasked change to another dimension is caught even when the case gives no range for it', async () => {
    const open = asked({ expected: {}, adjust: ['Hazla más profunda'], afterRequest: { 'Hazla más profunda': { outcomes: ['applied'], changes: ['depth'] } } })
    const r = await run(open, [() => resize(760)])
    expect(find(stepsOf(r)[1], 'preserved:width')).toMatchObject({ status: 'fail', detail: 'el ancho pasó de 800 a 760 sin pedirlo' })
    expect(find(stepsOf(r)[1], 'preserved:height').status).toBe('pass')
  })

  it('a lost requirement is caught, and an answer of the expert cannot be what drops it', async () => {
    const space = { id: 'space-width', text: 'Mi espacio mide 90 cm de ancho', type: 'space' as const, axis: 'x' as const, min: null, max: 900 }
    const c = asked({ adjust: ['Mi espacio mide 90 cm', 'Hazla más bonita'], afterRequest: { 'Mi espacio mide 90 cm': { expect: [{ kind: 'requirement', id: 'space-width' }] } } })
    const kept = await run(c, [() => response({ requirements: { add: [space], remove: [] } }), () => response()])
    expect(kept.steps!.flatMap(failed)).toEqual([])
    const tried = await run(c, [() => response({ requirements: { add: [space], remove: [] } }), () => response({ requirements: { add: [], remove: ['space-width'] } })])
    expect(tried.steps!.flatMap(failed)).toEqual([])
    const [before, after] = [kept.state!, { ...kept.state!, requirements: [] }]
    const lost = gradeStep({ catalog: testCatalog, spec: scenarioOf(c).steps[2], index: 2, before, after, outcome: outcomeOf(before, after), previous: null })
    expect(find(lost, 'requirement:space-width')).toMatchObject({ status: 'fail', detail: 'se perdió space-width' })
  })

  it('an error after a correct reconstruction: step 2 breaks the session and the case is still listed as a problem', async () => {
    const r = await run(asked({ adjust: ['Hazla más bonita'] }), [
      () => {
        throw new Error('el proveedor se cayó')
      },
    ])
    expect(r.ok).toBe(true)
    expect(stepsOf(r)[0].expectations.filter((e) => e.status !== 'pass' && e.mandatory)).toEqual([])
    expect(stepsOf(r)[1].outcome).toBe('error')
    expect(r.adjustments[0].outcome).toBe('error')
    expect(problemsOf(r)).toEqual(['«Hazla más bonita»: error del experto o de la conexión'])
  })

  it('a critical approved without cause: a change that adds a critical must wait, never be applied', async () => {
    const wide = asked({ expected: {}, adjust: ['Hazla de 90 cm'], afterRequest: { 'Hazla de 90 cm': { outcomes: ['pending'], changes: ['width'] } } })
    const waiting = await run(wide, [() => resize(900)])
    const [initial, step] = stepsOf(waiting)
    expect(step.outcome).toBe('pending')
    expect(step.proposal!.criticals).toBeGreaterThan(0)
    expect(find(step, 'noNewCritical').status).toBe('pass')
    expect(failed(step)).toEqual([])
    expect(problemsOf(waiting)).toEqual([])

    const state = waiting.state!
    const approved: DesignState = { ...state, versions: [...state.versions, { ...currentVersion(state), n: 2, design: state.proposal!.design }], current: 2, proposal: null }
    const before = { ...state, proposal: null }
    const outcome = outcomeOf(before, approved)
    expect(outcome).toBe('applied')
    const spec = scenarioOf(wide).steps[1]
    const graded = gradeStep({ catalog: testCatalog, spec, index: 1, before, after: approved, outcome, previous: initial })
    expect(graded.design.criticals).toBeGreaterThan(0)
    expect(failed(graded)).toEqual(expect.arrayContaining(['1:outcome', '1:noNewCritical', '1:verdict']))
    expect(find(graded, 'noNewCritical').detail).toMatch(/críticos nuevos sin que nadie los aceptara/)
  })

  it('a pending proposal is graded apart from the current design, each expectation on the one it is about', async () => {
    const wide = asked({
      adjust: ['Hazla de 90 cm'],
      afterRequest: { 'Hazla de 90 cm': { outcomes: ['pending'], changes: ['width'], expect: [{ kind: 'dimensions', ranges: { height: [1800, 1800], width: [900, 900], depth: [300, 300] } }] } },
    })
    const r = await run(wide, [() => resize(900)])
    const step = stepsOf(r)[1]
    expect(step.design).toMatchObject({ measures: '1800 × 800 × 300', criticals: 0, verdict: 'viable' })
    expect(step.proposal).toMatchObject({ measures: '1800 × 900 × 300', verdict: 'needs-changes' })
    expect(step.proposal!.criticals).toBeGreaterThan(0)
    expect(find(step, 'dimensions')).toMatchObject({ subject: 'proposal', status: 'pass' })
    expect(find(step, 'verdict').subject).toBe('design')
    expect(find(step, 'noNewCritical').subject).toBe('design')
    expect(r.measures).toBe('1800 × 800 × 300')
    expect(r.criticals).toBe(0)
    expect(problemsOf(r)).toEqual([])
  })

  it('a proposal that is not what was asked fails on the proposal, not on the untouched design', async () => {
    const wide = asked({ adjust: ['Hazla de 1 m'], afterRequest: { 'Hazla de 1 m': { outcomes: ['pending'], changes: ['width'], expect: [{ kind: 'dimensions', ranges: { height: [1800, 1800], width: [1000, 1000], depth: [300, 300] } }] } } })
    const r = await run(wide, [() => resize(900)])
    expect(find(stepsOf(r)[1], 'dimensions')).toMatchObject({ status: 'fail', subject: 'proposal' })
    expect(problemsOf(r)).toEqual(['«Hazla de 1 m»: medidas 1800 × 900 × 300 fuera de lo esperado (propuesta pendiente)'])
  })

  it('a change the expert could not make is rejected, not applied and not an answer', async () => {
    const r = await run(asked({ adjust: ['Hazla de 1.2 m'] }), [() => resize(1200)])
    expect(stepsOf(r)[1].outcome).toBe('rejected')
    expect(problemsOf(r)).toEqual(['«Hazla de 1.2 m»: el experto no logró aplicar el cambio'])
  })

  it('a mandatory expectation the design cannot answer is unknown and a problem, never a pass', async () => {
    const r = await run(
      asked({
        adjust: [],
        expect: [
          { kind: 'parts', part: 'open', count: 5 },
          { kind: 'planField', field: 'headboard.shelves', allowed: [2] },
          { kind: 'pieces', roles: ['shelf'], idPrefix: 'head-shelf-', count: 2 },
        ],
      }),
    )
    const [first] = stepsOf(r)
    expect(first.expectations.filter((e) => e.status === 'unknown').map((e) => e.id)).toEqual(['0:parts:open', '0:planField:headboard.shelves', '0:pieces:shelf:head-shelf-'])
    expect(first.expectations.some((e) => e.status === 'pass' && e.kind === 'planField')).toBe(false)
    expect(problemsOf(r)).toHaveLength(3)
    expect(r.structure!.ok).toBeNull()
  })

  it('an unsupported capability is declared, stays unknown with its reason and is not a problem', async () => {
    const r = await run(asked({ adjust: [], expect: [{ kind: 'declared', what: 'the finish', unsupported: 'the expert does not write the finish' }] }))
    expect(find(stepsOf(r)[0], 'declared:the finish')).toMatchObject({ status: 'unknown', mandatory: false, unsupported: 'the expert does not write the finish' })
    expect(problemsOf(r)).toEqual([])
  })

  it('a count that differs fails on the step and on the structure; the verdict outside the allowed set fails too', async () => {
    const r = await run(asked({ adjust: [], parts: { doors: 2 }, expect: [{ kind: 'verdict', allowed: ['invalid'] }] }))
    expect(failed(stepsOf(r)[0])).toEqual(expect.arrayContaining(['0:parts:doors']))
    expect(problemsOf(r)).toEqual(expect.arrayContaining(['diseño inicial: puertas 0 (pidió 2)', 'diseño inicial: veredicto viable (esperado invalid)']))
    expect(r.structure!.ok).toBe(false)
  })

  it('a range or a count the design breaks is named with what was found', async () => {
    const r = await run(asked({ adjust: [], expect: [{ kind: 'pieces', roles: ['shelf'], count: 9 }] }))
    expect(problemsOf(r)).toEqual(['diseño inicial: shelf 4 (pidió 9)'])
    const bed = await run({ ...original('bed-drawers'), expected: { ...original('bed-drawers').expected, depth: [1900, 2000] } })
    expect(problemsOf(bed)).toEqual(['diseño inicial: medidas 1100 × 2188 × 1010 fuera de lo esperado'])
  })
})

describe('what the product can really check', () => {
  it('a piece in the upper half passes, one that sits below fails', async () => {
    const r = await run(asked({ adjust: [], expect: [{ kind: 'placement', role: 'kick', half: 'upper' }, { kind: 'placement', role: 'top', half: 'upper' }] }))
    expect(stepsOf(r)[0].expectations.filter((e) => e.kind === 'placement').map((e) => e.status)).toEqual(['fail', 'pass'])
  })

  it('reads the plan of a design built from one, and says unknown for the piece-by-piece one', async () => {
    const plan = await run({ ...original('shoe-rack'), adjust: [] })
    expect(find(stepsOf(plan)[0], 'planField:front')).toMatchObject({ status: 'pass', detail: 'front es doors (pidió doors)' })
    const pieces = await run({ ...bookcase, expect: [{ kind: 'planField', field: 'front', allowed: ['doors'] }] })
    expect(find(stepsOf(pieces)[0], 'planField:front').status).toBe('unknown')
  })
})

describe('the clock and the ids of a run can be set, so a replay is deterministic', () => {
  it('two runs with the same clock and ids keep the same messages', async () => {
    const make = () => {
      let n = 0
      return createBench({ llm: () => scripted([]), catalog: testCatalog, now: () => '2026-10-02T00:00:00.000Z', newId: () => `id-${++n}` })
    }
    const one = await make().runCase(bookcase, signal())
    const two = await make().runCase(bookcase, signal())
    const chat = (r: BenchResult) => r.state!.chat.map((m) => [m.id, m.date])
    expect(chat(one)).toEqual(chat(two))
    expect(chat(one).every(([id, date]) => id.startsWith('id-') && date === '2026-10-02T00:00:00.000Z')).toBe(true)
  })
})
