import type { DebugAccess } from '../../ports/DebugAccess'

const VISIBLE_KEY = 'knotty:debug:visible'

export function createLocalDebugAccess(flags: Storage | null = typeof localStorage === 'undefined' ? null : localStorage): DebugAccess {
  return {
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

/** Older builds kept a log of every call to the expert in the browser; nothing reads it anymore. */
export function dropOldDebugLog() {
  try {
    indexedDB.deleteDatabase('knotty-debug')
    localStorage.removeItem('knotty:debug:events')
  } catch {
    // Nothing to free.
  }
}
