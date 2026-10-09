import type { DesignState } from '../domain/session/state'

export interface DesignRepository {
  load(): DesignState | null
  save(state: DesignState): void
  clear(): void
}
