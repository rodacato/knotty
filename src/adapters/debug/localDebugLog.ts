import type { DebugEvent, DebugLog } from '../../ports/DebugLog'

const KEY = 'knotty:debug:events'
const VISIBLE_KEY = 'knotty:debug:visible'
/** localStorage is shared with the saved design: the log keeps well under its limit. */
const MAX_BYTES = 1_500_000
const MAX_EVENT_BYTES = 60_000

const size = (value: unknown) => {
  try {
    return JSON.stringify(value).length
  } catch {
    return Infinity
  }
}

/** Keeps each event's detail bounded; long strings (like images) are cut, not dropped. */
function bounded(event: DebugEvent): DebugEvent {
  if (size(event) <= MAX_EVENT_BYTES) return event
  const cut = JSON.stringify(event.data, (_, v) => (typeof v === 'string' && v.length > 4_000 ? `${v.slice(0, 4_000)}… [${v.length.toLocaleString('es-MX')} caracteres]` : v))
  const data = cut && cut.length <= MAX_EVENT_BYTES ? JSON.parse(cut) : `[detalle de ${size(event.data).toLocaleString('es-MX')} caracteres, recortado]`
  return { ...event, data }
}

export function createLocalDebugLog(storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage): DebugLog {
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
    record(event) {
      events.push(bounded({ at: new Date().toISOString(), ...event }))
      save()
    },
    events: () => events,
    clear() {
      events = []
      save()
    },
    visible: () => {
      try {
        return storage?.getItem(VISIBLE_KEY) === '1'
      } catch {
        return false
      }
    },
    setVisible(visible) {
      try {
        if (visible) storage?.setItem(VISIBLE_KEY, '1')
        else storage?.removeItem(VISIBLE_KEY)
      } catch {
        // Nothing to do: the toggle simply does not persist.
      }
    },
  }
}
