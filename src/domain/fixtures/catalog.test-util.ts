import datos from '../../../public/catalog/catalog.json'
import { Catalog } from '../materials/catalog'

export const testCatalog = Catalog.parse(datos)
