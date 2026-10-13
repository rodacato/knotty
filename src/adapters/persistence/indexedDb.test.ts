import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import type { DesignState } from '../../domain/session/state'
import saved from '../../domain/session/state-v1.fixture.json'
import { createIndexedRepository, DATABASE, DESIGNS, META, OPEN, type StoredDesign } from './indexedDb'

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

const state = (summary = 'v1', versions = 1): DesignState => ({
  format: 9,
  measures: exampleBookcase.dimensions,
  versions: Array.from({ length: versions }, (_, i) => ({ n: i + 1, design: exampleBookcase, summary, reason: '', operations: [], date: '', origin: null, decisions: [], plan: null, extras: [], restores: null })),
  current: versions,
  requirements: [],
  decisions: [],
  chat: [],
  thumbnails: [{ view: 'front', dataUrl: 'data:image/jpeg;base64,AAAA' }],
  proposal: null,
  review: null,
  trace: [],
  accepted: [],
  tray: [],
  locks: {},
  ficha: null,
})

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function stored(factory: IDBFactory): Promise<{ designs: StoredDesign[]; open: unknown }> {
  const db = await result(factory.open(DATABASE))
  const tx = db.transaction([DESIGNS, META])
  const designs = await result(tx.objectStore(DESIGNS).getAll())
  const open = await result(tx.objectStore(META).get(OPEN))
  db.close()
  return { designs, open }
}

function failDesignWrites(error: (record: StoredDesign) => DOMException | null) {
  const put = IDBObjectStore.prototype.put
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
    const failure = this.name === DESIGNS ? error(value) : null
    if (failure) throw failure
    return put.call(this, value, key)
  })
}

const KEY = 'knotty:design'
const inStorage = (local: Storage) => JSON.parse(local.getItem(KEY) ?? 'null') as unknown
const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function openingLate(real: IDBFactory, ms: number) {
  const opened: IDBDatabase[] = []
  const factory = {
    open(name: string, version?: number) {
      const inner = real.open(name, version)
      const outer = {
        get result() {
          return inner.result
        },
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
      }
      inner.onupgradeneeded = () => outer.onupgradeneeded?.()
      inner.onsuccess = () => {
        opened.push(inner.result)
        setTimeout(() => outer.onsuccess?.(), ms)
      }
      return outer
    },
  } as unknown as IDBFactory
  return { factory, opened }
}

const clock = () => {
  let tick = 0
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString()
}

afterEach(() => vi.restoreAllMocks())

