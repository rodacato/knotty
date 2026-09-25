import type { Diseno } from './diseno/esquema'
import { resolver, type Geometria } from './diseno/resolver'
import type { Hallazgo } from './estructura/hallazgo'
import { revisarEstructura } from './estructura/motor'
import type { Catalogo } from './materiales/catalogo'
import { verificarRequisitos, type Requisito } from './requisitos/requisitos'
import type { Contact } from './validation/contact'
import type { DesignWarning, DesignError } from './validation/errors'
import { validateGeometry } from './validation/geometry'

export type Analisis =
  | { valido: true; geo: Geometria; contactos: Contact[]; avisos: DesignWarning[]; hallazgos: Hallazgo[] }
  /** `geo` when the pieces still resolve: an invalid design can be drawn with its problems marked. */
  | { valido: false; errores: DesignError[]; geo?: Geometria }

/** Todo lo que hay que saber de un diseño antes de mostrarlo: geometría, requisitos y estructura. */
export function analizar(diseno: Diseno, catalogo: Catalogo, requisitos: Requisito[] = []): Analisis {
  const resuelto = resolver(diseno, catalogo)
  if (!resuelto.ok) return { valido: false, errores: resuelto.errores }
  const geo = resuelto.valor
  const { errors: errores, warnings: avisos, contacts: contactos } = validateGeometry(diseno, geo, catalogo)
  errores.push(...verificarRequisitos(diseno, requisitos))
  if (errores.length) return { valido: false, errores, geo }
  return { valido: true, geo, contactos, avisos, hallazgos: revisarEstructura({ diseno, geo, catalogo, contactos }) }
}
