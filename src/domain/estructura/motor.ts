import { claveHallazgo, type Contexto, type Hallazgo, type Regla } from './hallazgo'
import { reglaCajones } from './reglas/cajones'
import { reglaEscuadrado } from './reglas/escuadrado'
import { reglaFlecha } from './reglas/flecha'
import { reglaTornillos } from './reglas/tornillos'
import { reglaEspesorUnion } from './reglas/uniones'
import { reglaBase, reglaPuertas, reglaVeta, reglaVuelco } from './reglas/uso'
import { typologyRule } from '../typology/typology'

const REGLAS: Regla[] = [reglaFlecha, reglaEspesorUnion, reglaTornillos, reglaVuelco, reglaEscuadrado, reglaPuertas, reglaBase, reglaVeta, reglaCajones, typologyRule]
const ORDEN = { critico: 0, recomendacion: 1, detalle: 2 }

export const revisarEstructura = (ctx: Contexto): Hallazgo[] => REGLAS.flatMap((r) => r(ctx)).sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad])

/** Los críticos que aparecen con un cambio: los que ya estaban no frenan un ajuste nuevo. */
export function criticosNuevos(antes: Hallazgo[], despues: Hallazgo[]) {
  const previos = new Set(antes.filter((h) => h.severidad === 'critico').map(claveHallazgo))
  return despues.filter((h) => h.severidad === 'critico' && !previos.has(claveHallazgo(h)))
}
