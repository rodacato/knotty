import type { Diseno } from './esquema'
import type { Caja } from './resolver'

export interface Diferencias {
  agregadas: string[]
  eliminadas: string[]
  modificadas: string[]
}

const PROPIEDADES = ['nombre', 'rol', 'material', 'veta', 'carga', 'apoyo', 'grupo'] as const
const cajaCambio = (a: Caja, b: Caja) => (Object.keys(a) as (keyof Caja)[]).some((k) => Math.abs(a[k] - b[k]) > 0.05)

/** Qué piezas cambiaron entre dos versiones, incluidas las que solo se recorrieron por propagación. */
export function diferencias(antes: Diseno, cajasAntes: Map<string, Caja>, despues: Diseno, cajasDespues: Map<string, Caja>): Diferencias {
  const previas = new Map(antes.piezas.map((p) => [p.id, p]))
  const nuevas = new Map(despues.piezas.map((p) => [p.id, p]))
  return {
    agregadas: [...nuevas.keys()].filter((id) => !previas.has(id)),
    eliminadas: [...previas.keys()].filter((id) => !nuevas.has(id)),
    modificadas: [...nuevas.keys()].filter((id) => {
      const a = previas.get(id)
      const b = nuevas.get(id)!
      if (!a) return false
      const ca = cajasAntes.get(id)
      const cb = cajasDespues.get(id)
      return PROPIEDADES.some((k) => a[k] !== b[k]) || (!!ca && !!cb && cajaCambio(ca, cb))
    }),
  }
}

export const hayDiferencias = (d: Diferencias) => d.agregadas.length + d.eliminadas.length + d.modificadas.length > 0
