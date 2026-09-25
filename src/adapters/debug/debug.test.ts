import { describe, expect, it } from 'vitest'
import { catalogo } from '../../domain/fixtures/catalogo.test-util'
import { librero } from '../../domain/fixtures/librero'
import { crearSimulado } from '../llm/simulado/simulado'
import { createLocalDebugLog } from './localDebugLog'
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

describe('createLocalDebugLog', () => {
  it('keeps events across reloads, and the panel stays hidden until asked for', () => {
    const storage = memoryStorage()
    const log = createLocalDebugLog(storage)
    log.record({ kind: 'action', summary: 'Diseñar' })
    expect(createLocalDebugLog(storage).events().map((e) => e.summary)).toEqual(['Diseñar'])
    expect(log.visible()).toBe(false)
    log.setVisible(true)
    expect(createLocalDebugLog(storage).visible()).toBe(true)
  })

  it('cuts long strings inside an event and drops the oldest events past the limit', () => {
    const log = createLocalDebugLog(memoryStorage())
    log.record({ kind: 'llm', summary: 'grande', data: { texto: 'x'.repeat(100_000) } })
    expect(JSON.stringify(log.events()[0]).length).toBeLessThan(60_000)
    for (let i = 0; i < 80; i++) log.record({ kind: 'llm', summary: `n${i}`, data: { a: 'y'.repeat(3_900), b: 'z'.repeat(3_900), c: 'w'.repeat(3_900), d: 'v'.repeat(3_900), e: 'u'.repeat(3_900), f: 't'.repeat(3_900) } })
    expect(JSON.stringify(log.events()).length).toBeLessThanOrEqual(1_500_000)
    expect(log.events().at(-1)?.summary).toBe('n79')
  })
})

describe('withDebugLog', () => {
  it('records each call with the request and the answer, leaving out photos and the catalog', async () => {
    const log = createLocalDebugLog(memoryStorage())
    const llm = withDebugLog(crearSimulado(0), log)
    await llm.reconstruir({ medidas: librero.dimensiones, fotos: [{ angulo: 'frente', base64: 'A'.repeat(4096) }], notas: 'librero', lectura: null, catalogo, correccion: null }, new AbortController().signal)
    const [event] = log.events()
    expect(event.kind).toBe('llm')
    expect(event.summary).toMatch(/^Diseño completo · Simulado/)
    const data = event.data as { request: { fotos: { base64: string }[]; catalogo: string }; answer: { valor: { diseno: { nombre: string } } } }
    expect(data.request.fotos[0].base64).toBe('[JPEG de 3 KB]')
    expect(data.request.catalogo).toBe('[catálogo]')
    expect(data.answer.valor.diseno.nombre).toBe('Librero')
  })

  it('records a failed call as an error and still throws it', async () => {
    const log = createLocalDebugLog(memoryStorage())
    const llm = withDebugLog({ ...crearSimulado(0), dictaminar: async () => Promise.reject(new Error('sin conexión')) }, log)
    await expect(llm.dictaminar({ contexto: '', revision: '', diseno: librero, comprobaciones: [], catalogo }, new AbortController().signal)).rejects.toThrow('sin conexión')
    expect(log.events()[0]).toMatchObject({ kind: 'error', summary: expect.stringContaining('Revisión antes de comprar falló') })
  })
})
