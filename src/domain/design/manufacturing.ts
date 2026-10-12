import { ASSUMPTIONS } from '../assumptions'
import { cutBox } from './cuts'
import { slides } from './doors'
import type { Geometry } from './resolve'
import type { Design } from './schema'

export interface SlidingFit {
  id: string
  opening: number
  leaf: number
  lower: number
  upper: number
  lift: number
  margin: number
  web: number | null
}

/** Measurements come from the resolved pieces and actual cuts, including older saved designs. */
export function slidingFits(design: Design, geo: Geometry): SlidingFit[] {
  return design.pieces.filter((p) => slides(design, p.id)).flatMap((p) => {
    const leaf = geo.boxes.get(p.id)
    if (!leaf) return []
    const boards = design.joints.filter((u) => u.a === p.id && u.type === 'dado' && !u.glue).flatMap((u) => {
      const piece = design.pieces.find((b) => b.id === u.b)
      const box = geo.boxes.get(u.b)
      if (!piece || !box) return []
      const cuts = (piece.cuts ?? []).map((c) => cutBox(box, c))
      const track = cuts.find((c) => c.z0 <= leaf.z0 && c.z1 >= leaf.z1 && c.x0 < leaf.x1 && c.x1 > leaf.x0)
      if (!track) return []
      return [{ box, track, cuts }]
    })
    const bottom = boards.find(({ box }) => box.y1 < (leaf.y0 + leaf.y1) / 2)
    const top = boards.find(({ box }) => box.y0 > (leaf.y0 + leaf.y1) / 2)
    if (!bottom || !top) return []
    const lower = bottom.box.y1 - Math.max(bottom.box.y0, bottom.track.y0)
    const upper = Math.min(top.box.y1, top.track.y1) - top.box.y0
    const lift = Math.min(top.box.y1, top.track.y1) - leaf.y1
    const gaps = [bottom, top].flatMap(({ track, cuts }) => cuts
      .filter((c) => c !== track && c.x0 < track.x1 && c.x1 > track.x0)
      .map((c) => Math.max(c.z0 - track.z1, track.z0 - c.z1)))
    return [{
      id: p.id,
      opening: top.box.y0 - bottom.box.y1,
      leaf: leaf.y1 - leaf.y0,
      lower, upper, lift,
      margin: lift - (bottom.box.y1 - leaf.y0),
      web: gaps.length ? Math.min(...gaps) : null,
    }]
  })
}

/** Functional failures remain visible even when an old review had accepted other risks. */
export function manufacturingProblems(design: Design, geo: Geometry): { pieces: string[]; detail: string }[] {
  const problems = slidingFits(design, geo).flatMap((fit) => [
    ...(fit.margin < ASSUMPTIONS.sliding.liftClearance - 0.01 ? [{ pieces: [fit.id], detail: `La corrediza ${fit.id} deja ${fit.margin} mm de margen para montarla; se requieren al menos ${ASSUMPTIONS.sliding.liftClearance} mm extra después de librar la ranura inferior. Recalcula las hojas antes de cortar.` }] : []),
    ...(fit.web !== null && fit.web < ASSUMPTIONS.sliding.minWeb - 0.01 ? [{ pieces: [fit.id], detail: `Entre las ranuras de ${fit.id} quedan ${fit.web} mm de madera. Recalcula los carriles para dejar al menos ${ASSUMPTIONS.sliding.minWeb} mm y prueba el fresado en un sobrante.` }] : []),
  ])
  for (const shelf of design.pieces.filter((p) => p.role === 'shelf' && p.support === 'movable')) {
    const box = geo.boxes.get(shelf.id)
    if (!box) continue
    const walls = design.joints.filter((u) => u.type === 'shelf-pin' && (u.a === shelf.id || u.b === shelf.id)).flatMap((u) => geo.boxes.get(u.a === shelf.id ? u.b : u.a) ?? [])
    const gaps = walls.map((w) => Math.max(box.x0 - w.x1, w.x0 - box.x1))
    if (gaps.some((g) => g < 1)) problems.push({ pieces: [shelf.id], detail: `${shelf.name} no deja holgura lateral para quitarla y ponerla. Recalcula la repisa y verifica cuánto sobresalen los soportes.` })
  }
  return problems
}
