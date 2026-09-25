import { analizar } from '../analisis'
import type { Diseno, Pieza } from '../diseno/esquema'
import { completeJoints } from '../diseno/joints'
import { normalizar } from '../diseno/normalizador'
import { medidasCara, redondear, type Caja } from '../diseno/resolver'
import type { Catalogo } from '../materiales/catalogo'
import { aplicar } from '../operaciones/aplicar'
import type { ErrorDiseno } from '../validacion/errores'

// What a change did to the pieces, in words, and how to bring pieces back from before it without touching the rest.

export interface ChangeItem {
  id: string
  name: string
  kind: 'added' | 'removed' | 'changed'
  /** For the person: "564 × 294 → 500 × 294 mm", "18 → 15 mm", "se movió 50 mm". */
  detail: string
}

export interface Change {
  /** What the change touched on purpose: these can be brought back one by one. */
  direct: ChangeItem[]
  /** Pieces that only followed along (a shelf that grew because the piece got wider). */
  followed: string[]
  /** "600 → 736 mm de ancho" when the whole piece of furniture changed size. */
  dimensions: string | null
}

const PROPERTIES = ['nombre', 'rol', 'material', 'normal', 'veta', 'carga', 'apoyo', 'grupo', 'confianza'] as const
const definitionChanged = (a: Pieza, b: Pieza) => PROPERTIES.some((k) => a[k] !== b[k]) || JSON.stringify([a.x, a.y, a.z, a.cantos]) !== JSON.stringify([b.x, b.y, b.z, b.cantos])
const boxChanged = (a: Caja, b: Caja) => (Object.keys(a) as (keyof Caja)[]).some((k) => Math.abs(a[k] - b[k]) > 0.05)
const face = (p: Pieza, box: Caja) => medidasCara(box, p.normal).map((m) => redondear(m, 0)).join(' × ')
const thickness = (p: Pieza, box: Caja) => redondear(box[`${p.normal}1`] - box[`${p.normal}0`], 0)

function detail(before: Pieza, after: Pieza, a: Caja | undefined, b: Caja | undefined): string {
  const parts: string[] = []
  if (a && b) {
    if (face(before, a) !== face(after, b)) parts.push(`${face(before, a)} → ${face(after, b)} mm`)
    if (thickness(before, a) !== thickness(after, b)) parts.push(`${thickness(before, a)} → ${thickness(after, b)} mm de espesor`)
    const moved = (['x', 'y', 'z'] as const).map((e) => b[`${e}0`] - a[`${e}0`]).find((d) => Math.abs(d) > 0.5)
    if (!parts.length && moved !== undefined) parts.push(`se movió ${redondear(Math.abs(moved), 0)} mm`)
  }
  if (before.nombre !== after.nombre) parts.push(`ahora «${after.nombre}»`)
  if (before.apoyo !== after.apoyo) parts.push(after.apoyo === 'movil' ? 'ahora móvil' : 'ahora fija')
  if (before.confianza !== after.confianza && after.confianza === 'alta') parts.push('confirmada')
  return parts.join(' · ') || 'cambió su definición'
}

export function describeChange(before: Diseno, after: Diseno, catalog: Catalogo): Change {
  const boxesBefore = analizar(before, catalog).geo?.cajas ?? new Map<string, Caja>()
  const boxesAfter = analizar(after, catalog).geo?.cajas ?? new Map<string, Caja>()
  const previous = new Map(before.piezas.map((p) => [p.id, p]))
  const next = new Map(after.piezas.map((p) => [p.id, p]))
  const direct: ChangeItem[] = []
  const followed: string[] = []
  for (const p of after.piezas) {
    const was = previous.get(p.id)
    const box = boxesAfter.get(p.id)
    if (!was) direct.push({ id: p.id, name: p.nombre, kind: 'added', detail: box ? `${face(p, box)} mm` : '' })
    else if (definitionChanged(was, p)) direct.push({ id: p.id, name: p.nombre, kind: 'changed', detail: detail(was, p, boxesBefore.get(p.id), box) })
    else if (box && boxesBefore.has(p.id) && boxChanged(boxesBefore.get(p.id)!, box)) followed.push(p.nombre)
  }
  for (const p of before.piezas) if (!next.has(p.id)) direct.push({ id: p.id, name: p.nombre, kind: 'removed', detail: '' })
  const sizes = (['alto', 'ancho', 'fondo'] as const).filter((k) => before.dimensiones[k] !== after.dimensiones[k]).map((k) => `${before.dimensiones[k]} → ${after.dimensiones[k]} mm de ${k}`)
  return { direct, followed, dimensions: sizes.length ? sizes.join(', ') : null }
}

/** Brings pieces back as they were in `source` (removed ones return, changed ones revert, added ones go); the rest stays. */
export function restorePieces(current: Diseno, source: Diseno, ids: string[], catalog: Catalogo): { ok: true; design: Diseno } | { ok: false; errors: ErrorDiseno[] } {
  const was = new Map(source.piezas.map((p) => [p.id, p]))
  const toRemove = ids.filter((id) => !was.has(id) && current.piezas.some((p) => p.id === id))
  let design = current
  if (toRemove.length) {
    const removed = aplicar(design, toRemove.map((id) => ({ op: 'eliminarPieza' as const, id })), catalog)
    if (!removed.ok) return { ok: false, errors: removed.errores }
    design = removed.valor.diseno
  }
  const back = ids.filter((id) => was.has(id))
  const pieces = [...design.piezas.filter((p) => !back.includes(p.id)), ...back.map((id) => was.get(id)!)]
  const present = new Set(pieces.map((p) => p.id))
  const joints = [
    ...design.uniones.filter((u) => !back.includes(u.a) && !back.includes(u.b)),
    ...source.uniones.filter((u) => (back.includes(u.a) || back.includes(u.b)) && present.has(u.a) && present.has(u.b)),
  ]
  const candidate = { ...design, piezas: pieces, uniones: joints }
  const analysis = analizar(candidate, catalog)
  if (!analysis.geo) return { ok: false, errors: analysis.valido ? [] : analysis.errores }
  return { ok: true, design: completeJoints(normalizar(candidate, catalog), catalog, current) }
}
