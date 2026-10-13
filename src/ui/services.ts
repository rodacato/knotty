import { createContext, useContext } from 'react'
import type { UseCases } from '../application/useCases'
import type { Catalog } from '../domain/materials/catalog'
import type { DebugAccess } from '../ports/DebugAccess'
import type { MaterialCatalog } from '../ports/MaterialCatalog'
import type { Preferences } from '../ports/Preferences'
import type { ReferenceStore } from '../ports/ReferenceStore'
import type { ImageProcessor } from '../ports/ImageProcessor'
import type { DesignFileCodec } from '../ports/DesignFileCodec'
import type { DesignLibrary } from '../ports/DesignLibrary'

export interface Services {
  useCases: UseCases
  catalog: Catalog
  materials: MaterialCatalog
  images: ImageProcessor
  /** The open design as a `.knotty` file, out and back in. */
  files: DesignFileCodec
  /** «Mis muebles»: the places where the person keeps designs. */
  library: DesignLibrary
  /** The furniture of reference: the home screen's starting points come from here. */
  references: ReferenceStore
  preferences: Preferences
  debug: DebugAccess
}

export const ServicesContext = createContext<Services | null>(null)

export function useServices() {
  const s = useContext(ServicesContext)
  if (!s) throw new Error('Missing services: wrap the app in ServicesContext.')
  return s
}
