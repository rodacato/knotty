// The open design in IndexedDB, behind the synchronous port: it is read once into memory when the repository is created, and
// every save answers from memory at once and is written behind, one transaction at a time. localStorage is where the design
// lived before and where it still goes when IndexedDB cannot be used or a write fails; a copy found there is the newer one.

import { migrateState } from '../../domain/session/migrate'
import { currentDesign, DesignState } from '../../domain/session/state'
import type { DesignRepository } from '../../ports/DesignRepository'
import { createLocalRepository, reduce } from './localStorage'

export const DATABASE = 'knotty'
export const DESIGNS = 'designs'
export const META = 'meta'
/** In `meta`: the id of the record in `designs` that is the open design. */
export const OPEN = 'open'
/** How long the database may take to open and give the open design before localStorage is used instead. */
export const OPEN_LIMIT_MS = 5000

export interface StoredDesign {
  id: string
  name: string
  updatedAt: string
  state: DesignState
}

/** `settled` resolves once nothing is waiting to be written; it is the adapter's own, the port does not know it. */
export type IndexedRepository = DesignRepository & { settled(): Promise<void> }

export interface IndexedRepositoryOptions {
  /** null when the browser has no IndexedDB. */
  factory?: IDBFactory | null
  storage?: Storage
  now?: () => string
  newId?: () => string
  openLimitMs?: number
  /** Where `pagehide` and `visibilitychange` arrive; null when there is no page. */
  page?: EventTarget | null
  hidden?: () => boolean
}

function browserFactory(): IDBFactory | null {
  try {
    return globalThis.indexedDB ?? null
  } catch {
    return null
  }
}

function browserPage(): EventTarget | null {
  return typeof window === 'undefined' ? null : window
}

const browserHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

function openWithDesign(factory: IDBFactory, limitMs: number): Promise<{ db: IDBDatabase; record: unknown }> {
  return new Promise((resolve, reject) => {
    let refused = false
    const refuse = (reason: unknown) => {
      refused = true
      clearTimeout(limit)
      reject(reason)
    }
    const limit = setTimeout(() => refuse(new Error('too slow')), limitMs)
    const request = factory.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DESIGNS, { keyPath: 'id' })
      request.result.createObjectStore(META)
    }
    request.onerror = () => refuse(request.error)
    request.onblocked = () => refuse(new Error('blocked'))
    request.onsuccess = () => {
      const db = request.result
      if (refused) return db.close()
      db.onversionchange = () => db.close()
      readOpen(db).then(
        (record) => {
          if (refused) return db.close()
          clearTimeout(limit)
          resolve({ db, record })
        },
        (reason) => {
          db.close()
          refuse(reason)
        },
      )
    }
  })
}

function commit(db: IDBDatabase, mode: IDBTransactionMode, work: (designs: IDBObjectStore, meta: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([DESIGNS, META], mode)
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('aborted'))
    try {
      work(tx.objectStore(DESIGNS), tx.objectStore(META))
    } catch (error) {
      reject(error)
      tx.abort()
    }
  })
}

async function readOpen(db: IDBDatabase): Promise<unknown> {
  let record: unknown
  await commit(db, 'readonly', (designs, meta) => {
    const pointer = meta.get(OPEN)
    pointer.onsuccess = () => {
      if (typeof pointer.result !== 'string') return
      const found = designs.get(pointer.result)
      found.onsuccess = () => (record = found.result)
    }
  })
  return record
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function readState(record: unknown): DesignState | null {
  try {
    if (!isObject(record)) return null
    const r = DesignState.safeParse(migrateState(record.state))
    return r.success ? r.data : null
  } catch {
    return null
  }
}

const isQuota = (error: unknown) => isObject(error) && error.name === 'QuotaExceededError'

export async function createIndexedRepository(options: IndexedRepositoryOptions = {}): Promise<IndexedRepository> {
  const { factory = browserFactory(), storage = localStorage, now = () => new Date().toISOString(), newId = () => crypto.randomUUID(), openLimitMs = OPEN_LIMIT_MS, page = browserPage(), hidden = browserHidden } = options
  const local = createLocalRepository(storage)
  const fallback: IndexedRepository = { ...local, settled: async () => {} }
  if (!factory) return fallback

  const opened = await openWithDesign(factory, openLimitMs).catch(() => null)
  if (!opened) return fallback
  const { db, record } = opened

  let storedId = isObject(record) && typeof record.id === 'string' ? record.id : null
  let id = storedId
  let memory = readState(record)
  let pending: { id: string; state: DesignState } | 'remove' | null = null
  let writing: Promise<void> | null = null
  let copyInStorage = false

  async function put(designId: string, state: DesignState) {
    const replaced = storedId !== designId ? storedId : null
    for (let current: DesignState | null = state; current; current = reduce(current)) {
      const stored: StoredDesign = { id: designId, name: currentDesign(current).name, updatedAt: now(), state: current }
      try {
        await commit(db, 'readwrite', (designs, meta) => {
          if (replaced) designs.delete(replaced)
          designs.put(stored)
          meta.put(designId, OPEN)
        })
        storedId = designId
        return
      } catch (error) {
        if (!isQuota(error)) throw error
      }
    }
    throw new Error('no room')
  }

  async function remove() {
    const removed = storedId
    await commit(db, 'readwrite', (designs, meta) => {
      if (removed) designs.delete(removed)
      meta.delete(OPEN)
    })
    storedId = null
  }

  async function drain() {
    while (pending) {
      const next = pending
      pending = null
      try {
        if (next === 'remove') await remove()
        else await put(next.id, next.state)
        if (copyInStorage && !pending) {
          local.clear()
          copyInStorage = false
        }
      } catch {
        if (next !== 'remove') {
          local.save(next.state)
          copyInStorage = true
        }
      }
    }
    writing = null
  }

  function write(state: DesignState | null) {
    memory = state
    if (state) {
      id ??= newId()
      pending = { id, state }
    } else {
      id = null
      pending = 'remove'
      local.clear()
      copyInStorage = false
    }
    writing ??= drain()
  }

  function keepUncommitted() {
    if (!memory || !(pending || writing)) return
    local.save(memory)
    copyInStorage = true
  }

  page?.addEventListener('pagehide', keepUncommitted)
  page?.addEventListener('visibilitychange', () => hidden() && keepUncommitted())

  const moved = local.load()
  if (moved) {
    copyInStorage = true
    write(moved)
  }

  return {
    load: () => memory,
    save: (state) => write(state),
    clear: () => write(null),
    settled: async () => {
      while (writing) await writing
    },
  }
}
