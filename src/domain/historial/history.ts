import { z } from 'zod'
import { Design } from '../diseno/schema'
import { FurniturePlan } from '../modules/plan'
import { Operation } from '../operaciones/schema'

export const Origin = z.object({ promptId: z.string(), proveedor: z.string(), modelo: z.string() })
export type Origin = z.infer<typeof Origin>

export const Decision = z.object({
  tema: z.string().min(1).describe('Clave corta: "trasera", "espesor-entrepanos"'),
  texto: z.string().min(1).describe('La decisión y su porqué, en una línea'),
})
export type Decision = z.infer<typeof Decision>

export const Version = z.object({
  n: z.number().int().positive(),
  diseno: Design,
  resumen: z.string(),
  motivo: z.string(),
  operaciones: z.array(z.string()),
  fecha: z.string(),
  origen: Origin.nullable(),
  /** Las decisiones de diseño viajan con la versión: volver a una versión las restaura. */
  decisiones: z.array(Decision).default([]),
  /** The plan this version was built from, when it was; later free-form changes leave it null. */
  plan: FurniturePlan.nullable().default(null),
  /** Free-form changes made on top of the plan, replayed every time the plan is rebuilt. */
  extras: z.array(Operation).default([]),
})
export type Version = z.infer<typeof Version>

const LIMITS = { full: 8, summarized: 30, versions: 40, decisions: 15 }

export function abbreviate(op: Operation): string {
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

/** The log the expert sees: recent changes in full, older ones in a line, the oldest only counted; what matters already lives in decisions and requirements. */
export function compactLog(versions: Version[]): string[] {
  const ordered = [...versions].sort((a, b) => b.n - a.n)
  const full = ordered.slice(0, LIMITS.full).map((v) => `v${v.n}: ${v.resumen} — pedido: "${v.motivo}" — ${v.operaciones.join('; ') || 'sin operaciones'}`)
  const summarized = ordered.slice(LIMITS.full, LIMITS.summarized).map((v) => `v${v.n}: ${v.resumen}`)
  const rest = ordered.length - LIMITS.summarized
  return [...full, ...summarized, ...(rest > 0 ? [`(${rest} cambios anteriores)`] : [])].reverse()
}

/** A new decision on a topic replaces the previous one; the most recent are kept. */
export function updateDecisions(current: Decision[], added: Decision[]): Decision[] {
  const topics = new Set(added.map((d) => d.tema))
  return [...current.filter((d) => !topics.has(d.tema)), ...added].slice(-LIMITS.decisions)
}

/** The first version and the most recent ones are kept. */
export function pruneVersions(versions: Version[]): Version[] {
  if (versions.length <= LIMITS.versions) return versions
  const [first, ...rest] = versions
  return [first, ...rest.slice(-(LIMITS.versions - 1))]
}
