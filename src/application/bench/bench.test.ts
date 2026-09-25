import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/fixtures/catalog.test-util'
import { createBench } from './bench'

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

  it('a bed goes through its ficha', async () => {
    const r = await bench.runCase(bench.cases.find((c) => c.id === 'bed')!, signal())
    expect(r).toMatchObject({ ok: true, path: 'ficha', reasonable: true, verdict: 'viable' })
  })

  it('a case the expert cannot do is reported, not thrown', async () => {
    const r = await bench.runCase({ id: 'banca', notes: 'Una banca para el recibidor', measures: null, expected: {} }, signal())
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('conecta un experto real') })
  })
})
