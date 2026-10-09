import { ASSUMPTIONS } from '../../assumptions'
import { CONTACT_TOLERANCE, overlap } from '../../design/boxes'
import { lifts, slides } from '../../design/doors'
import type { Box } from '../../design/resolve'
import type { Finding, RuleContext } from '../structure/finding'

// A door or drawer front set inside its opening has no edge to pull by: without a notch or a handle it cannot be opened. Judged wherever there is one, whoever built the design.
// Inset is read from where the pieces are (docs/carpinteria/glosario.md «Embutida»: inside the opening, flush with the edge): an overlay front stands proud of what is around it and leaves an edge free.

type Edge = readonly ['x' | 'y', 0 | 1]
const EDGES: readonly Edge[] = [['x', 0], ['x', 1], ['y', 0], ['y', 1]]

/** Whether that edge of the front has something beside it, level with its face, closer than a finger needs. */
function closed(front: Box, around: Box[], [axis, end]: Edge): boolean {
  const { fingerRoom } = ASSUMPTIONS.pulls
  // The floor closes the lower edge like a board does.
  if (axis === 'y' && end === 0 && front.y0 < fingerRoom) return true
  return around.some((box) => {
    const gap = end === 0 ? front[`${axis}0`] - box[`${axis}1`] : box[`${axis}0`] - front[`${axis}1`]
    return gap >= -CONTACT_TOLERANCE && gap < fingerRoom && overlap(box, front, axis === 'x' ? 'y' : 'x') > CONTACT_TOLERANCE
  })
}

/** R10, fronts: the hinged doors and drawer fronts boxed in on their four edges that neither the furniture's pulls nor their own give a way to open. */
export function pullFindings({ design, geo }: RuleContext): Finding[] {
  const stuck = design.pieces.filter((front) => {
    const box = geo.boxes.get(front.id)
    if (!box || (front.role !== 'door' && front.role !== 'drawer-front')) return false
    // A lid is lifted by its own edge, and the reference does not say how a sliding leaf is pulled.
    if ((design.pullsOf?.[front.id] ?? design.pulls ?? 'none') !== 'none' || lifts(design, front.id) || slides(design, front.id)) return false
    const around = design.pieces.flatMap((p) => {
      const other = geo.boxes.get(p.id)
      const apart = p.id !== front.id && (!front.group || p.group !== front.group)
      return other && apart && overlap(other, box, 'z') > CONTACT_TOLERANCE ? [other] : []
    })
    return EDGES.every((edge) => closed(box, around, edge))
  })
  if (!stuck.length) return []
  const names = new Intl.ListFormat('es', { type: 'conjunction' }).format(stuck.map((p) => p.name))
  const message =
    stuck.length === 1
      ? `${names} queda al ras dentro de su hueco y no tiene muesca ni jaladera: no hay de dónde jalar para abrir. Ponle una muesca o una jaladera.`
      : `${names} quedan al ras dentro de su hueco y no tienen muesca ni jaladera: no hay de dónde jalar para abrir. Ponles una muesca o una jaladera.`
  return [{ code: 'R10_USE', severity: 'recommendation', pieces: stuck.map((p) => p.id), check: 'front.pull', message, data: { fronts: stuck.length }, alternatives: [] }]
}
