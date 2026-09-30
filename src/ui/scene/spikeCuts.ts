import type { Piece } from '../../domain/design/schema'
import type { Box } from '../../domain/design/resolve'

// Experiment only: which voids a front gets, chosen by ?cuts=notch or ?cuts=grooves in the address.
const mode = () => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('cuts'))

export function spikeCuts(piece: Piece, box: Box, hingeOnLeft = false): Box[] {
  const kind = mode()
  if (!kind || (piece.role !== 'door' && piece.role !== 'drawer-front')) return []
  const width = box.x1 - box.x0
  const height = box.y1 - box.y0
  if (kind === 'notch') {
    const mid = (box.x0 + box.x1) / 2
    const centre = (box.y0 + box.y1) / 2
    return piece.role === 'drawer-front'
      ? [{ x0: mid - 50, x1: mid + 50, y0: box.y1 - 22, y1: box.y1 + 1, z0: box.z1 - 9, z1: box.z1 + 1 }]
      // A door's pull is on the edge away from its hinge.
      : hingeOnLeft
        ? [{ x0: box.x1 - 22, x1: box.x1 + 1, y0: centre - 50, y1: centre + 50, z0: box.z1 - 9, z1: box.z1 + 1 }]
        : [{ x0: box.x0 - 1, x1: box.x0 + 22, y0: centre - 50, y1: centre + 50, z0: box.z1 - 9, z1: box.z1 + 1 }]
  }
  if (kind === 'grooves') {
    const cuts: Box[] = []
    for (let x = box.x0 + 18; x < box.x1 - 12; x += 30) cuts.push({ x0: x, x1: x + 6, y0: box.y0 - 1, y1: box.y1 + 1, z0: box.z1 - 4, z1: box.z1 + 1 })
    return width > 60 && height > 60 ? cuts : []
  }
  return []
}
