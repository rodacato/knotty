import { describe, expect, it } from 'vitest'
import { exampleBookcase } from '../fixtures/bookcase'
import { updateDecisions, compactLog, pruneVersions, type Version } from './history'

const version = (n: number): Version => ({ n, design: exampleBookcase, summary: `cambio ${n}`, reason: `pedido ${n}`, operations: ['x→900 estirar'], date: '2026-09-24', origin: null, decisions: [], plan: null, extras: [] })

describe('history', () => {
  it('compacts the log: 8 in full, up to 30 summarized and the rest counted', () => {
    const lineas = compactLog(Array.from({ length: 35 }, (_, i) => version(i + 1)))
    expect(lineas[0]).toBe('(5 cambios anteriores)')
    expect(lineas[1]).toBe('v6: cambio 6')
    expect(lineas.at(-1)).toBe('v35: cambio 35 — pedido: "pedido 35" — x→900 estirar')
    expect(lineas.filter((l) => l.includes('pedido:'))).toHaveLength(8)
    expect(lineas).toHaveLength(31)
  })

  it('a new decision replaces the one on the same topic', () => {
    const d = updateDecisions([{ topic: 'trasera', text: 'TR3' }, { topic: 'espesor', text: '15 mm' }], [{ topic: 'trasera', text: 'TR6 para escuadrar' }])
    expect(d).toEqual([{ topic: 'espesor', text: '15 mm' }, { topic: 'trasera', text: 'TR6 para escuadrar' }])
  })

  it('prunes versions keeping the first one', () => {
    const podadas = pruneVersions(Array.from({ length: 50 }, (_, i) => version(i + 1)))
    expect(podadas).toHaveLength(40)
    expect(podadas[0].n).toBe(1)
    expect(podadas[1].n).toBe(12)
  })
})
