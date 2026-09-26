import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { buildPlan, MODULES } from '../../domain/furniture/modules/plan'
import { countParts, createBench, describeAdjustments, describeStructure } from './bench'

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

  it('a case the expert cannot do is reported, not thrown', async () => {
    const r = await bench.runCase({ id: 'bench', notes: 'Una banca para el recibidor', measures: null, expected: {} }, signal())
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('conecta un experto real') })
  })
})
