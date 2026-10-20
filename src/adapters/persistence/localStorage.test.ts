import { describe, expect, it } from 'vitest'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import type { DesignState } from '../../domain/session/state'
import saved from '../../domain/session/state-v1.fixture.json'
import { createLocalRepository, reduce } from './localStorage'

function storage(limit = Infinity): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      if (v.length > limit) throw new DOMException('lleno', 'QuotaExceededError')
      data.set(k, v)
    },
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size
    },
  }
}

const state = (versions = 1): DesignState => ({
  format: 9,
  measures: exampleBookcase.dimensions,
  versions: Array.from({ length: versions }, (_, i) => ({ n: i + 1, design: exampleBookcase, summary: `v${i + 1}`, reason: '', operations: [], date: '', origin: null, decisions: [], plan: null, extras: [], restores: null })),
  current: versions,
  requirements: [],
  decisions: [],
  chat: [],
  thumbnails: [{ view: 'front', dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(5000) }],
  proposal: null,
  review: null,
  trace: [],
  accepted: [],
  tray: [],
  locks: {},
  ficha: null,
})

describe('localStorage repository', () => {
  it('saves and loads, validating the schema', () => {
    const repo = createLocalRepository(storage())
    repo.save(state())
    expect(repo.load()).toEqual(state())
    repo.clear()
    expect(repo.load()).toBeNull()
  })

  it('ignores corrupt data', () => {
    const a = storage()
    a.setItem('knotty:design', '{"formato":1')
    expect(createLocalRepository(a).load()).toBeNull()
  })

  it('reads a session an older Knotty saved and migrates it', () => {
    const a = storage()
    a.setItem('despiece:v1:diseno', JSON.stringify(saved))
    const loaded = createLocalRepository(a).load()
    expect(loaded?.format).toBe(9)
    expect(loaded?.versions).toHaveLength(saved.versiones.length)
  })

  it('if it does not fit, drops thumbnails and then old versions', () => {
    const size = JSON.stringify({ ...state(6), thumbnails: [] }).length
    const repo = createLocalRepository(storage(size - 100))
    repo.save(state(6))
    const loaded = repo.load()!
    expect(loaded.thumbnails).toEqual([])
    expect(loaded.versions.map((v) => v.n)).toEqual([1, 3, 4, 5, 6])
  })

  it('the version the person went back to is never the one dropped', () => {
    const undone = { ...state(6), current: 2 }
    const repo = createLocalRepository(storage(JSON.stringify({ ...undone, thumbnails: [] }).length - 100))
    repo.save(undone)
    const loaded = repo.load()!
    expect(loaded.current).toBe(2)
    expect(loaded.versions.map((v) => v.n)).toEqual([1, 2, 4, 5, 6])
  })

  it('gives up instead of saving the same again when every version left is the current one', () => {
    const repeated = { ...state(4), current: 2 }
    const stuck = { ...repeated, thumbnails: [], versions: repeated.versions.map((v, i) => ({ ...v, n: i ? 2 : 1 })) }
    expect(reduce(stuck)).toBeNull()
  })
})
