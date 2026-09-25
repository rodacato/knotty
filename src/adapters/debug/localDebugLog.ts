import type { DebugEvent, DebugLog } from '../../ports/DebugLog'

// Where the log lives. IndexedDB holds full answers for long sessions; localStorage is the fallback, bounded because it is shared with the design.

export interface EventStore {
  load(): Promise<DebugEvent[]>
  append(event: DebugEvent): void
  clear(): void
  /** Keeps only the newest `count` events. */
  keep(count: number): void
}

const MAX_EVENTS = 5_000
const VISIBLE_KEY = 'knotty:debug:visible'

export function createDebugLog(store: EventStore, flags: Storage | null = typeof localStorage === 'undefined' ? null : localStorage): DebugLog {
  let events: DebugEvent[] = []
  // Events recorded before the stored ones finish loading go after them.
  void store.load().then((stored) => {
    events = [...stored, ...events].slice(-MAX_EVENTS)
  })
  return {
    record(event) {
      const full = { at: new Date().toISOString(), ...event }
      events.push(full)
      store.append(full)
      if (events.length > MAX_EVENTS) {
        events = events.slice(-MAX_EVENTS)
        store.keep(MAX_EVENTS)
      }
    },
    events: () => events,
    clear() {
      events = []
      store.clear()
    },
    visible: () => {
      try {
        return flags?.getItem(VISIBLE_KEY) === '1'
      } catch {
        return false
      }
    },
    setVisible(visible) {
      try {
        if (visible) flags?.setItem(VISIBLE_KEY, '1')
        else flags?.removeItem(VISIBLE_KEY)
      } catch {
        // Nothing to do: the toggle simply does not persist.
      }
    },
  }
}

const DB = 'knotty-debug'
const STORE = 'events'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { autoIncrement: true })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function indexedDbStore(): EventStore {
  const db = openDb()
  const run = (mode: IDBTransactionMode, work: (store: IDBObjectStore) => void) =>
    db.then((d) => work(d.transaction(STORE, mode).objectStore(STORE))).catch(() => {
      // A log that cannot be written must never break the app.
    })
  return {
    load: () =>
      db
        .then(
          (d) =>
            new Promise<DebugEvent[]>((resolve) => {
              const request = d.transaction(STORE, 'readonly').objectStore(STORE).getAll()
              request.onsuccess = () => resolve(request.result as DebugEvent[])
              request.onerror = () => resolve([])
            }),
        )
        .catch(() => []),
    append: (event) => void run('readwrite', (s) => s.add(JSON.parse(JSON.stringify(event)))),
    clear: () => void run('readwrite', (s) => s.clear()),
    keep: (count) =>
      void run('readwrite', (s) => {
        const keys = s.getAllKeys()
        keys.onsuccess = () => keys.result.slice(0, Math.max(0, keys.result.length - count)).forEach((k) => s.delete(k))
      }),
  }
}

const KEY = 'knotty:debug:events'
/** localStorage is shared with the saved design: the fallback stays well under its limit. */
const MAX_BYTES = 1_500_000
const MAX_EVENT_BYTES = 60_000

const size = (value: unknown) => {
  try {
    return JSON.stringify(value).length
  } catch {
    return Infinity
  }
}

/** In the small fallback, each event's detail is bounded; long strings are cut, not dropped. */
function bounded(event: DebugEvent): DebugEvent {
  if (size(event) <= MAX_EVENT_BYTES) return event
  const cut = JSON.stringify(event.data, (_, v) => (typeof v === 'string' && v.length > 4_000 ? `${v.slice(0, 4_000)}… [${v.length.toLocaleString('es-MX')} caracteres]` : v))
  const data = cut && cut.length <= MAX_EVENT_BYTES ? JSON.parse(cut) : `[detalle de ${size(event.data).toLocaleString('es-MX')} caracteres, recortado]`
  return { ...event, data }
}

export function localStorageStore(storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage): EventStore {
  let events: DebugEvent[] = []
  try {
    events = JSON.parse(storage?.getItem(KEY) ?? '[]')
  } catch {
    events = []
  }
  const save = () => {
    while (events.length > 1 && size(events) > MAX_BYTES) events = events.slice(Math.ceil(events.length / 10))
    try {
      storage?.setItem(KEY, JSON.stringify(events))
    } catch {
      // A full storage must never break the app: the log just stays in memory.
    }
  }
  return {
    load: async () => events,
    append(event) {
      events.push(bounded(event))
      save()
    },
    clear() {
      events = []
      save()
    },
    keep(count) {
      events = events.slice(-count)
      save()
    },
  }
}

/** IndexedDB when the browser has it; some private modes do not. */
export function createLocalDebugLog() {
  if (typeof indexedDB === 'undefined') return createDebugLog(localStorageStore())
  try {
    // An older build kept the log in localStorage; that space belongs to the design.
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to free.
  }
  return createDebugLog(indexedDbStore())
}
