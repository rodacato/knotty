import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { savedState } from '../../domain/session/state.fixture'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { LIBRARY_PLACES } from '../../ports/DesignLibrary'
import { createIndexedRepository, DATABASE, DESIGNS, META } from './indexedDb'
import { noLibrary, PLACE_STATES } from './library'
import { KEYS } from '../storedKey'

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

const named = (name: string, versions = 1): DesignState => {
  const state = savedState(versions)
  return { ...state, versions: state.versions.map((v) => ({ ...v, design: { ...v.design, name } })) }
}

const start = (factory: IDBFactory, now = '2026-10-13T10:00:00.000Z') => createIndexedRepository({ factory, storage: storage(), now: () => now, page: null })

afterEach(() => vi.restoreAllMocks())

describe('the places of the library', () => {
  it('starts with five empty places and an open design that belongs to none', async () => {
    const { library } = await start(new IDBFactory())
    expect(library.available).toBe(true)
    expect(library.places()).toEqual(Array.from({ length: LIBRARY_PLACES }, () => null))
    expect(library.current()).toEqual({ place: null, saved: false })
  })

  it('keeps the open design in a place under a name, and still there after a restart', async () => {
    const factory = new IDBFactory()
    const repo = await start(factory)
    repo.save(named('Librero'))
    expect(await repo.library.saveTo(2, 'El del estudio')).toBe(true)
    expect(repo.library.places()[1]).toEqual({ place: 2, name: 'El del estudio', savedAt: '2026-10-13T10:00:00.000Z', design: currentDesign(named('Librero')) })
    expect(repo.library.current()).toEqual({ place: 2, saved: true })
    await repo.settled()

    const again = await start(factory)
    expect(again.library.places()[1]?.name).toBe('El del estudio')
    expect(again.library.current()).toEqual({ place: 2, saved: true })
    expect(await again.library.read(2)).toEqual(named('Librero'))
  })

  it('knows the place no longer holds the open design once it changes, also after a restart', async () => {
    const factory = new IDBFactory()
    const repo = await start(factory)
    const first = named('Librero')
    repo.save(first)
    await repo.library.saveTo(1, 'Librero')
    repo.save(first)
    expect(repo.library.current().saved).toBe(true)
    repo.save(named('Librero', 2))
    expect(repo.library.current()).toEqual({ place: 1, saved: false })
    await repo.settled()

    const again = await start(factory)
    expect(again.library.current()).toEqual({ place: 1, saved: false })
    expect((await again.library.read(1))?.versions).toHaveLength(1)
    expect(again.load()?.versions).toHaveLength(2)
  })

  it('opens a place as the open design, leaving the place as it was', async () => {
    const factory = new IDBFactory()
    const repo = await start(factory)
    repo.save(named('Librero'))
    await repo.library.saveTo(1, 'Librero')
    repo.save(named('Mesa'))
    repo.library.detach()
    await repo.library.saveTo(3, 'Mesa')

    expect(await repo.library.open(1)).toEqual(named('Librero'))
    expect(repo.load()).toEqual(named('Librero'))
    expect(repo.library.current()).toEqual({ place: 1, saved: true })
    await repo.settled()
    const again = await start(factory)
    expect(currentDesign(again.load()!).name).toBe('Librero')
    expect(again.library.current()).toEqual({ place: 1, saved: true })
    expect((await again.library.read(3)) && currentDesign((await again.library.read(3))!).name).toBe('Mesa')
  })

  it('still holds the open design in its place when the page was hidden in the middle of a write and left a copy behind', async () => {
    const factory = new IDBFactory()
    const local = storage()
    const page = new EventTarget()
    const repo = await createIndexedRepository({ factory, storage: local, page })
    repo.save(named('Librero'))
    await repo.library.saveTo(1, 'Librero')
    await repo.library.open(1)
    page.dispatchEvent(new Event('pagehide'))
    const left = storage()
    left.setItem(KEYS.design[0], local.getItem(KEYS.design[0])!)
    await repo.settled()

    const again = await createIndexedRepository({ factory, storage: left, page: null })
    expect(again.library.current()).toEqual({ place: 1, saved: true })
    await again.settled()
    expect(again.library.current()).toEqual({ place: 1, saved: true })
  })

  it('does not take another design for the one a place holds', async () => {
    const repo = await start(new IDBFactory())
    repo.save(named('Librero'))
    await repo.library.saveTo(1, 'Librero')
    repo.save(named('Mesa'))
    repo.library.detach()
    expect(repo.library.current()).toEqual({ place: null, saved: false })
    expect(repo.library.places()[0]?.design.name).toBe('Librero')
  })

  it('forgets the place when the open design is thrown away, and keeps what the place holds', async () => {
    const repo = await start(new IDBFactory())
    repo.save(named('Librero'))
    await repo.library.saveTo(4, 'Librero')
    repo.clear()
    expect(repo.library.current()).toEqual({ place: null, saved: false })
    expect(await repo.library.read(4)).toEqual(named('Librero'))
  })

  it('renames and removes a place, and neither comes back after a restart', async () => {
    const factory = new IDBFactory()
    const repo = await start(factory)
    repo.save(named('Librero'))
    await repo.library.saveTo(1, 'Librero')
    await repo.library.saveTo(2, 'Copia')
    repo.library.rename(1, 'El bueno')
    repo.library.remove(2)
    expect(repo.library.current()).toEqual({ place: null, saved: false })
    expect(repo.load()).toEqual(named('Librero'))
    await repo.settled()

    const again = await start(factory)
    expect(again.library.places().map((p) => p?.name ?? null)).toEqual(['El bueno', null, null, null, null])
    expect(await again.library.read(2)).toBeNull()
  })

  it('replaces what a place held', async () => {
    const repo = await start(new IDBFactory())
    repo.save(named('Librero'))
    await repo.library.saveTo(1, 'Librero')
    repo.save(named('Mesa'))
    repo.library.detach()
    await repo.library.saveTo(1, 'Mesa')
    expect(repo.library.places()[0]?.name).toBe('Mesa')
    expect(currentDesign((await repo.library.read(1))!).name).toBe('Mesa')
  })

  it('says so when there was no room, and the place stays as it was', async () => {
    const repo = await start(new IDBFactory())
    repo.save(named('Librero'))
    await repo.library.saveTo(1, 'Librero')
    repo.save(named('Mesa'))
    repo.library.detach()
    const put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === PLACE_STATES) throw new DOMException('full', 'QuotaExceededError')
      return put.call(this, value, key)
    })
    expect(await repo.library.saveTo(1, 'Mesa')).toBe(false)
    expect(repo.library.places()[0]?.name).toBe('Librero')
    expect(repo.library.current()).toEqual({ place: null, saved: false })
  })

  it('refuses a place that does not exist and saving with nothing open', async () => {
    const repo = await start(new IDBFactory())
    expect(await repo.library.saveTo(1, 'Nada')).toBe(false)
    repo.save(named('Librero'))
    expect(await repo.library.saveTo(0, 'x')).toBe(false)
    expect(await repo.library.saveTo(6, 'x')).toBe(false)
    expect(await repo.library.open(3)).toBeNull()
    expect(repo.load()).toEqual(named('Librero'))
  })

  it('gains its places over a database made before there were any, keeping the open design', async () => {
    const factory = new IDBFactory()
    await new Promise<void>((resolve, reject) => {
      const request = factory.open(DATABASE, 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(DESIGNS, { keyPath: 'id' }).put({ id: 'a', name: 'Librero', updatedAt: '', state: named('Librero') })
        request.result.createObjectStore(META).put('a', 'open')
      }
      request.onsuccess = () => (request.result.close(), resolve())
      request.onerror = () => reject(request.error)
    })
    const repo = await start(factory)
    expect(repo.load()).toEqual(named('Librero'))
    expect(await repo.library.saveTo(5, 'Librero')).toBe(true)
  })

  it('offers no places where there is no database', async () => {
    const repo = await createIndexedRepository({ factory: null, storage: storage(), page: null })
    expect(repo.library).toBe(noLibrary)
    expect(repo.library.available).toBe(false)
    repo.save(named('Librero'))
    expect(await repo.library.saveTo(1, 'Librero')).toBe(false)
    expect(repo.library.current()).toEqual({ place: null, saved: false })
  })
})
