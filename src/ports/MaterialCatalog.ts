import type { AjustesCatalogo, Catalogo } from '../domain/materiales/catalogo'

export interface MaterialCatalog {
  cargar(): Promise<Catalogo>
  ajustes(): AjustesCatalogo
  guardarAjustes(a: AjustesCatalogo): void
}
