import type { DesignState } from '../domain/sesion/state'

export interface DesignRepository {
  load(): DesignState | null
  save(state: DesignState): void
  clear(): void
}
