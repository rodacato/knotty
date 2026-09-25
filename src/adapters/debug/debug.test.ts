import { describe, expect, it } from 'vitest'
import { testCatalog } from '../../domain/fixtures/catalog.test-util'
import { exampleBookcase } from '../../domain/fixtures/bookcase'
import { createSimulated } from '../llm/simulated/simulated'
import { createDebugLog, localStorageStore, type EventStore } from './localDebugLog'
import { withDebugLog } from './loggedProvider'

const memoryStorage = (): Storage => {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  }
}

const fromStorage = (storage: Storage) => createDebugLog(localStorageStore(storage), storage)
const settle = () => new Promise((r) => setTimeout(r, 0))

describe('createDebugLog', () => {
  it('keeps events across reloads, and the panel stays hidden until asked for', async () => {
    const storage = memoryStorage()
    const log = fromStorage(storage)
    log.record({ kind: 'action', summary: 'Diseñar' })
    const reloaded = fromStorage(storage)
    await settle()
    expect(reloaded.events().map((e) => e.summary)).toEqual(['Diseñar'])
    expect(log.visible()).toBe(false)
    log.setVisible(true)
    expect(fromStorage(storage).visible()).toBe(true)
  })

  it('an event recorded while the stored ones load goes after them', async () => {
    const stored = { at: '2026-01-01T00:00:00Z', kind: 'app' as const, summary: 'antes' }
    let release = (_: typeof stored[]) => {}
    const store: EventStore = { load: () => new Promise((r) => (release = r)), append: () => {}, clear: () => {}, keep: () => {} }
    const log = createDebugLog(store, memoryStorage())
    log.record({ kind: 'action', summary: 'después' })
    release([stored])
    await settle()
    expect(log.events().map((e) => e.summary)).toEqual(['antes', 'después'])
  })

  it('the localStorage fallback cuts long strings and drops the oldest events past its limit; memory keeps them whole', () => {
    const storage = memoryStorage()
    const log = fromStorage(storage)
    const saved = () => JSON.parse(storage.getItem('knotty:debug:events') ?? '[]') as { summary: string }[]
    log.record({ kind: 'llm', summary: 'grande', data: { text: 'x'.repeat(100_000) } })
    expect(JSON.stringify(saved()[0]).length).toBeLessThan(60_000)
    expect(JSON.stringify(log.events()[0]).length).toBeGreaterThan(100_000)
    for (let i = 0; i < 80; i++) log.record({ kind: 'llm', summary: `n${i}`, data: { a: 'y'.repeat(3_900), b: 'z'.repeat(3_900), c: 'w'.repeat(3_900), d: 'v'.repeat(3_900), e: 'u'.repeat(3_900), f: 't'.repeat(3_900) } })
    expect(JSON.stringify(saved()).length).toBeLessThanOrEqual(1_500_000)
    expect(saved().at(-1)?.summary).toBe('n79')
  })
})

describe('withDebugLog', () => {
  it('records each call with the request and the answer, leaving out photos and the catalog', async () => {
    const log = fromStorage(memoryStorage())
    const llm = withDebugLog(createSimulated(0), log)
    await llm.reconstruct({ measures: exampleBookcase.dimensions, photos: [{ angle: 'front', base64: 'A'.repeat(4096) }], notes: 'librero', reading: null, catalog: testCatalog, correction: null }, new AbortController().signal)
    const [event] = log.events()
    expect(event.kind).toBe('llm')
    expect(event.summary).toMatch(/^Diseño completo · Simulado/)
    const data = event.data as { request: { photos: { base64: string }[]; catalog: string }; answer: { value: { design: { name: string } } } }
    expect(data.request.photos[0].base64).toBe('[JPEG, 3 KB]')
    expect(data.request.catalog).toBe('[catalog]')
    expect(data.answer.value.design.name).toBe('Librero')
  })

  it('records a failed call as an error and still throws it', async () => {
    const log = fromStorage(memoryStorage())
    const llm = withDebugLog({ ...createSimulated(0), reviewPurchase: async () => Promise.reject(new Error('sin conexión')) }, log)
    await expect(llm.reviewPurchase({ context: '', review: '', design: exampleBookcase, checks: [], catalog: testCatalog }, new AbortController().signal)).rejects.toThrow('sin conexión')
    expect(log.events()[0]).toMatchObject({ kind: 'error', summary: expect.stringContaining('Revisión antes de comprar falló') })
  })
})
