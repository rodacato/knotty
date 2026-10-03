import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUseCases } from '../../application/useCases'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import type { DesignRepository } from '../../ports/DesignRepository'
import { InvalidResponse, type LLMProvider } from '../../ports/LLMProvider'
import { ProviderError } from './common/errors'
import { createSimulated } from './simulated/simulated'
import { canonicalJson, emptyRecording, parseRecording, RECORDING_VERSION, recordingProvider, replayProvider, ReplayMismatch } from './replay'

const STAMP = 'catalog-v1'
const signal = () => new AbortController().signal
const MEASURES = { width: 600, height: 1800, depth: 300 }

const run = async (llm: LLMProvider, notes = '') => {
  let n = 0
  const repository: DesignRepository = { load: () => null, save: () => {}, clear: () => {} }
  const c = createUseCases({ llm: () => llm, catalog: testCatalog, repository, now: () => '2026-10-02T10:00:00Z', newId: () => `m${++n}` })
  const first = await c.reconstruct({ measures: MEASURES, photos: [{ base64: 'AAAA' }], thumbnails: [], notes }, signal())
  const second = await c.adjust(first, 'Hazlo de 90 cm de ancho para mi espacio', signal())
  return { first, second }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-02T10:00:00Z'))
})
afterEach(() => vi.useRealTimers())

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v))

describe('canonicalJson', () => {
  it('sorts keys and drops undefined and signal', () => {
    expect(canonicalJson({ b: 1, a: [{ d: undefined, c: 2 }], signal: 'x' })).toBe('{"a":[{"c":2}],"b":1}')
  })
})

describe('record and replay through the app', () => {
  it('replays the same states offline and consumes every entry', async () => {
    const recording = emptyRecording(STAMP)
    const live = await run(recordingProvider(createSimulated(0), recording, { catalogStamp: STAMP }))
    expect(recording.entries.length).toBeGreaterThan(1)
    const replay = replayProvider(parseRecording(json(recording)), { catalogStamp: STAMP })
    expect(await run(replay)).toEqual(json(live))
    expect(replay.unused()).toEqual([])
  })

  it('refuses a changed input with the differing path, even when the app wraps the error', async () => {
    const recording = emptyRecording(STAMP)
    await run(recordingProvider(createSimulated(0), recording, { catalogStamp: STAMP }))
    const replay = replayProvider(recording, { catalogStamp: STAMP })
    await expect(run(replay, 'librero con puertas')).rejects.toThrow(/Replay mismatch/)
    const [mismatch] = replay.mismatches()
    expect(mismatch).toBeInstanceOf(ReplayMismatch)
    expect(mismatch.differsAt).toBe('$.context')
    expect(mismatch.nearest?.method).toBe(mismatch.method)
  })

  it('refuses a different catalog stamp', async () => {
    const recording = emptyRecording(STAMP)
    await run(recordingProvider(createSimulated(0), recording, { catalogStamp: STAMP }))
    const replay = replayProvider(recording, { catalogStamp: 'other' })
    await expect(run(replay)).rejects.toThrow(/catalog stamp/)
    expect(replay.mismatches()[0]).toBeInstanceOf(ReplayMismatch)
  })

  it('reports entries the run never asked for', async () => {
    const recording = emptyRecording(STAMP)
    await run(recordingProvider(createSimulated(0), recording, { catalogStamp: STAMP }))
    const replay = replayProvider(recording, { catalogStamp: STAMP })
    expect(replay.unused()).toHaveLength(recording.entries.length)
    const first = recording.entries[0]
    await (replay[first.method] as (r: unknown, s: AbortSignal) => Promise<unknown>)?.(first.request, signal()).catch(() => {})
    expect(replay.unused().length).toBeGreaterThan(0)
  })

  it('keeps an absent planDesign absent', () => {
    const recording = emptyRecording(STAMP)
    recordingProvider({ ...createSimulated(0), planDesign: null, adjustPlan: null }, recording, { catalogStamp: STAMP })
    expect(replayProvider(recording, { catalogStamp: STAMP }).planDesign).toBeNull()
    expect(replayProvider(emptyRecording(STAMP), { catalogStamp: STAMP }).planDesign).not.toBeNull()
  })
})

describe('recorded failures', () => {
  const stub = (failures: Error[]): LLMProvider => {
    const sim = createSimulated(0)
    const gate =
      <A extends unknown[], R>(call: (...a: A) => Promise<R>) =>
      (...a: A) => {
        const e = failures.shift()
        return e ? Promise.reject(e) : call(...a)
      }
    return { ...sim, apiKey: 'sk-secret-123', reconstruct: gate(sim.reconstruct.bind(sim)), planDesign: sim.planDesign && gate(sim.planDesign.bind(sim)) } as LLMProvider
  }

  it('replays an invalid response in order, then the retry gets the next entry', async () => {
    const recording = emptyRecording(STAMP)
    const live = await run(recordingProvider(stub([new InvalidResponse({ bad: true }, 'missing design')]), recording, { catalogStamp: STAMP }))
    expect(recording.entries.filter((e) => !e.outcome.ok)).toHaveLength(1)
    const replay = replayProvider(parseRecording(json(recording)), { catalogStamp: STAMP })
    expect(await run(replay)).toEqual(json(live))
    expect(replay.unused()).toEqual([])
  })

  it('rethrows the same class, with the raw response and problems', async () => {
    const recording = emptyRecording(STAMP)
    const provider = recordingProvider(stub([new InvalidResponse({ bad: true }, 'missing design'), new ProviderError(new Error('boom'))]), recording, { catalogStamp: STAMP })
    const request = { measures: MEASURES, photos: [], notes: '', reading: null, catalog: testCatalog, correction: null } as never
    const target = (p: LLMProvider) => p.planDesign ?? p.reconstruct
    await target(provider)(request, signal()).catch(() => {})
    await target(provider)(request, signal()).catch(() => {})
    const replay = replayProvider(recording, { catalogStamp: STAMP })
    const first = await target(replay)(request, signal()).catch((e) => e)
    expect(first).toBeInstanceOf(InvalidResponse)
    expect(first.response).toEqual({ bad: true })
    expect(first.problems).toBe('missing design')
    expect(await target(replay)(request, signal()).catch((e) => e)).toBeInstanceOf(ProviderError)
  })

  it('never records credentials and survives a JSON round-trip', async () => {
    const recording = emptyRecording(STAMP)
    await run(recordingProvider(stub([]), recording, { catalogStamp: STAMP }))
    const text = JSON.stringify(recording)
    expect(text).not.toContain('sk-secret-123')
    expect(text).not.toMatch(/apiKey/i)
    expect(parseRecording(JSON.parse(text))).toEqual(JSON.parse(text))
  })
})

describe('parseRecording', () => {
  it('refuses another version and malformed files', () => {
    expect(() => parseRecording({ ...emptyRecording(STAMP), version: RECORDING_VERSION + 1 })).toThrow(/version/)
    expect(() => parseRecording({ version: RECORDING_VERSION, entries: 'x' })).toThrow(/./)
  })
})
