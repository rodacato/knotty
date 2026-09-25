import { z } from 'zod'
import { Design } from '../diseno/schema'
import { FurniturePlan } from '../modules/plan'
import { Operation } from '../operaciones/schema'

export const Origin = z.object({ promptId: z.string(), provider: z.string(), model: z.string() })
export type Origin = z.infer<typeof Origin>

export const Decision = z.object({
  topic: z.string().min(1).describe('Short key: "trasera", "espesor-entrepanos"'),
  text: z.string().min(1).describe('The decision and its reason, in one line, in Spanish'),
})
export type Decision = z.infer<typeof Decision>

export const Version = z.object({
  n: z.number().int().positive(),
  design: Design,
  summary: z.string(),
  reason: z.string(),
  operations: z.array(z.string()),
  date: z.string(),
  origin: Origin.nullable(),
  /** Las decisiones de diseño viajan con la versión: volver a una versión las restaura. */
  decisions: z.array(Decision).default([]),
  /** The plan this version was built from, when it was; later free-form changes leave it null. */
  plan: FurniturePlan.nullable().default(null),
  /** Free-form changes made on top of the plan, replayed every time the plan is rebuilt. */
  extras: z.array(Operation).default([]),
})
export type Version = z.infer<typeof Version>

const LIMITS = { full: 8, summarized: 30, versions: 40, decisions: 15 }

export function abbreviate(op: Operation): string {
  switch (op.op) {
    case 'addPiece':
      return `+${op.piece.id}`
    case 'removePiece':
      return `-${op.id}`
    case 'removeGroup':
      return `-grupo ${op.group}`
    case 'duplicatePiece':
      return `${op.id}→${op.newId}`
    case 'resize':
      return `${op.id}.${op.axis} ${op.end}`
    case 'move':
      return `mover ${op.id}.${op.axis}`
    case 'distribute':
      return `repartir ${op.ids.length} en ${op.axis}`
    case 'changeMaterial':
      return `${op.ids.join(',')}→${op.material}`
    case 'changeProperties':
      return `props ${op.id}`
    case 'addJoint':
      return `+unión ${op.joint.id}`
    case 'changeJoint':
      return `unión ${op.joint.id}→${op.joint.type}`
    case 'removeJoint':
      return `-unión ${op.id}`
    case 'resizeFurniture':
      return `${op.axis}→${op.value} ${op.rule}`
    case 'setWallAnchored':
      return `anclaje ${op.value ? 'sí' : 'no'}`
    case 'addDrawer':
      return `+cajón ${op.group}`
  }
}

/** The log the expert sees: recent changes in full, older ones in a line, the oldest only counted; what matters already lives in decisions and requirements. */
export function compactLog(versions: Version[]): string[] {
  const ordered = [...versions].sort((a, b) => b.n - a.n)
  const full = ordered.slice(0, LIMITS.full).map((v) => `v${v.n}: ${v.summary} — request: "${v.reason}" — ${v.operations.join('; ') || 'no operations'}`)
  const summarized = ordered.slice(LIMITS.full, LIMITS.summarized).map((v) => `v${v.n}: ${v.summary}`)
  const rest = ordered.length - LIMITS.summarized
  return [...full, ...summarized, ...(rest > 0 ? [`(${rest} earlier changes)`] : [])].reverse()
}

/** A new decision on a topic replaces the previous one; the most recent are kept. */
export function updateDecisions(current: Decision[], added: Decision[]): Decision[] {
  const topics = new Set(added.map((d) => d.topic))
  return [...current.filter((d) => !topics.has(d.topic)), ...added].slice(-LIMITS.decisions)
}

/** The first version and the most recent ones are kept. */
export function pruneVersions(versions: Version[]): Version[] {
  if (versions.length <= LIMITS.versions) return versions
  const [first, ...rest] = versions
  return [first, ...rest.slice(-(LIMITS.versions - 1))]
}
