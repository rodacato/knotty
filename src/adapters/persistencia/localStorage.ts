import { EstadoDiseno } from '../../domain/sesion/estado'
import type { DesignRepository } from '../../ports/DesignRepository'

const CLAVE = 'despiece:v1:diseno'

/** Si el guardado excede la cuota, se sueltan primero las miniaturas y luego las versiones intermedias más viejas. */
function reducir(estado: EstadoDiseno): EstadoDiseno | null {
  if (estado.miniaturas.length) return { ...estado, miniaturas: [] }
  if (estado.versiones.length > 3) return { ...estado, versiones: [estado.versiones[0], ...estado.versiones.slice(2)] }
  return null
}

export function crearRepositorioLocal(almacen: Storage = localStorage): DesignRepository {
  return {
    cargar() {
      try {
        const crudo = almacen.getItem(CLAVE)
        if (!crudo) return null
        const r = EstadoDiseno.safeParse(JSON.parse(crudo))
        return r.success ? r.data : null
      } catch {
        return null
      }
    },
    guardar(estado) {
      for (let actual: EstadoDiseno | null = estado; actual; actual = reducir(actual)) {
        try {
          almacen.setItem(CLAVE, JSON.stringify(actual))
          return
        } catch {
          /* cuota llena: se intenta con menos */
        }
      }
    },
    borrar() {
      try {
        almacen.removeItem(CLAVE)
      } catch {
        /* nada guardado */
      }
    },
  }
}
