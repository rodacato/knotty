import { LayoutSettings, Catalog, NO_SETTINGS, type CatalogSettings } from '../../domain/materiales/catalog'
import type { MaterialCatalog } from '../../ports/MaterialCatalog'
import { HARDWARE_IDS_V3 } from '../../domain/sesion/migrate'

const SETTINGS_KEY = 'despiece:v1:catalogo'

/** How the version with Spanish fields saved the person's settings; prices were keyed by the old hardware ids. */
interface SettingsV1 {
  precios?: Record<string, number | null>
  acomodo?: { refilado?: number; sierra?: number; holgura?: number }
}
const layoutV1 = (a: SettingsV1['acomodo']) => (a ? { trim: a.refilado, kerf: a.sierra, clearance: a.holgura } : null)
const pricesV1 = (p: SettingsV1['precios']) => (p && typeof p === 'object' ? Object.fromEntries(Object.entries(p).map(([id, price]) => [HARDWARE_IDS_V3[id] ?? id, price])) : null)

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
        const saved = JSON.parse(storage.getItem(SETTINGS_KEY) ?? 'null') as (Partial<CatalogSettings> & SettingsV1) | null
        const layout = LayoutSettings.safeParse(saved?.layout ?? layoutV1(saved?.acomodo))
        const prices = saved?.prices ?? pricesV1(saved?.precios)
        return { prices: prices && typeof prices === 'object' ? prices : {}, layout: layout.success ? layout.data : null }
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
