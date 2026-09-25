import { LayoutSettings, Catalog, NO_SETTINGS, type CatalogSettings } from '../../domain/materiales/catalog'
import type { MaterialCatalog } from '../../ports/MaterialCatalog'

const SETTINGS_KEY = 'despiece:v1:catalogo'

export function createJsonCatalog(url = `${import.meta.env.BASE_URL}catalogo/catalogo.json`, storage: Storage = localStorage): MaterialCatalog {
  let loaded: Promise<Catalog> | null = null
  return {
    load() {
      loaded ??= fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`No se pudo cargar el catálogo (${r.status}).`)
          return r.json()
        })
        .then((data) => Catalog.parse(data))
      return loaded
    },
    settings() {
      try {
        const saved = JSON.parse(storage.getItem(SETTINGS_KEY) ?? 'null') as Partial<CatalogSettings> | null
        const layout = LayoutSettings.safeParse(saved?.acomodo)
        return { precios: saved?.precios && typeof saved.precios === 'object' ? saved.precios : {}, acomodo: layout.success ? layout.data : null }
      } catch {
        return NO_SETTINGS
      }
    },
    saveSettings(a) {
      try {
        storage.setItem(SETTINGS_KEY, JSON.stringify(a))
      } catch {
        /* sin almacenamiento: los ajustes duran la sesión */
      }
    },
  }
}
