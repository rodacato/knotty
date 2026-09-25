import type { Diseno } from './diseno/esquema'
import { resolveGeometry, type Geometry } from './diseno/resolve'
import type { Finding } from './structure/finding'
import { reviewStructure } from './structure/review'
import type { Catalog } from './materiales/catalog'
import { verificarRequisitos, type Requisito } from './requisitos/requisitos'
import type { Contact } from './validation/contact'
import type { DesignWarning, DesignError } from './validation/errors'
import { validateGeometry } from './validation/geometry'

export type Analisis =
  | { valido: true; geo: Geometry; contactos: Contact[]; avisos: DesignWarning[]; hallazgos: Finding[] }
  /** `geo` when the pieces still resolve: an invalid design can be drawn with its problems marked. */
  | { valido: false; errores: DesignError[]; geo?: Geometry }

/** Todo lo que hay que saber de un diseño antes de mostrarlo: geometría, requisitos y estructura. */
export function analizar(diseno: Diseno, catalogo: Catalog, requisitos: Requisito[] = []): Analisis {
  const resuelto = resolveGeometry(diseno, catalogo)
  if (!resuelto.ok) return { valido: false, errores: resuelto.errors }
  const geo = resuelto.value
  const { errors: errores, warnings: avisos, contacts: contactos } = validateGeometry(diseno, geo, catalogo)
  errores.push(...verificarRequisitos(diseno, requisitos))
  if (errores.length) return { valido: false, errores, geo }
  return { valido: true, geo, contactos, avisos, hallazgos: reviewStructure({ design: diseno, geo, catalog: catalogo, contacts: contactos }) }
}
