import type { Box } from './resolve'
import type { Cut, Span } from './schema'

// Voids in a piece: boxes taken out of it. They are only drawn: the piece is still the whole board for the cut list, the purchase and the checks.

const AXES = ['x', 'y', 'z'] as const

/** Where a span falls on an axis of a piece, in mm. */
function place(span: Span, lo: number, hi: number): [number, number] {
  if (span.from === 'start') return [lo + span.offset, lo + span.offset + span.length]
  if (span.from === 'end') return [hi - span.offset - span.length, hi - span.offset]
  const middle = (lo + hi) / 2 + span.offset
  return [middle - span.length / 2, middle + span.length / 2]
}

/** The box a cut takes out of a piece that sits in `box`. */
export function cutBox(box: Box, cut: Cut): Box {
  const [x0, x1] = place(cut.x, box.x0, box.x1)
  const [y0, y1] = place(cut.y, box.y0, box.y1)
  const [z0, z1] = place(cut.z, box.z0, box.z1)
  return { x0, x1, y0, y1, z0, z1 }
}

/**
 * A box with boxes taken away, as a grid: the box cut along every plane of every cut, each cell kept or gone.
 * Neighbouring cells share whole faces, so the faces between kept cells are known to be inside the wood.
 */
export interface CutGrid {
  /** The planes along x, y and z, in mm, from the box's lowest to its highest. */
  planes: [number[], number[], number[]]
  /** Whether the cell at (i, j, k), between planes i and i+1 along x, and so on, is still wood. */
  solid: (i: number, j: number, k: number) => boolean
}

export function cutGrid(box: Box, cuts: Box[]): CutGrid {
  const lo = [box.x0, box.y0, box.z0]
  const hi = [box.x1, box.y1, box.z1]
  const planes = AXES.map((axis, a) => [...new Set([lo[a], hi[a], ...cuts.flatMap((c) => [c[`${axis}0`], c[`${axis}1`]]).filter((v) => v > lo[a] && v < hi[a])])].sort((p, q) => p - q)) as CutGrid['planes']
  const gone = (i: number, j: number, k: number) =>
    cuts.some((c) => c.x0 <= planes[0][i] && planes[0][i + 1] <= c.x1 && c.y0 <= planes[1][j] && planes[1][j + 1] <= c.y1 && c.z0 <= planes[2][k] && planes[2][k + 1] <= c.z1)
  return {
    planes,
    solid: (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < planes[0].length - 1 && j < planes[1].length - 1 && k < planes[2].length - 1 && !gone(i, j, k),
  }
}

/** The volume of wood left, in mm³: the box less what the cuts take out of it. */
export function woodLeft(box: Box, cuts: Box[]): number {
  const grid = cutGrid(box, cuts)
  const [xs, ys, zs] = grid.planes
  let volume = 0
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++)
      for (let k = 0; k < zs.length - 1; k++) if (grid.solid(i, j, k)) volume += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]) * (zs[k + 1] - zs[k])
  return volume
}
