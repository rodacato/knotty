import { Catalogo } from '../../domain/materiales/catalogo'
import type { MaterialCatalog } from '../../ports/MaterialCatalog'

export function crearCatalogoJson(url = `${import.meta.env.BASE_URL}catalogo/catalogo.json`): MaterialCatalog {
  let cargado: Promise<Catalogo> | null = null
  return {
    cargar() {
      cargado ??= fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`No se pudo cargar el catálogo (${r.status}).`)
          return r.json()
        })
        .then((datos) => Catalogo.parse(datos))
      return cargado
    },
  }
}
