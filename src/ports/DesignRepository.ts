import type { DesignState } from '../domain/sesion/state'

export interface DesignRepository {
  cargar(): DesignState | null
  guardar(estado: DesignState): void
  borrar(): void
}
