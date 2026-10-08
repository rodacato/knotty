import { ref } from '../../design/builders'
import { holeCuts } from '../../design/cuts'
import type { Geometry } from '../../design/resolve'
import type { Cut, Design, FaceRef } from '../../design/schema'
import { CABLE_HOLE, CABLE_RISE } from './common'

// A round hole in the back of a cabinet, behind a cell, for the cables of what stands in it. Like every cut it is only drawn.

/** The cell a hole is asked for: the faces at its sides and its floor. */
export interface CablePass {
  left: FaceRef
  right: FaceRef
  bottom: FaceRef
}

/** The design with a hole for each pass in the back that stands behind it, and how many were made: a cell with no back behind it needs none. */
export function withCablePasses(design: Design, geo: Geometry, passes: CablePass[]): { design: Design; holes: number } {
  const cuts = new Map<string, Cut[]>()
  const r = CABLE_HOLE / 2
  let holes = 0
  for (const pass of passes) {
    const x = (geo.measure(ref(pass.left), 'x') + geo.measure(ref(pass.right), 'x')) / 2
    const y = geo.measure(ref(pass.bottom), 'y') + CABLE_RISE
    const back = design.pieces.find((p) => {
      const box = geo.boxes.get(p.id)
      return p.role === 'back' && p.normal === 'z' && box && box.x0 <= x - r && x + r <= box.x1 && box.y0 <= y - r && y + r <= box.y1
    })
    if (!back) continue
    holes++
    cuts.set(back.id, [...(cuts.get(back.id) ?? []), ...holeCuts(geo.boxes.get(back.id)!, 'z', [x, y], CABLE_HOLE)])
  }
  return { design: { ...design, pieces: design.pieces.map((p) => (cuts.has(p.id) ? { ...p, cuts: [...(p.cuts ?? []), ...cuts.get(p.id)!] } : p)) }, holes }
}

/** What the person reads when the back takes cable holes: how each is made, and when. */
export const cableNote = (asked: number, holes: number) =>
  holes === 0
    ? 'Pasacables: donde no hay trasera no hace falta, los cables salen por atrás.'
    : `${holes === 1 ? 'Pasacables: un barreno' : `${holes} pasacables: barrenos`} de ${CABLE_HOLE} mm en la trasera, al centro del hueco y a ${CABLE_RISE} mm de su piso. Se ${holes === 1 ? 'hace' : 'hacen'} con broca sierra antes de clavar la trasera.${asked > holes ? ' Donde no hay trasera no hace falta.' : ''}`
