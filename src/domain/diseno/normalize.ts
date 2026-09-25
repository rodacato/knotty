import type { Catalog } from '../materiales/catalog'
import { DIMENSION_OF_AXIS, AXES, type FaceRef, type Design, type Axis, type Piece } from './schema'
import { referencedPieces, resolveGeometry, roundTo, type Box } from './resolve'

// A design thought in coordinates becomes parametric: each absolute cota is tied to the nearest face, without moving it.

/** How close a face has to be for a cota to snap to it. */
const SNAP = 3

type End = 'from' | 'to'
interface Candidate {
  ref: FaceRef
  value: number
  preference: number
}

export function normalize(original: Design, catalog: Catalog): Design {
  const r = resolveGeometry(original, catalog)
  if (!r.ok) return original
  const { boxes } = r.value
  const design = structuredClone(original)
  const byId = new Map(design.pieces.map((p) => [p.id, p]))

  const dependsOn = (from: string, target: string, axis: Axis, seen = new Set<string>()): boolean => {
    if (from === target) return true
    if (seen.has(from)) return false
    seen.add(from)
    const p = byId.get(from)
    return !!p && referencedPieces(p[axis]).some((other) => other !== 'furniture' && dependsOn(other, target, axis, seen))
  }

  const candidates = (p: Piece, axis: Axis, end: End, outsideOnly: boolean): Candidate[] => {
    const opposite = end === 'from' ? 1 : 0
    const outside: Candidate[] = [
      { ref: `furniture.${axis}0`, value: 0, preference: 0 },
      { ref: `furniture.${axis}1`, value: design.dimensions[DIMENSION_OF_AXIS[axis]], preference: 0 },
    ]
    if (outsideOnly) return outside
    return [
      ...outside,
      ...[...boxes]
        .filter(([id]) => id !== p.id && !dependsOn(id, p.id, axis))
        .flatMap(([id, box]) => ([0, 1] as const).map((side) => ({ ref: `${id}.${axis}${side}` as FaceRef, value: box[`${axis}${side}`], preference: side === opposite ? 1 : 2 }))),
    ]
  }

  const best = (value: number, list: Candidate[]) =>
    list
      .map((c) => ({ ...c, distance: Math.abs(value - c.value) }))
      .filter((c) => c.distance <= SNAP)
      .sort((a, b) => a.distance - b.distance || a.preference - b.preference)[0]

  const anchor = (p: Piece, axis: Axis, box: Box, outsideOnly: boolean) => {
    const t = p[axis]
    if (axis === p.normal) {
      const current = t.from ?? t.to
      if (current?.type !== 'mm') return
      const options = (['from', 'to'] as const)
        .map((end) => {
          const value = end === 'from' ? box[`${axis}0`] : box[`${axis}1`]
          const c = best(value, candidates(p, axis, end, outsideOnly))
          return c && { end, value, c }
        })
        .filter((o) => !!o)
        .sort((a, b) => a.c.distance - b.c.distance || a.c.preference - b.c.preference)
      const chosen = options[0]
      if (!chosen) return
      const cota = { type: 'ref' as const, ref: chosen.c.ref, offset: roundTo(chosen.value - chosen.c.value) }
      p[axis] = { from: chosen.end === 'from' ? cota : null, to: chosen.end === 'to' ? cota : null, length: null }
      return
    }
    for (const end of ['from', 'to'] as const) {
      const cota = t[end]
      if (cota?.type !== 'mm') continue
      const c = best(cota.mm, candidates(p, axis, end, outsideOnly))
      if (c) t[end] = { type: 'ref', ref: c.ref, offset: roundTo(cota.mm - c.value) }
    }
  }

  // First to the outside of the piece of furniture, then to the other pieces: outer measures win when both are close.
  for (const outsideOnly of [true, false])
    for (const p of design.pieces)
      for (const axis of AXES) anchor(p, axis, boxes.get(p.id)!, outsideOnly)
  return design
}
