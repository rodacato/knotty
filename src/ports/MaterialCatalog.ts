import type { CatalogSettings, Catalog } from '../domain/materiales/catalog'

export interface MaterialCatalog {
  cargar(): Promise<Catalog>
  ajustes(): CatalogSettings
  guardarAjustes(a: CatalogSettings): void
}
