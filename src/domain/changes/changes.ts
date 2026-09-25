import { analyze } from '../analysis'
import { DIMENSION_LABEL, type Design, type Piece } from '../diseno/schema'
import { completeJoints } from '../diseno/joints'
import { normalize } from '../diseno/normalize'
import { faceSize, roundTo, type Box } from '../diseno/resolve'
import type { Catalog } from '../materiales/catalog'
import { applyOperations } from '../operaciones/apply'
import type { DesignError } from '../validation/errors'

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

const PROPERTIES = ['name', 'role', 'material', 'normal', 'grain', 'load', 'support', 'group', 'confidence'] as const
const definitionChanged = (a: Piece, b: Piece) => PROPERTIES.some((k) => a[k] !== b[k]) || JSON.stringify([a.x, a.y, a.z, a.edges]) !== JSON.stringify([b.x, b.y, b.z, b.edges])
const boxChanged = (a: Box, b: Box) => (Object.keys(a) as (keyof Box)[]).some((k) => Math.abs(a[k] - b[k]) > 0.05)
const face = (p: Piece, box: Box) => faceSize(box, p.normal).map((m) => roundTo(m, 0)).join(' × ')
const thickness = (p: Piece, box: Box) => roundTo(box[`${p.normal}1`] - box[`${p.normal}0`], 0)

function detail(before: Piece, after: Piece, a: Box | undefined, b: Box | undefined): string {
  const parts: string[] = []
  if (a && b) {
    if (face(before, a) !== face(after, b)) parts.push(`${face(before, a)} → ${face(after, b)} mm`)
    if (thickness(before, a) !== thickness(after, b)) parts.push(`${thickness(before, a)} → ${thickness(after, b)} mm de espesor`)
    const moved = (['x', 'y', 'z'] as const).map((e) => b[`${e}0`] - a[`${e}0`]).find((d) => Math.abs(d) > 0.5)
    if (!parts.length && moved !== undefined) parts.push(`se movió ${roundTo(Math.abs(moved), 0)} mm`)
  }
  if (before.name !== after.name) parts.push(`ahora «${after.name}»`)
  if (before.support !== after.support) parts.push(after.support === 'movable' ? 'ahora móvil' : 'ahora fija')
  if (before.confidence !== after.confidence && after.confidence === 'high') parts.push('confirmada')
  return parts.join(' · ') || 'cambió su definición'
}

export function describeChange(before: Design, after: Design, catalog: Catalog): Change {
  const boxesBefore = analyze(before, catalog).geo?.boxes ?? new Map<string, Box>()
  const boxesAfter = analyze(after, catalog).geo?.boxes ?? new Map<string, Box>()
  const previous = new Map(before.pieces.map((p) => [p.id, p]))
  const next = new Map(after.pieces.map((p) => [p.id, p]))
  const direct: ChangeItem[] = []
  const followed: string[] = []
  for (const p of after.pieces) {
    const was = previous.get(p.id)
    const box = boxesAfter.get(p.id)
    if (!was) direct.push({ id: p.id, name: p.name, kind: 'added', detail: box ? `${face(p, box)} mm` : '' })
    else if (definitionChanged(was, p)) direct.push({ id: p.id, name: p.name, kind: 'changed', detail: detail(was, p, boxesBefore.get(p.id), box) })
    else if (box && boxesBefore.has(p.id) && boxChanged(boxesBefore.get(p.id)!, box)) followed.push(p.name)
  }
  for (const p of before.pieces) if (!next.has(p.id)) direct.push({ id: p.id, name: p.name, kind: 'removed', detail: '' })
  const sizes = (['height', 'width', 'depth'] as const).filter((k) => before.dimensions[k] !== after.dimensions[k]).map((k) => `${before.dimensions[k]} → ${after.dimensions[k]} mm de ${DIMENSION_LABEL[k]}`)
  return { direct, followed, dimensions: sizes.length ? sizes.join(', ') : null }
}

/** Brings pieces back as they were in `source` (removed ones return, changed ones revert, added ones go); the rest stays. */
export function restorePieces(current: Design, source: Design, ids: string[], catalog: Catalog): { ok: true; design: Design } | { ok: false; errors: DesignError[] } {
  const was = new Map(source.pieces.map((p) => [p.id, p]))
  const toRemove = ids.filter((id) => !was.has(id) && current.pieces.some((p) => p.id === id))
  let design = current
  if (toRemove.length) {
    const removed = applyOperations(design, toRemove.map((id) => ({ op: 'removePiece' as const, id })), catalog)
    if (!removed.ok) return { ok: false, errors: removed.errors }
    design = removed.value.design
  }
  const back = ids.filter((id) => was.has(id))
  const pieces = [...design.pieces.filter((p) => !back.includes(p.id)), ...back.map((id) => was.get(id)!)]
  const present = new Set(pieces.map((p) => p.id))
  const joints = [
    ...design.joints.filter((u) => !back.includes(u.a) && !back.includes(u.b)),
    ...source.joints.filter((u) => (back.includes(u.a) || back.includes(u.b)) && present.has(u.a) && present.has(u.b)),
  ]
  const candidate = { ...design, pieces, joints }
  const analysis = analyze(candidate, catalog)
  if (!analysis.geo) return { ok: false, errors: analysis.valid ? [] : analysis.errors }
  return { ok: true, design: completeJoints(normalize(candidate, catalog), catalog, current) }
}
