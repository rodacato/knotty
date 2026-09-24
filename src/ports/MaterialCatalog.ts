import type { Catalogo } from '../domain/materiales/catalogo'

export interface MaterialCatalog {
  cargar(): Promise<Catalogo>
}
