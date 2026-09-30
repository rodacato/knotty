import { describe, expect, it } from 'vitest'
import { HISTORY_LINES, recordStage, secondsSince, stageText } from './stageLog'

describe('stage log', () => {
  it('names each stage with the text the stage list uses', () => {
    expect(stageText({ name: 'designing', attempt: 0 })).toBe('Pensando el diseño')
    expect(stageText({ name: 'designing-pieces', attempt: 0 })).toBe('Diseñando pieza por pieza')
    expect(stageText({ name: 'reading-photos', attempt: 0 })).toBe('Mirando las fotos')
    expect(stageText({ name: 'reading-photos', attempt: 0, progress: { done: 1, total: 3 } })).toBe('Mirando las fotos (2 de 3)')
    expect(stageText({ name: 'reading-photos', attempt: 0, progress: { done: 3, total: 3 } })).toBe('Mirando las fotos (3 de 3)')
    expect(stageText({ name: 'correcting', attempt: 1 })).toContain('Intento 2 de')
  })

  it('does not invent lines for stages the waiting screen does not show', () => {
    expect(stageText({ name: 'proposing', attempt: 0 })).toBeNull()
    expect(recordStage([], { name: 'reviewing-criticals', attempt: 0 }, 1000)).toEqual([])
  })

  it('appends a line per real change, with its time', () => {
    let log = recordStage([], { name: 'designing', attempt: 0 }, 1000)
    log = recordStage(log, { name: 'checking', attempt: 0 }, 6000)
    expect(log).toEqual([
      { text: 'Pensando el diseño', at: 1000 },
      { text: 'Midiendo que todo cierre', at: 6000 },
    ])
  })

  it('ignores a repeated stage and keeps the same log object', () => {
    const log = recordStage([], { name: 'designing', attempt: 0 }, 1000)
    expect(recordStage(log, { name: 'designing', attempt: 0 }, 9000)).toBe(log)
  })

  it('counts each correction attempt as its own line', () => {
    let log = recordStage([], { name: 'correcting', attempt: 1 }, 1000)
    log = recordStage(log, { name: 'correcting', attempt: 2 }, 2000)
    expect(log).toHaveLength(2)
  })

  it('keeps only the last lines', () => {
    let log: ReturnType<typeof recordStage> = []
    for (let n = 0; n < 7; n++) log = recordStage(log, { name: 'reading-photos', attempt: 0, progress: { done: n, total: 9 } }, n * 1000)
    expect(log).toHaveLength(HISTORY_LINES)
    expect(log[log.length - 1]?.text).toBe('Mirando las fotos (7 de 9)')
    expect(log[0]?.text).toBe('Mirando las fotos (4 de 9)')
  })

  it('measures seconds from the start of the wait and never goes negative', () => {
    expect(secondsSince(1000, 4900)).toBe(3)
    expect(secondsSince(5000, 1000)).toBe(0)
  })
})
