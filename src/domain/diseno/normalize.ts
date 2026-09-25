import type { Catalog } from '../materiales/catalog'
import { DIMENSION_DE_EJE, EJES, type CaraRef, type Diseno, type Eje, type Pieza } from './esquema'
import { referencedPieces, resolveGeometry, roundTo, type Box } from './resolve'

// A design thought in coordinates becomes parametric: each absolute cota is tied to the nearest face, without moving it.

/** How close a face has to be for a cota to snap to it. */
const SNAP = 3

type End = 'desde' | 'hasta'
interface Candidate {
  ref: CaraRef
  value: number
  preference: number
}

export function normalize(original: Diseno, catalog: Catalog): Diseno {
  const r = resolveGeometry(original, catalog)
  if (!r.ok) return original
  const { boxes } = r.value
  const design = structuredClone(original)
  const byId = new Map(design.piezas.map((p) => [p.id, p]))

  const dependsOn = (from: string, target: string, axis: Eje, seen = new Set<string>()): boolean => {
    if (from === target) return true
    if (seen.has(from)) return false
    seen.add(from)
    const p = byId.get(from)
    return !!p && referencedPieces(p[axis]).some((other) => other !== 'mueble' && dependsOn(other, target, axis, seen))
  }

  const candidates = (p: Pieza, axis: Eje, end: End, outsideOnly: boolean): Candidate[] => {
    const opposite = end === 'desde' ? 1 : 0
    const outside: Candidate[] = [
      { ref: `mueble.${axis}0`, value: 0, preference: 0 },
      { ref: `mueble.${axis}1`, value: design.dimensiones[DIMENSION_DE_EJE[axis]], preference: 0 },
    ]
    if (outsideOnly) return outside
    return [
      ...outside,
      ...[...boxes]
        .filter(([id]) => id !== p.id && !dependsOn(id, p.id, axis))
        .flatMap(([id, box]) => ([0, 1] as const).map((side) => ({ ref: `${id}.${axis}${side}` as CaraRef, value: box[`${axis}${side}`], preference: side === opposite ? 1 : 2 }))),
    ]
  }

  const best = (value: number, list: Candidate[]) =>
    list
      .map((c) => ({ ...c, distance: Math.abs(value - c.value) }))
      .filter((c) => c.distance <= SNAP)
      .sort((a, b) => a.distance - b.distance || a.preference - b.preference)[0]

  const anchor = (p: Pieza, axis: Eje, box: Box, outsideOnly: boolean) => {
    const t = p[axis]
    if (axis === p.normal) {
      const current = t.desde ?? t.hasta
      if (current?.tipo !== 'mm') return
      const options = (['desde', 'hasta'] as const)
        .map((end) => {
          const value = end === 'desde' ? box[`${axis}0`] : box[`${axis}1`]
          const c = best(value, candidates(p, axis, end, outsideOnly))
          return c && { end, value, c }
        })
        .filter((o) => !!o)
        .sort((a, b) => a.c.distance - b.c.distance || a.c.preference - b.c.preference)
      const chosen = options[0]
      if (!chosen) return
      const cota = { tipo: 'ref' as const, ref: chosen.c.ref, mas: roundTo(chosen.value - chosen.c.value) }
      p[axis] = { desde: chosen.end === 'desde' ? cota : null, hasta: chosen.end === 'hasta' ? cota : null, largo: null }
      return
    }
    for (const end of ['desde', 'hasta'] as const) {
      const cota = t[end]
      if (cota?.tipo !== 'mm') continue
      const c = best(cota.mm, candidates(p, axis, end, outsideOnly))
      if (c) t[end] = { tipo: 'ref', ref: c.ref, mas: roundTo(cota.mm - c.value) }
    }
  }

  // First to the outside of the piece of furniture, then to the other pieces: outer measures win when both are close.
  for (const outsideOnly of [true, false])
    for (const p of design.piezas)
      for (const axis of EJES) anchor(p, axis, boxes.get(p.id)!, outsideOnly)
  return design
}
