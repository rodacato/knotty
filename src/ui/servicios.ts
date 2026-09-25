import { createContext, useContext } from 'react'
import type { Bench } from '../application/bench/bench'
import type { UseCases } from '../application/useCases'
import type { Catalog } from '../domain/materiales/catalog'
import type { DebugLog } from '../ports/DebugLog'
import type { MaterialCatalog } from '../ports/MaterialCatalog'
import type { Preferences } from '../ports/Preferences'
import type { ImageProcessor } from '../ports/ImageProcessor'

export interface Servicios {
  casos: UseCases
  catalogo: Catalog
  materiales: MaterialCatalog
  imagenes: ImageProcessor
  preferencias: Preferences
  debug: DebugLog
  /** The hidden test bench: fixed cases against the connected expert, and every module variant. */
  bench: Bench
}

export const ContextoServicios = createContext<Servicios | null>(null)

export function useServicios() {
  const s = useContext(ContextoServicios)
  if (!s) throw new Error('Faltan los servicios: envuelve la app en ContextoServicios.')
  return s
}
