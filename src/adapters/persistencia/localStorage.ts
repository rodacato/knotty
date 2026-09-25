import { DesignState } from '../../domain/sesion/state'
import type { DesignRepository } from '../../ports/DesignRepository'

const STORAGE_KEY = 'despiece:v1:diseno'

/** If saving exceeds the quota, thumbnails are dropped first, then the oldest in-between versions. */
function reduce(state: DesignState): DesignState | null {
  if (state.miniaturas.length) return { ...state, miniaturas: [] }
  if (state.versiones.length > 3) return { ...state, versiones: [state.versiones[0], ...state.versiones.slice(2)] }
  return null
}

export function createLocalRepository(storage: Storage = localStorage): DesignRepository {
  return {
    load() {
      try {
        const raw = storage.getItem(STORAGE_KEY)
        if (!raw) return null
        const r = DesignState.safeParse(JSON.parse(raw))
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
          /* cuota llena: se intenta con menos */
        }
      }
    },
    clear() {
      try {
        storage.removeItem(STORAGE_KEY)
      } catch {
        /* nada guardado */
      }
    },
  }
}
