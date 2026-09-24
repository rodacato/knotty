import type { Diseno } from './diseno/esquema'
import { resolver, type Geometria } from './diseno/resolver'
import type { Hallazgo } from './estructura/hallazgo'
import { revisarEstructura } from './estructura/motor'
import type { Catalogo } from './materiales/catalogo'
import { verificarRequisitos, type Requisito } from './requisitos/requisitos'
import type { Contacto } from './validacion/contacto'
import type { AvisoDiseno, ErrorDiseno } from './validacion/errores'
import { validarGeometria } from './validacion/geometria'

export type Analisis =
  | { valido: true; geo: Geometria; contactos: Contacto[]; avisos: AvisoDiseno[]; hallazgos: Hallazgo[] }
  | { valido: false; errores: ErrorDiseno[] }

/** Todo lo que hay que saber de un diseño antes de mostrarlo: geometría, requisitos y estructura. */
export function analizar(diseno: Diseno, catalogo: Catalogo, requisitos: Requisito[] = []): Analisis {
  const resuelto = resolver(diseno, catalogo)
  if (!resuelto.ok) return { valido: false, errores: resuelto.errores }
  const geo = resuelto.valor
  const { errores, avisos, contactos } = validarGeometria(diseno, geo, catalogo)
  errores.push(...verificarRequisitos(diseno, requisitos))
  if (errores.length) return { valido: false, errores }
  return { valido: true, geo, contactos, avisos, hallazgos: revisarEstructura({ diseno, geo, catalogo, contactos }) }
}
