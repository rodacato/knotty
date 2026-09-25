import { createContext, useContext } from 'react'
import type { Bench } from '../application/bench/bench'
import type { UseCases } from '../application/useCases'
import type { Catalog } from '../domain/materiales/catalog'
import type { DebugLog } from '../ports/DebugLog'
import type { MaterialCatalog } from '../ports/MaterialCatalog'
import type { Preferences } from '../ports/Preferences'
import type { ImageProcessor } from '../ports/ImageProcessor'

export interface Services {
  useCases: UseCases
  catalog: Catalog
  materials: MaterialCatalog
  images: ImageProcessor
  preferences: Preferences
  debug: DebugLog
  /** The hidden test bench: fixed cases against the connected expert, and every module variant. */
  bench: Bench
}

export const ServicesContext = createContext<Services | null>(null)

export function useServices() {
  const s = useContext(ServicesContext)
  if (!s) throw new Error('Faltan los servicios: envuelve la app en ServicesContext.')
  return s
}
