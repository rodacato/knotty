import { describe, expect, it } from 'vitest'
import { crearSimulado } from '../../adapters/llm/simulado/simulado'
import { catalogo } from '../../domain/fixtures/catalogo.test-util'
import { createBench } from './bench'

const bench = createBench({ llm: () => crearSimulado(0), catalog: catalogo })
const signal = () => new AbortController().signal

describe('the bench', () => {
  it('builds every module variant valid and with nothing to warn about', () => {
    const checks = bench.runModules()
    expect(checks.length).toBeGreaterThan(60)
    expect(checks.filter((c) => !c.valid || c.findings.length)).toEqual([])
  })

  it('runs a case and grades it: a bookcase designed piece by piece', async () => {
    const r = await bench.runCase(bench.cases.find((c) => c.id === 'librero')!, signal())
    expect(r).toMatchObject({ ok: true, path: 'pieces', reasonable: true, verdict: expect.any(String) })
    expect(r.state?.versiones).toHaveLength(1)
  })

  it('a bed goes through its ficha', async () => {
    const r = await bench.runCase(bench.cases.find((c) => c.id === 'cama')!, signal())
    expect(r).toMatchObject({ ok: true, path: 'ficha', reasonable: true, verdict: 'viable' })
  })

  it('a case the expert cannot do is reported, not thrown', async () => {
    const r = await bench.runCase({ id: 'banca', notes: 'Una banca para el recibidor', measures: null, expected: {} }, signal())
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('conecta un experto real') })
  })
})
