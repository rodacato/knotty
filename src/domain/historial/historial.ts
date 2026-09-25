import { z } from 'zod'
import { Diseno } from '../diseno/esquema'
import { CabinetPlan } from '../modules/cabinet'
import type { Operacion } from '../operaciones/esquema'

export const Origen = z.object({ promptId: z.string(), proveedor: z.string(), modelo: z.string() })
export type Origen = z.infer<typeof Origen>

export const Decision = z.object({
  tema: z.string().min(1).describe('Clave corta: "trasera", "espesor-entrepanos"'),
  texto: z.string().min(1).describe('La decisión y su porqué, en una línea'),
})
export type Decision = z.infer<typeof Decision>

export const Version = z.object({
  n: z.number().int().positive(),
  diseno: Diseno,
  resumen: z.string(),
  motivo: z.string(),
  operaciones: z.array(z.string()),
  fecha: z.string(),
  origen: Origen.nullable(),
  /** Las decisiones de diseño viajan con la versión: volver a una versión las restaura. */
  decisiones: z.array(Decision).default([]),
  /** The plan this version was built from, when it was; later free-form changes leave it null. */
  plan: CabinetPlan.nullable().default(null),
})
export type Version = z.infer<typeof Version>

const LIMITES = { completas: 8, resumidas: 30, versiones: 40, decisiones: 15 }

export function abreviar(op: Operacion): string {
  switch (op.op) {
    case 'agregarPieza':
      return `+${op.pieza.id}`
    case 'eliminarPieza':
      return `-${op.id}`
    case 'eliminarGrupo':
      return `-grupo ${op.grupo}`
    case 'duplicarPieza':
      return `${op.id}→${op.nuevoId}`
    case 'redimensionar':
      return `${op.id}.${op.eje} ${op.extremo}`
    case 'mover':
      return `mover ${op.id}.${op.eje}`
    case 'distribuir':
      return `repartir ${op.ids.length} en ${op.eje}`
    case 'cambiarEspesor':
      return `${op.ids.join(',')}→${op.material}`
    case 'cambiarPropiedades':
      return `props ${op.id}`
    case 'agregarUnion':
      return `+unión ${op.union.id}`
    case 'cambiarUnion':
      return `unión ${op.union.id}→${op.union.tipo}`
    case 'eliminarUnion':
      return `-unión ${op.id}`
    case 'cambiarDimensionGlobal':
      return `${op.eje}→${op.valor} ${op.regla}`
    case 'cambiarAnclajeMuro':
      return `anclaje ${op.valor ? 'sí' : 'no'}`
    case 'agregarCajon':
      return `+cajón ${op.grupo}`
  }
}

/** La bitácora que ve el LLM: reciente con detalle, media en una línea y lo viejo solo contado; lo importante ya vive en decisiones y requisitos. */
export function bitacoraCompacta(versiones: Version[]): string[] {
  const orden = [...versiones].sort((a, b) => b.n - a.n)
  const completas = orden.slice(0, LIMITES.completas).map((v) => `v${v.n}: ${v.resumen} — pedido: "${v.motivo}" — ${v.operaciones.join('; ') || 'sin operaciones'}`)
  const resumidas = orden.slice(LIMITES.completas, LIMITES.resumidas).map((v) => `v${v.n}: ${v.resumen}`)
  const restantes = orden.length - LIMITES.resumidas
  return [...completas, ...resumidas, ...(restantes > 0 ? [`(${restantes} cambios anteriores)`] : [])].reverse()
}

/** La decisión nueva de un tema reemplaza a la anterior; se conservan las más recientes. */
export function actualizarDecisiones(actuales: Decision[], nuevas: Decision[]): Decision[] {
  const temas = new Set(nuevas.map((d) => d.tema))
  return [...actuales.filter((d) => !temas.has(d.tema)), ...nuevas].slice(-LIMITES.decisiones)
}

/** Se conserva la primera versión y las más recientes. */
export function podarVersiones(versiones: Version[]): Version[] {
  if (versiones.length <= LIMITES.versiones) return versiones
  const [primera, ...resto] = versiones
  return [primera, ...resto.slice(-(LIMITES.versiones - 1))]
}
