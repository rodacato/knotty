import { analizar } from '../analisis'
import { mm } from '../diseno/construir'
import { EJES, type Diseno, type Eje, type Pieza, type Rol } from '../diseno/esquema'
import { normalizar } from '../diseno/normalizador'
import { redondear, type Caja } from '../diseno/resolver'
import type { Catalogo } from '../materiales/catalogo'
import { aplicar } from '../operaciones/aplicar'
import type { Operacion } from '../operaciones/esquema'
import type { Requisito } from '../requisitos/requisitos'
import type { ErrorDiseno } from '../validacion/errores'

// Fixes by rule the validation errors that have an obvious fix, so they never go back to the model.

export interface Repair {
  code: string
  /** For the person, in Spanish: what was changed and why. */
  message: string
  pieces: string[]
}

/** Which piece gives way when two overlap: the structure stays, what hangs from it adjusts. */
const RANK: Partial<Record<Rol, number>> = { lateral: 0, piso: 1, techo: 1, divisor: 2, zoclo: 3, faja: 3, trasera: 4, entrepano: 5, puerta: 6 }
const rank = (p: Pieza) => RANK[p.rol] ?? 4
const volume = (c: Caja) => (c.x1 - c.x0) * (c.y1 - c.y0) * (c.z1 - c.z0)
/** A trim that leaves less than this is not a trim, it is a different piece. */
const MIN_LENGTH = 30
const MAX_ROUNDS = 12

type Fix = { operations: Operacion[]; repair: Repair } | null

function fixLooseJoint(e: ErrorDiseno, design: Diseno): Fix {
  const joint = design.uniones.find((u) => u.id === e.datos?.union)
  if (!joint || joint.tipo === 'corredera') return null
  const name = (id: string) => design.piezas.find((p) => p.id === id)?.nombre ?? id
  return {
    operations: [{ op: 'eliminarUnion', id: joint.id }],
    repair: { code: e.codigo, message: `Quité la unión entre ${name(joint.a)} y ${name(joint.b)}: no se tocan.`, pieces: [joint.a, joint.b] },
  }
}

function fixOverlap(e: ErrorDiseno, design: Diseno, boxes: Map<string, Caja>): Fix {
  const [p, q] = [e.datos?.a, e.datos?.b].map((id) => design.piezas.find((x) => x.id === id))
  if (!p || !q || p.grupo || q.grupo) return null
  const [pb, qb] = [boxes.get(p.id)!, boxes.get(q.id)!]
  // The one that gives way: lower in the structure, then the smaller one, then the later one.
  const [give, keep] = rank(p) !== rank(q) ? (rank(p) > rank(q) ? [p, q] : [q, p]) : volume(pb) !== volume(qb) ? (volume(pb) < volume(qb) ? [p, q] : [q, p]) : [q, p]
  const [g, k] = [boxes.get(give.id)!, boxes.get(keep.id)!]
  const overlap = (axis: Eje) => Math.min(g[`${axis}1`], k[`${axis}1`]) - Math.max(g[`${axis}0`], k[`${axis}0`])
  const depth = redondear(Math.min(...EJES.map(overlap)))

  if (EJES.every((axis) => overlap(axis) >= g[`${axis}1`] - g[`${axis}0`] - 0.5))
    return {
      operations: [{ op: 'eliminarPieza', id: give.id }],
      repair: { code: e.codigo, message: `Quité ${give.nombre}: estaba completa dentro de ${keep.nombre}.`, pieces: [give.id, keep.id] },
    }

  const options = EJES.map((axis) => {
    const before = (g[`${axis}0`] + g[`${axis}1`]) / 2 < (k[`${axis}0`] + k[`${axis}1`]) / 2
    const length = g[`${axis}1`] - g[`${axis}0`]
    if (axis === give.normal) {
      const start = before ? k[`${axis}0`] - length : k[`${axis}1`]
      return { axis, cost: overlap(axis), operation: { op: 'mover', id: give.id, eje: axis, cota: mm(redondear(start)) } as Operacion, moved: true }
    }
    const remaining = before ? k[`${axis}0`] - g[`${axis}0`] : g[`${axis}1`] - k[`${axis}1`]
    if (remaining < MIN_LENGTH) return null
    const operation: Operacion = { op: 'redimensionar', id: give.id, eje: axis, extremo: before ? 'hasta' : 'desde', cota: mm(redondear(before ? k[`${axis}0`] : k[`${axis}1`])) }
    return { axis, cost: overlap(axis), operation, moved: false }
  }).filter((o): o is NonNullable<typeof o> => !!o && o.cost > 0)
  const best = options.sort((a, b) => a.cost - b.cost)[0]
  if (!best) return null
  return {
    operations: [best.operation],
    repair: {
      code: e.codigo,
      message: best.moved ? `Moví ${give.nombre} junto a ${keep.nombre}: se encimaban ${depth} mm.` : `Recorté ${give.nombre} hasta ${keep.nombre}: se encimaban ${depth} mm.`,
      pieces: [give.id, keep.id],
    },
  }
}

/** Fixes what has an obvious fix, one error at a time, and stops as soon as a fix does not help. */
export function repairDesign(original: Diseno, catalog: Catalogo, requirements: Requisito[] = []): { design: Diseno; repairs: Repair[] } {
  let design = original
  const repairs: Repair[] = []
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const analysis = analizar(design, catalog, requirements)
    if (analysis.valido || !analysis.geo) break
    const geo = analysis.geo
    const errorCount = analysis.errores.length
    let applied = false
    for (const e of analysis.errores) {
      const fix = e.codigo === 'E_UNION_SIN_CONTACTO' ? fixLooseJoint(e, design) : e.codigo === 'E_TRASLAPE' ? fixOverlap(e, design, geo.cajas) : null
      if (!fix) continue
      const result = aplicar(design, fix.operations, catalog)
      if (!result.ok) continue
      const candidate = normalizar(result.valor.diseno, catalog)
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
  return { design, repairs }
}
