import { LayoutSettings, Catalog, NO_SETTINGS, type CatalogSettings } from '../../domain/materiales/catalog'
import type { MaterialCatalog } from '../../ports/MaterialCatalog'

const CLAVE_AJUSTES = 'despiece:v1:catalogo'

export function crearCatalogoJson(url = `${import.meta.env.BASE_URL}catalogo/catalogo.json`, almacen: Storage = localStorage): MaterialCatalog {
  let cargado: Promise<Catalog> | null = null
  return {
    cargar() {
      cargado ??= fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`No se pudo cargar el catálogo (${r.status}).`)
          return r.json()
        })
        .then((datos) => Catalog.parse(datos))
      return cargado
    },
    ajustes() {
      try {
        const guardado = JSON.parse(almacen.getItem(CLAVE_AJUSTES) ?? 'null') as Partial<CatalogSettings> | null
        const acomodo = LayoutSettings.safeParse(guardado?.acomodo)
        return { precios: guardado?.precios && typeof guardado.precios === 'object' ? guardado.precios : {}, acomodo: acomodo.success ? acomodo.data : null }
      } catch {
        return NO_SETTINGS
      }
    },
    guardarAjustes(a) {
      try {
        almacen.setItem(CLAVE_AJUSTES, JSON.stringify(a))
      } catch {
        /* sin almacenamiento: los ajustes duran la sesión */
      }
    },
  }
}
