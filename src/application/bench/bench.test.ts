import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { buildPlan, MODULE_OF_KIND, MODULES } from '../../domain/furniture/modules/plan'
import { kindFromWords } from '../../domain/checks/typology/typology'
import { askedParts } from '../../domain/editing/intent/counts'
import { byCallKind, countParts, createBench, describeAdjustments, describeStructure } from './bench'

const bench = createBench({ llm: () => createSimulated(0), catalog: testCatalog })
const signal = () => new AbortController().signal

describe('the bench', () => {
  it('builds every module variant valid and with nothing to warn about', () => {
    const checks = bench.runModules()
    expect(checks.length).toBeGreaterThan(60)
    expect(checks.filter((c) => !c.valid || c.findings.length)).toEqual([])
  })

  it('runs a case and grades it: a bookcase designed piece by piece', async () => {
    const r = await bench.runCase(bench.cases.find((c) => c.id === 'bookcase')!, signal())
    expect(r).toMatchObject({ ok: true, path: 'pieces', reasonable: true, verdict: expect.any(String) })
    expect(r.state?.versions).toHaveLength(1)
  })

  it('a bed goes through its plan', async () => {
    const r = await bench.runCase(bench.cases.find((c) => c.id === 'bed')!, signal())
    expect(r).toMatchObject({ ok: true, path: 'plan', reasonable: true, verdict: 'viable' })
  })

  it('a case that names its path is not reasonable when the design took the other one', async () => {
    const bed = bench.cases.find((c) => c.id === 'bed')!
    expect(await bench.runCase({ ...bed, path: 'pieces' }, signal())).toMatchObject({ path: 'plan', reasonable: false })
    expect(await bench.runCase({ ...bed, path: 'plan' }, signal())).toMatchObject({ path: 'plan', reasonable: true })
  })

  it('the requests after the design say which Knotty answered alone: a question on any design, a plan change on a plan', async () => {
    const bookcase = await bench.runCase(bench.cases.find((c) => c.id === 'bookcase')!, signal())
    expect(bookcase.adjustments).toEqual([{ request: '¿Cuánto cuesta?', by: 'knotty', calls: 0, outcome: 'answer' }])
    const shoeRack = await bench.runCase(bench.cases.find((c) => c.id === 'shoe-rack')!, signal())
    expect(shoeRack).toMatchObject({ path: 'plan', calls: 1 })
    expect(describeAdjustments(shoeRack.adjustments)).toBe('«Sin zoclo» Knotty, versión · «¿Cuántas hojas?» Knotty, respuesta')
    const expert = await bench.runCase({ ...bench.cases.find((c) => c.id === 'shoe-rack')!, adjust: ['Hazla más bonita'] }, signal())
    expect(expert.adjustments).toEqual([{ request: 'Hazla más bonita', by: 'expert', calls: 1, outcome: 'answer' }])
  })

  it('counts doors and drawers by their pieces and open openings from a cabinet plan', () => {
    const [, plan] = MODULES.cabinet.benchVariants().find(([name]) => name === 'aparador con patas')!
    const { design } = buildPlan(plan, testCatalog)
    expect(countParts(design, plan)).toEqual({ doors: 3, drawers: 3, open: 3 })
    expect(countParts(design, null)).toEqual({ doors: 3, drawers: 3, open: null })
  })

  it('grades the structure the case asks for: a count that differs fails, one it cannot count stays unknown', async () => {
    const bookcase = bench.cases.find((c) => c.id === 'bookcase')!
    expect((await bench.runCase(bookcase, signal())).structure).toMatchObject({ found: { doors: 0, drawers: 0 }, ok: true })
    const doors = (await bench.runCase({ ...bookcase, parts: { doors: 2, drawers: 0 } }, signal())).structure!
    expect(doors.ok).toBe(false)
    expect(describeStructure(doors)).toBe('puertas 0 (pidió 2) · cajones 0')
    const open = (await bench.runCase({ ...bookcase, parts: { doors: 0, open: 5 } }, signal())).structure!
    expect(open.ok).toBeNull()
    expect(describeStructure(open)).toBe('puertas 0 · abiertos ? (pidió 5)')
    expect((await bench.runCase({ ...bookcase, parts: undefined }, signal())).structure).toBeNull()
  })

  it('the bed asks for a change Knotty cannot read alone, so the plan adjustment is measured with a real expert', async () => {
    const bed = await bench.runCase(bench.cases.find((c) => c.id === 'bed')!, signal())
    expect(bed.path).toBe('plan')
    expect(bed.adjustments).toMatchObject([{ request: 'Súbela a 45 cm y ponle cajones del lado izquierdo', by: 'expert' }])
  })

  it('each case’s words route the skeleton to the module it expects, and the piece-by-piece one to every module', () => {
    const routed = (notes: string) => {
      const kind = kindFromWords(notes)
      return kind ? MODULE_OF_KIND[kind] : null
    }
    for (const c of bench.cases.filter((c) => c.module)) expect({ id: c.id, module: routed(c.notes) }).toEqual({ id: c.id, module: c.module })
    for (const c of bench.cases.filter((c) => c.path === 'pieces')) expect({ id: c.id, module: routed(c.notes) }).toEqual({ id: c.id, module: null })
  })

  it('keeps every call with its kind and prompt, the design’s and its requests’', async () => {
    const r = await bench.runCase(bench.cases.find((c) => c.id === 'shoe-rack')!, signal())
    expect(r.callLog.map((c) => [c.step, c.promptId])).toEqual([['skeleton', expect.any(String)]])
    const expert = await bench.runCase({ ...bench.cases.find((c) => c.id === 'shoe-rack')!, adjust: ['Hazla más bonita'] }, signal())
    expect(expert.callLog.map((c) => c.step)).toEqual(['skeleton', 'adjust'])
  })

  it('groups the calls by kind and prompt, averaging only the tokens a provider reported', () => {
    const call = (step: 'skeleton' | 'plan-adjust', promptId: string, input: number | null, output: number | null, seconds = 10) => ({ step, promptId, input, output, seconds })
    expect(
      byCallKind([
        call('skeleton', 'skeleton@15+cabinet@2', 3000, 800),
        call('skeleton', 'skeleton@15+cabinet@2', 2000, null, 20),
        call('skeleton', 'skeleton@15+cabinet@2+sideboard@1', 3200, 900),
        call('plan-adjust', 'plan-adjust@12+cabinet@2', null, null),
      ]),
    ).toEqual([
      { step: 'skeleton', promptId: 'skeleton@15+cabinet@2', calls: 2, input: 2500, minInput: 2000, output: 800, seconds: 15 },
      { step: 'skeleton', promptId: 'skeleton@15+cabinet@2+sideboard@1', calls: 1, input: 3200, minInput: 3200, output: 900, seconds: 10 },
      { step: 'plan-adjust', promptId: 'plan-adjust@12+cabinet@2', calls: 1, input: null, minInput: null, output: null, seconds: 10 },
    ])
  })

  it('what Knotty reads a case asks for never contradicts what the case expects: a wrong read would send a correction for nothing', () => {
    const reads = bench.cases.filter((c) => c.parts).flatMap((c) => (['doors', 'drawers'] as const).map((part) => ({ id: c.id, part, read: askedParts(c.notes)[part], expected: c.parts![part] })))
    const checked = reads.filter((r) => r.read !== null)
    expect(checked.length).toBeGreaterThanOrEqual(6)
    expect(checked.filter((r) => r.read !== r.expected)).toEqual([])
  })

  it('a case the expert cannot do is reported, not thrown', async () => {
    const r = await bench.runCase({ id: 'bench', notes: 'Una banca para el recibidor', measures: null, expected: {} }, signal())
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('conecta un experto real') })
  })
})