describe('IndexedDB repository', () => {
  it('a new repository over the same database loads what was saved', async () => {
    const factory = new IDBFactory()
    const repo = await createIndexedRepository({ factory, storage: storage(), now: clock(), newId: () => 'a' })
    expect(repo.load()).toBeNull()
    repo.save(state())
    expect(repo.load()).toEqual(state())
    await repo.settled()

    expect((await createIndexedRepository({ factory, storage: storage() })).load()).toEqual(state())
    expect(await stored(factory)).toEqual({ designs: [{ id: 'a', name: exampleBookcase.name, updatedAt: '2026-01-01T00:00:00.000Z', state: state() }], open: 'a' })
  })

  it('keeps one record with the same id, holding the last of several quick saves', async () => {
    const factory = new IDBFactory()
    let minted = 0
    const repo = await createIndexedRepository({ factory, storage: storage(), newId: () => `id-${++minted}` })
    repo.save(state('first'))
    repo.save(state('second'))
    repo.save(state('third'))
    await repo.settled()
    repo.save(state('fourth'))
    await repo.settled()

    const { designs, open } = await stored(factory)
    expect(designs.map((d) => [d.id, d.state.versions[0].summary])).toEqual([['id-1', 'fourth']])
    expect(open).toBe('id-1')
    expect((await createIndexedRepository({ factory, storage: storage() })).load()).toEqual(state('fourth'))
  })

  it('stores the last save even when it arrives while an earlier one is being written', async () => {
    const factory = new IDBFactory()
    const repo = await createIndexedRepository({ factory, storage: storage() })
    repo.save(state('first'))
    await Promise.resolve()
    repo.save(state('second'))
    await repo.settled()
    expect((await createIndexedRepository({ factory, storage: storage() })).load()).toEqual(state('second'))
  })

  it('clear leaves nothing for a new repository', async () => {
    const factory = new IDBFactory()
    const repo = await createIndexedRepository({ factory, storage: storage() })
    repo.save(state())
    repo.clear()
    expect(repo.load()).toBeNull()
    await repo.settled()

    expect((await createIndexedRepository({ factory, storage: storage() })).load()).toBeNull()
    expect(await stored(factory)).toEqual({ designs: [], open: undefined })
  })

  it('a design saved after a clear is a new record', async () => {
    const factory = new IDBFactory()
    let minted = 0
    const repo = await createIndexedRepository({ factory, storage: storage(), newId: () => `id-${++minted}` })
    repo.save(state('first'))
    await repo.settled()
    repo.clear()
    repo.save(state('second'))
    await repo.settled()
    expect((await stored(factory)).designs.map((d) => [d.id, d.state.versions[0].summary])).toEqual([['id-2', 'second']])
  })

  it('moves a design found in localStorage and removes it from there', async () => {
    const factory = new IDBFactory()
    const local = storage()
    local.setItem('knotty:design', JSON.stringify(state()))
    const repo = await createIndexedRepository({ factory, storage: local })
    expect(repo.load()).toEqual(state())
    expect(local.getItem('knotty:design')).not.toBeNull()
    await repo.settled()

    expect(local.length).toBe(0)
    expect((await createIndexedRepository({ factory, storage: storage() })).load()).toEqual(state())
  })

  it('leaves the design in localStorage when it cannot be written to IndexedDB', async () => {
    const factory = new IDBFactory()
    const local = storage()
    local.setItem('knotty:design', JSON.stringify(state()))
    failDesignWrites(() => new DOMException('broken', 'UnknownError'))
    const repo = await createIndexedRepository({ factory, storage: local })
    await repo.settled()

    expect(repo.load()).toEqual(state())
    expect((await stored(factory)).designs).toEqual([])
    expect(JSON.parse(local.getItem('knotty:design')!)).toEqual(state())
  })

  it('a save that IndexedDB refuses goes to localStorage, and comes back from there once it can be written', async () => {
    const factory = new IDBFactory()
    const local = storage()
    const repo = await createIndexedRepository({ factory, storage: local })
    repo.save(state('first'))
    await repo.settled()
    failDesignWrites(() => new DOMException('broken', 'UnknownError'))
    repo.save(state('second'))
    await repo.settled()
    expect(JSON.parse(local.getItem('knotty:design')!)).toEqual(state('second'))

    vi.restoreAllMocks()
    const next = await createIndexedRepository({ factory, storage: local })
    expect(next.load()).toEqual(state('second'))
    await next.settled()
    expect(local.length).toBe(0)
    expect((await stored(factory)).designs.map((d) => d.state.versions[0].summary)).toEqual(['second'])
  })

  it('a session an older Knotty saved in localStorage arrives migrated', async () => {
    const factory = new IDBFactory()
    const local = storage()
    local.setItem('despiece:v1:diseno', JSON.stringify(saved))
    await (await createIndexedRepository({ factory, storage: local })).settled()

    expect(local.length).toBe(0)
    const loaded = (await createIndexedRepository({ factory, storage: storage() })).load()
    expect(loaded?.format).toBe(9)
    expect(loaded?.versions).toHaveLength(saved.versiones.length)
  })

  it('migrates a record stored in an older format', async () => {
    const factory = new IDBFactory()
    await (await createIndexedRepository({ factory, storage: storage() })).settled()
    const db = await result(factory.open(DATABASE))
    const tx = db.transaction([DESIGNS, META], 'readwrite')
    tx.objectStore(DESIGNS).put({ id: 'old', name: 'x', updatedAt: '', state: saved })
    await result(tx.objectStore(META).put('old', OPEN))
    db.close()

    const loaded = (await createIndexedRepository({ factory, storage: storage() })).load()
    expect(loaded?.format).toBe(9)
    expect(loaded?.versions).toHaveLength(saved.versiones.length)
  })

  it('a corrupt record loads as nothing', async () => {
    const factory = new IDBFactory()
    await (await createIndexedRepository({ factory, storage: storage() })).settled()
    const db = await result(factory.open(DATABASE))
    const tx = db.transaction([DESIGNS, META], 'readwrite')
    tx.objectStore(DESIGNS).put({ id: 'bad', name: 'x', updatedAt: '', state: { format: 9, versions: 'none' } })
    await result(tx.objectStore(META).put('bad', OPEN))
    db.close()

    expect((await createIndexedRepository({ factory, storage: storage() })).load()).toBeNull()
  })

  it('without IndexedDB it saves in localStorage', async () => {
    const local = storage()
    const repo = await createIndexedRepository({ factory: null, storage: local })
    repo.save(state())
    await repo.settled()
    expect(JSON.parse(local.getItem('knotty:design')!)).toEqual(state())
    expect((await createIndexedRepository({ factory: null, storage: local })).load()).toEqual(state())
    repo.clear()
    expect(local.length).toBe(0)
  })

  it('when the database cannot be opened it saves in localStorage', async () => {
    const refusing = {
      open() {
        const request = { error: new DOMException('refused', 'UnknownError'), onerror: null as (() => void) | null }
        queueMicrotask(() => request.onerror?.())
        return request
      },
    } as unknown as IDBFactory
    const local = storage()
    const repo = await createIndexedRepository({ factory: refusing, storage: local })
    repo.save(state())
    expect(JSON.parse(local.getItem('knotty:design')!)).toEqual(state())
    expect((await createIndexedRepository({ factory: refusing, storage: local })).load()).toEqual(state())
  })

  it('if it does not fit, drops thumbnails and then old versions', async () => {
    const factory = new IDBFactory()
    const local = storage()
    failDesignWrites((record) => (record.state.thumbnails.length || record.state.versions.length > 5 ? new DOMException('full', 'QuotaExceededError') : null))
    const repo = await createIndexedRepository({ factory, storage: local })
    repo.save(state('v', 6))
    await repo.settled()
    vi.restoreAllMocks()

    expect(local.length).toBe(0)
    const loaded = (await createIndexedRepository({ factory, storage: storage() })).load()!
    expect(loaded.thumbnails).toEqual([])
    expect(loaded.versions.map((v) => v.n)).toEqual([1, 3, 4, 5, 6])
  })

  describe('when the page is hidden or unloaded', () => {
    it.each(['pagehide', 'visibilitychange'])('on %s a save not yet committed is in localStorage, and a new repository loads it from there', async (event) => {
      const local = storage()
      const page = new EventTarget()
      const repo = await createIndexedRepository({ factory: new IDBFactory(), storage: local, page, hidden: () => true })
      repo.save(state('unsaved'))
      expect(local.length).toBe(0)
      page.dispatchEvent(new Event(event))
      expect(inStorage(local)).toEqual(state('unsaved'))

      const leftBehind = storage()
      leftBehind.setItem(KEY, local.getItem(KEY)!)
      expect((await createIndexedRepository({ factory: new IDBFactory(), storage: leftBehind, page: null })).load()).toEqual(state('unsaved'))
    })

    it('the copy leaves localStorage once the save is committed', async () => {
      const factory = new IDBFactory()
      const local = storage()
      const page = new EventTarget()
      const repo = await createIndexedRepository({ factory, storage: local, page })
      repo.save(state())
      page.dispatchEvent(new Event('pagehide'))
      await repo.settled()

      expect(local.length).toBe(0)
      expect((await createIndexedRepository({ factory, storage: storage(), page: null })).load()).toEqual(state())
    })

    it('the copy stays while a later save is still waiting behind the one being written', async () => {
      const local = storage()
      const page = new EventTarget()
      const during: unknown[] = []
      failDesignWrites((record) => {
        if (record.state.versions[0].summary === 'second') during.push(inStorage(local))
        return null
      })
      const repo = await createIndexedRepository({ factory: new IDBFactory(), storage: local, page })
      repo.save(state('first'))
      await Promise.resolve()
      repo.save(state('second'))
      page.dispatchEvent(new Event('pagehide'))
      await repo.settled()

      expect(during).toEqual([state('second')])
      expect(local.length).toBe(0)
    })

    it('writes nothing to localStorage when every save is committed', async () => {
      const local = storage()
      const page = new EventTarget()
      const repo = await createIndexedRepository({ factory: new IDBFactory(), storage: local, page, hidden: () => true })
      repo.save(state())
      await repo.settled()
      page.dispatchEvent(new Event('pagehide'))
      page.dispatchEvent(new Event('visibilitychange'))
      expect(local.length).toBe(0)
    })

    it('writes nothing when the page becomes visible again', async () => {
      const local = storage()
      const page = new EventTarget()
      const repo = await createIndexedRepository({ factory: new IDBFactory(), storage: local, page, hidden: () => false })
      repo.save(state())
      page.dispatchEvent(new Event('visibilitychange'))
      expect(local.length).toBe(0)
      await repo.settled()
    })

    it('does not bring back a design that was cleared', async () => {
      const factory = new IDBFactory()
      const local = storage()
      const page = new EventTarget()
      const repo = await createIndexedRepository({ factory, storage: local, page })
      repo.save(state())
      await Promise.resolve()
      repo.clear()
      page.dispatchEvent(new Event('pagehide'))
      expect(local.length).toBe(0)
      await repo.settled()

      expect(local.length).toBe(0)
      expect((await createIndexedRepository({ factory, storage: local, page: null })).load()).toBeNull()
    })
  })

  describe('when the database is slow to open', () => {
    it('a database that never answers leaves a repository that saves in localStorage', async () => {
      const silent = { open: () => ({}) } as unknown as IDBFactory
      const local = storage()
      const started = Date.now()
      const repo = await createIndexedRepository({ factory: silent, storage: local, openLimitMs: 20 })
      expect(Date.now() - started).toBeLessThan(2000)

      repo.save(state())
      expect(inStorage(local)).toEqual(state())
      expect((await createIndexedRepository({ factory: null, storage: local })).load()).toEqual(state())
    })

    it('a database that opens after the limit is closed and not written to', async () => {
      const real = new IDBFactory()
      const { factory, opened } = openingLate(real, 60)
      const local = storage()
      const repo = await createIndexedRepository({ factory, storage: local, openLimitMs: 20 })
      repo.save(state())
      await later(120)
      await repo.settled()

      expect(inStorage(local)).toEqual(state())
      expect((await stored(real)).designs).toEqual([])
      expect(() => opened[0].transaction(DESIGNS)).toThrow(expect.objectContaining({ name: 'InvalidStateError' }))
    })

    it('a database that opens within the limit is used', async () => {
      const real = new IDBFactory()
      const { factory } = openingLate(real, 5)
      const local = storage()
      const repo = await createIndexedRepository({ factory, storage: local, openLimitMs: 2000 })
      repo.save(state())
      await repo.settled()

      expect(local.length).toBe(0)
      expect((await stored(real)).designs.map((d) => d.id)).toHaveLength(1)
    })
  })
})
