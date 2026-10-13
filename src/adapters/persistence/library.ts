// The places where the person keeps designs, in the same database as the open one. A place is two records, so showing
// the five never loads a whole session: what the list draws in `places`, the session itself in `placeStates`.

import { migrateState } from '../../domain/session/migrate'
import { currentDesign, DesignState } from '../../domain/session/state'
import { LIBRARY_PLACES, type DesignLibrary, type SavedDesign } from '../../ports/DesignLibrary'

export const PLACES = 'places'
export const PLACE_STATES = 'placeStates'
/** In `meta`: which place the open design belongs to and whether that place holds it as it is. */
export const OPEN_PLACE = 'openPlace'

type Current = { place: number | null; saved: boolean }
const NOWHERE: Current = { place: null, saved: false }

const EMPTY = (): (SavedDesign | null)[] => Array.from({ length: LIBRARY_PLACES }, () => null)

/** Where there is no database: nothing can be kept beside the open design. */
export const noLibrary: DesignLibrary = {
  available: false,
  places: EMPTY,
  current: () => NOWHERE,
  detach: () => {},
  saveTo: async () => false,
  rename: () => {},
  remove: () => {},
  read: async () => null,
  open: async () => null,
}

export function createPlaceStores(db: IDBDatabase) {
  for (const name of [PLACES, PLACE_STATES]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
}

function transact<T>(db: IDBDatabase, mode: IDBTransactionMode, work: (store: (name: string) => IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PLACES, PLACE_STATES, 'meta'], mode)
    let request: IDBRequest<T> | void
    tx.oncomplete = () => resolve(request ? request.result : undefined)
    tx.onabort = () => reject(tx.error ?? new Error('aborted'))
    try {
      request = work((name) => tx.objectStore(name))
    } catch (error) {
      reject(error)
      tx.abort()
    }
  })
}

const isPlace = (place: number) => Number.isInteger(place) && place >= 1 && place <= LIBRARY_PLACES
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function readSummary(raw: unknown): SavedDesign | null {
  if (!isObject(raw) || typeof raw.place !== 'number' || !isPlace(raw.place) || typeof raw.name !== 'string' || typeof raw.savedAt !== 'string' || !isObject(raw.design)) return null
  return raw as unknown as SavedDesign
}

/** What the library needs of the open design: reading it and putting another in its place. */
export interface OpenDesign {
  state(): DesignState | null
  replace(state: DesignState): void
}

/** `changed` and `closed` are for the repository of the open design to say that it was saved again or thrown away. */
export type IndexedLibrary = DesignLibrary & { changed(state: DesignState): void; closed(): void; settled(): Promise<void> }

export async function createIndexedLibrary(db: IDBDatabase, open: OpenDesign, now: () => string): Promise<IndexedLibrary> {
  const places = EMPTY()
  let current: Current = NOWHERE
  /** The session the open design's place holds, by identity: any other object is a change. */
  let kept: DesignState | null = null
  let queue: Promise<unknown> = Promise.resolve()

  await transact(db, 'readonly', (store) => {
    const all = store(PLACES).getAll()
    all.onsuccess = () => {
      for (const summary of all.result.map(readSummary)) if (summary) places[summary.place - 1] = summary
    }
    const pointer = store('meta').get(OPEN_PLACE)
    pointer.onsuccess = () => {
      const raw: unknown = pointer.result
      if (isObject(raw) && typeof raw.place === 'number' && isPlace(raw.place)) current = { place: raw.place, saved: raw.saved === true }
    }
  })
  if (current.place !== null && !places[current.place - 1]) current = NOWHERE
  if (current.saved) kept = open.state()

  const later = <T>(work: () => Promise<T>): Promise<T> => {
    const done = queue.then(work)
    queue = done.catch(() => undefined)
    return done
  }
  let pointing = false
  /** Only where it points last is written: a page that goes away must not be left with a step in between. */
  const point = (next: Current, state: DesignState | null) => {
    current = next
    kept = next.saved ? state : null
    if (pointing) return
    pointing = true
    void later(() => {
      pointing = false
      const last = current
      return transact(db, 'readwrite', (store) => void store('meta').put(last, OPEN_PLACE))
    }).catch(() => undefined)
  }

  async function read(place: number): Promise<DesignState | null> {
    if (!isPlace(place)) return null
    try {
      const raw = await later(() => transact<unknown>(db, 'readonly', (store) => store(PLACE_STATES).get(place)))
      const parsed = DesignState.safeParse(migrateState(raw))
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  }

  return {
    available: true,
    places: () => [...places],
    current: () => current,
    detach: () => current.place !== null && point(NOWHERE, null),
    changed: (state) => current.saved && state !== kept && point({ place: current.place, saved: false }, null),
    closed: () => current.place !== null && point(NOWHERE, null),

    async saveTo(place, name) {
      const state = open.state()
      if (!state || !isPlace(place)) return false
      const summary: SavedDesign = { place, name, savedAt: now(), design: currentDesign(state) }
      const next: Current = { place, saved: true }
      try {
        await later(() =>
          transact(db, 'readwrite', (store) => {
            store(PLACES).put(summary, place)
            store(PLACE_STATES).put(state, place)
            store('meta').put(next, OPEN_PLACE)
          }),
        )
      } catch {
        return false
      }
      places[place - 1] = summary
      current = next
      kept = open.state() === state ? state : null
      if (!kept) point({ place, saved: false }, null)
      return true
    },

    rename(place, name) {
      const summary = places[place - 1]
      if (!summary) return
      const renamed = { ...summary, name }
      places[place - 1] = renamed
      void later(() => transact(db, 'readwrite', (store) => void store(PLACES).put(renamed, place))).catch(() => undefined)
    },

    remove(place) {
      if (!isPlace(place)) return
      places[place - 1] = null
      if (current.place === place) point(NOWHERE, null)
      void later(() =>
        transact(db, 'readwrite', (store) => {
          store(PLACES).delete(place)
          store(PLACE_STATES).delete(place)
        }),
      ).catch(() => undefined)
    },

    read,

    async open(place) {
      const state = await read(place)
      if (!state) return null
      point({ place, saved: true }, state)
      open.replace(state)
      return state
    },

    settled: async () => void (await queue),
  }
}
