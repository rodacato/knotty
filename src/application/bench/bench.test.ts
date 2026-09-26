import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/fixtures/catalog.test-util'
import { createBench, describeAdjustments } from './bench'

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

  it('a case the expert cannot do is reported, not thrown', async () => {
    const r = await bench.runCase({ id: 'bench', notes: 'Una banca para el recibidor', measures: null, expected: {} }, signal())
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('conecta un experto real') })
  })
})
