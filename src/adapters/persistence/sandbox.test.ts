import { describe, expect, it } from 'vitest'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import type { DesignState } from '../../domain/session/state'
import { createLocalRepository } from './localStorage'
import { createSandboxedRepository } from './sandbox'

function storage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size
    },
  }
}

const state = (name: string): DesignState => ({
  format: 9,
  measures: exampleBookcase.dimensions,
  versions: [{ n: 1, design: { ...exampleBookcase, name }, summary: name, reason: '', operations: [], date: '', origin: null, decisions: [], plan: null, extras: [] }],
  current: 1,
  requirements: [],
  decisions: [],
  chat: [],
  thumbnails: [],
  proposal: null,
  review: null,
  trace: [],
  accepted: [],
  tray: [],
  locks: {},
  ficha: null,
})

const nameOf = (s: DesignState | null) => s?.versions[0].design.name

describe('sandboxed repository', () => {
  it('works as the real one until the sandbox is on', () => {
    const real = createLocalRepository(storage())
    const repo = createSandboxedRepository(real)
    repo.save(state('mine'))
    expect(nameOf(real.load())).toBe('mine')
    expect(repo.active()).toBe(false)
  })

  it('never writes or clears the saved design while on, and starts empty', () => {
    const real = createLocalRepository(storage())
    const repo = createSandboxedRepository(real)
    repo.save(state('mine'))
    repo.enter()
    expect(repo.load()).toBeNull()
    repo.save(state('variant'))
    expect(nameOf(repo.load())).toBe('variant')
    repo.clear()
    expect(repo.load()).toBeNull()
    repo.save(state('another variant'))
    expect(nameOf(real.load())).toBe('mine')
  })

  it('brings the saved design back on leaving and drops whatever the sandbox held', () => {
    const real = createLocalRepository(storage())
    const repo = createSandboxedRepository(real)
    repo.save(state('mine'))
    repo.enter()
    repo.save(state('variant'))
    repo.leave()
    expect(repo.active()).toBe(false)
    expect(nameOf(repo.load())).toBe('mine')
    repo.enter()
    expect(repo.load()).toBeNull()
  })
})
