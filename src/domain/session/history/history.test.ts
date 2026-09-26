import { describe, expect, it } from 'vitest'
import { exampleBookcase } from '../../furniture/fixtures/bookcase'
import { updateDecisions, compactLog, pruneVersions, type Version } from './history'

const version = (n: number): Version => ({ n, design: exampleBookcase, summary: `cambio ${n}`, reason: `pedido ${n}`, operations: ['x→900 estirar'], date: '2026-09-24', origin: null, decisions: [], plan: null, extras: [] })

describe('history', () => {
  it('compacts the log: 8 in full, up to 30 summarized and the rest counted', () => {
    const lines = compactLog(Array.from({ length: 35 }, (_, i) => version(i + 1)))
    expect(lines[0]).toBe('(5 earlier changes)')
    expect(lines[1]).toBe('v6: cambio 6')
    expect(lines.at(-1)).toBe('v35: cambio 35 — request: "pedido 35" — x→900 estirar')
    expect(lines.filter((l) => l.includes('request:'))).toHaveLength(8)
    expect(lines).toHaveLength(31)
  })

  it('a new decision replaces the one on the same topic', () => {
    const d = updateDecisions([{ topic: 'back', text: 'TR3' }, { topic: 'thickness', text: '15 mm' }], [{ topic: 'back', text: 'TR6 para escuadrar' }])
    expect(d).toEqual([{ topic: 'thickness', text: '15 mm' }, { topic: 'back', text: 'TR6 para escuadrar' }])
  })

  it('prunes versions keeping the first one', () => {
    const pruned = pruneVersions(Array.from({ length: 50 }, (_, i) => version(i + 1)))
    expect(pruned).toHaveLength(40)
    expect(pruned[0].n).toBe(1)
    expect(pruned[1].n).toBe(12)
  })
})
