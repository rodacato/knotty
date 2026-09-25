import { createContext, useContext } from 'react'
import type { CasosDeUso } from '../application/casosDeUso'
import type { Catalogo } from '../domain/materiales/catalogo'
import type { DebugLog } from '../ports/DebugLog'
import type { MaterialCatalog } from '../ports/MaterialCatalog'
import type { Preferencias } from '../ports/Preferencias'
import type { ProcesadorImagen } from '../ports/ProcesadorImagen'

export interface Servicios {
  casos: CasosDeUso
  catalogo: Catalogo
  materiales: MaterialCatalog
  imagenes: ProcesadorImagen
  preferencias: Preferencias
  debug: DebugLog
}

export const ContextoServicios = createContext<Servicios | null>(null)

export function useServicios() {
  const s = useContext(ContextoServicios)
  if (!s) throw new Error('Faltan los servicios: envuelve la app en ContextoServicios.')
  return s
}
