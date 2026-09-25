import datos from '../../../public/catalogo/catalogo.json'
import { Catalog } from '../materiales/catalog'

export const testCatalog = Catalog.parse(datos)
