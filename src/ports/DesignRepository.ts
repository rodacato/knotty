import type { EstadoDiseno } from '../domain/sesion/estado'

export interface DesignRepository {
  cargar(): EstadoDiseno | null
  guardar(estado: EstadoDiseno): void
  borrar(): void
}
