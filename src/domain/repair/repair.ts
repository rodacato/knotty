import { analizar } from '../analisis'
import { mm } from '../diseno/builders'
import { DIMENSION_DE_EJE, EJES, isDrawerPart, type Diseno, type Eje, type Pieza, type Rol } from '../diseno/esquema'
import { completeJoints } from '../diseno/joints'
import { normalize } from '../diseno/normalize'
import { roundTo, type Box } from '../diseno/resolve'
import type { Catalog } from '../materiales/catalog'
import { applyOperations } from '../operaciones/apply'
import type { Operation } from '../operaciones/schema'
import type { Requisito } from '../requisitos/requisitos'
import type { DesignError } from '../validation/errors'

// Fixes by rule the validation errors that have an obvious fix, so they never go back to the model.

export interface Repair {
  code: string
  /** For the person, in Spanish: what was changed and why. */
  message: string
  pieces: string[]
}

/** Which piece gives way when two overlap: the structure stays, what hangs from it adjusts. */
const RANK: Partial<Record<Rol, number>> = { lateral: 0, piso: 1, techo: 1, divisor: 2, zoclo: 3, faja: 3, trasera: 4, puerta: 5, entrepano: 6 }
const rank = (p: Pieza) => RANK[p.rol] ?? 4
const volume = (c: Box) => (c.x1 - c.x0) * (c.y1 - c.y0) * (c.z1 - c.z0)
/** A trim that leaves less than this is not a trim, it is a different piece. */
const MIN_LENGTH = 30
const MAX_ROUNDS = 12

type Fix = { operations: Operation[]; repair: Repair } | null

function fixLooseJoint(e: DesignError, design: Diseno): Fix {
  const joint = design.uniones.find((u) => u.id === e.data?.union)
  if (!joint || joint.tipo === 'corredera') return null
  const name = (id: string) => design.piezas.find((p) => p.id === id)?.nombre ?? id
  return {
    operations: [{ op: 'eliminarUnion', id: joint.id }],
    repair: { code: e.code, message: `Quité la unión entre ${name(joint.a)} y ${name(joint.b)}: no se tocan.`, pieces: [joint.a, joint.b] },
  }
}

function fixOverlap(e: DesignError, design: Diseno, boxes: Map<string, Box>): Fix {
  const [p, q] = [e.data?.a, e.data?.b].map((id) => design.piezas.find((x) => x.id === id))
  if (!p || !q || isDrawerPart(p) || isDrawerPart(q)) return null
  const [pb, qb] = [boxes.get(p.id)!, boxes.get(q.id)!]
  // The one that gives way: lower in the structure, then the smaller one, then the later one.
  const [give, keep] = rank(p) !== rank(q) ? (rank(p) > rank(q) ? [p, q] : [q, p]) : volume(pb) !== volume(qb) ? (volume(pb) < volume(qb) ? [p, q] : [q, p]) : [q, p]
  const [g, k] = [boxes.get(give.id)!, boxes.get(keep.id)!]
  const overlap = (axis: Eje) => Math.min(g[`${axis}1`], k[`${axis}1`]) - Math.max(g[`${axis}0`], k[`${axis}0`])
  const depth = roundTo(Math.min(...EJES.map(overlap)))

  if (EJES.every((axis) => overlap(axis) >= g[`${axis}1`] - g[`${axis}0`] - 0.5))
    return {
      operations: [{ op: 'eliminarPieza', id: give.id }],
      repair: { code: e.code, message: `Quité ${give.nombre}: estaba completa dentro de ${keep.nombre}.`, pieces: [give.id, keep.id] },
    }

  const size = (axis: Eje) => design.dimensiones[DIMENSION_DE_EJE[axis]]
  const normal = give.normal
  const thickness = g[`${normal}1`] - g[`${normal}0`]
  const before = (axis: Eje) => (g[`${axis}0`] + g[`${axis}1`]) / 2 < (k[`${axis}0`] + k[`${axis}1`]) / 2
  // Sunk into the other only part of its thickness: it belongs next to it, so it moves out whole.
  if (overlap(normal) < thickness - 0.5) {
    const start = before(normal) ? k[`${normal}0`] - thickness : k[`${normal}1`]
    if (start >= -0.5 && start + thickness <= size(normal) + 0.5)
      return {
        operations: [{ op: 'mover', id: give.id, eje: normal, cota: mm(roundTo(start)) }],
        repair: { code: e.code, message: `Moví ${give.nombre} junto a ${keep.nombre}: se encimaban ${depth} mm.`, pieces: [give.id, keep.id] },
      }
    // No room to move out (an overlay door at the front): the other one steps back instead.
    const edge = before(normal) ? g[`${normal}1`] : g[`${normal}0`]
    const left = before(normal) ? k[`${normal}1`] - edge : edge - k[`${normal}0`]
    if (keep.normal === normal || left < MIN_LENGTH) return null
    return {
      operations: [{ op: 'redimensionar', id: keep.id, eje: normal, extremo: before(normal) ? 'desde' : 'hasta', cota: mm(roundTo(edge)) }],
      repair: { code: e.code, message: `Recorté ${keep.nombre} hasta ${give.nombre}: se encimaban ${depth} mm.`, pieces: [keep.id, give.id] },
    }
  }

  // Through its whole thickness (a shelf running into a side): it is trimmed where the change is smallest.
  const options = EJES.filter((axis) => axis !== normal).map((axis) => {
    const remaining = before(axis) ? k[`${axis}0`] - g[`${axis}0`] : g[`${axis}1`] - k[`${axis}1`]
    if (remaining < MIN_LENGTH || overlap(axis) <= 0) return null
    const operation: Operation = { op: 'redimensionar', id: give.id, eje: axis, extremo: before(axis) ? 'hasta' : 'desde', cota: mm(roundTo(before(axis) ? k[`${axis}0`] : k[`${axis}1`])) }
    return { cost: overlap(axis), operation }
  }).filter((o): o is NonNullable<typeof o> => !!o)
  const best = options.sort((a, b) => a.cost - b.cost)[0]
  if (!best) return null
  return {
    operations: [best.operation],
    repair: { code: e.code, message: `Recorté ${give.nombre} hasta ${keep.nombre}: se encimaban ${depth} mm.`, pieces: [give.id, keep.id] },
  }
}

/** Fixes what has an obvious fix, one error at a time, and stops as soon as a fix does not help. */
export function repairDesign(original: Diseno, catalog: Catalog, requirements: Requisito[] = []): { design: Diseno; repairs: Repair[] } {
  let design = original
  const repairs: Repair[] = []
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const analysis = analizar(design, catalog, requirements)
    if (analysis.valido || !analysis.geo) break
    const geo = analysis.geo
    const errorCount = analysis.errores.length
    let applied = false
    for (const e of analysis.errores) {
      const fix = e.code === 'E_UNION_SIN_CONTACTO' ? fixLooseJoint(e, design) : e.code === 'E_TRASLAPE' ? fixOverlap(e, design, geo.boxes) : null
      if (!fix) continue
      const result = applyOperations(design, fix.operations, catalog)
      if (!result.ok) continue
      const candidate = normalize(result.value.design, catalog)
      const after = analizar(candidate, catalog, requirements)
      // A fix must not make things worse: fewer errors, or the design becomes valid.
      if (!after.valido && (!after.geo || after.errores.length >= errorCount)) continue
      design = candidate
      repairs.push(fix.repair)
      applied = true
      break
    }
    if (!applied) break
  }
  // A repair can create contacts (a top trimmed between two sides): they get their joints, the rest stays as it was.
  return { design: repairs.length ? completeJoints(design, catalog, original) : design, repairs }
}
