import type { CatalogSettings, Catalog } from '../domain/materiales/catalog'

export interface MaterialCatalog {
  load(): Promise<Catalog>
  settings(): CatalogSettings
  saveSettings(a: CatalogSettings): void
}
