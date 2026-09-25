import { migrateState } from '../../domain/session/migrate'
import { DesignState } from '../../domain/session/state'
import type { DesignRepository } from '../../ports/DesignRepository'
import { KEYS, readStored, removeStored } from '../storedKey'

const [STORAGE_KEY, OLDER_KEY] = KEYS.design

/** If saving exceeds the quota, thumbnails are dropped first, then the oldest in-between versions. */
function reduce(state: DesignState): DesignState | null {
  if (state.thumbnails.length) return { ...state, thumbnails: [] }
  if (state.versions.length > 3) return { ...state, versions: [state.versions[0], ...state.versions.slice(2)] }
  return null
}

export function createLocalRepository(storage: Storage = localStorage): DesignRepository {
  return {
    load() {
      try {
        const raw = readStored(storage, STORAGE_KEY, OLDER_KEY)
        if (!raw) return null
        const r = DesignState.safeParse(migrateState(JSON.parse(raw)))
        return r.success ? r.data : null
      } catch {
        return null
      }
    },
    save(state) {
      for (let current: DesignState | null = state; current; current = reduce(current)) {
        try {
          storage.setItem(STORAGE_KEY, JSON.stringify(current))
          return
        } catch {
          /* quota full: try again with less */
        }
      }
    },
    clear() {
      try {
        removeStored(storage, STORAGE_KEY, OLDER_KEY)
      } catch {
        /* nothing stored */
      }
    },
  }
}
