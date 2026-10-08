import { ref } from '../../design/builders'
import type { Geometry } from '../../design/resolve'
import type { Design, FaceRef, Hole } from '../../design/schema'
import { CABLE_HOLE, CABLE_RISE } from './common'

// A round hole in the back of a cabinet, behind a cell, for the cables of what stands in it. Like a cut it is only drawn.

/** The cell a hole is asked for: the faces at its sides and its floor. */
export interface CablePass {
  left: FaceRef
  right: FaceRef
  bottom: FaceRef
}

/** The design with a hole for each pass in the back that stands behind it, and how many were made: a cell with no back behind it needs none. */
export function withCablePasses(design: Design, geo: Geometry, passes: CablePass[]): { design: Design; holes: number } {
  const made = new Map<string, Hole[]>()
  const r = CABLE_HOLE / 2
  for (const pass of passes) {
    const x = (geo.measure(ref(pass.left), 'x') + geo.measure(ref(pass.right), 'x')) / 2
    const y = geo.measure(ref(pass.bottom), 'y') + CABLE_RISE
    const back = design.pieces.find((p) => {
      const box = geo.boxes.get(p.id)
      return p.role === 'back' && p.normal === 'z' && box && box.x0 <= x - r && x + r <= box.x1 && box.y0 <= y - r && y + r <= box.y1
    })
    if (!back) continue
    const box = geo.boxes.get(back.id)!
    made.set(back.id, [...(made.get(back.id) ?? []), { x: x - box.x0, y: y - box.y0, z: null, diameter: CABLE_HOLE }])
  }
  const holes = [...made.values()].reduce((sum, list) => sum + list.length, 0)
  return { design: { ...design, pieces: design.pieces.map((p) => (made.has(p.id) ? { ...p, holes: made.get(p.id) } : p)) }, holes }
}

/** What the person reads when the back takes cable holes: how each is made, and when. */
export const cableNote = (asked: number, holes: number) =>
  holes === 0
    ? 'Pasacables: donde no hay trasera no hace falta, los cables salen por atrás.'
    : `${holes === 1 ? 'Pasacables: un barreno' : `${holes} pasacables: barrenos`} de ${CABLE_HOLE} mm en la trasera, al centro del hueco y a ${CABLE_RISE} mm de su piso. Se ${holes === 1 ? 'hace' : 'hacen'} con broca sierra antes de clavar la trasera.${asked > holes ? ' Donde no hay trasera no hace falta.' : ''}`
