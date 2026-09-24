import { EJES, type Eje } from '../diseno/esquema'
import type { Caja } from '../diseno/resolver'

export const TOLERANCIA_CONTACTO = 0.5

export interface Contacto {
  a: string
  b: string
  /** Eje en el que se tocan las caras; null si se enciman. */
  eje: Eje | null
  /** El menor de los traslapes por eje: cuánto se enciman (0 si solo se tocan). */
  profundidad: number
}

const traslape = (a: Caja, b: Caja, eje: Eje) => Math.min(a[`${eje}1`], b[`${eje}1`]) - Math.max(a[`${eje}0`], b[`${eje}0`])

export function contactoEntre(idA: string, a: Caja, idB: string, b: Caja): Contacto | null {
  const t = EJES.map((e) => traslape(a, b, e))
  if (t.every((v) => v > TOLERANCIA_CONTACTO)) return { a: idA, b: idB, eje: null, profundidad: Math.min(...t) }
  const tocando = EJES.findIndex((_, i) => Math.abs(t[i]) <= TOLERANCIA_CONTACTO && t.every((v, j) => j === i || v > TOLERANCIA_CONTACTO))
  return tocando < 0 ? null : { a: idA, b: idB, eje: EJES[tocando], profundidad: 0 }
}

export function contactos(cajas: Map<string, Caja>): Contacto[] {
  const lista = [...cajas]
  const encontrados: Contacto[] = []
  for (let i = 0; i < lista.length; i++)
    for (let j = i + 1; j < lista.length; j++) {
      const c = contactoEntre(lista[i][0], lista[i][1], lista[j][0], lista[j][1])
      if (c) encontrados.push(c)
    }
  return encontrados
}

export const mismoPar = (c: { a: string; b: string }, a: string, b: string) => (c.a === a && c.b === b) || (c.a === b && c.b === a)
