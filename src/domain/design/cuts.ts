import type { Box } from './resolve'

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
  const planes = (lo: number, hi: number, at: number[]) => [...new Set([lo, hi, ...at.filter((v) => v > lo && v < hi)])].sort((a, b) => a - b)
  const xs = planes(box.x0, box.x1, cuts.flatMap((c) => [c.x0, c.x1]))
  const ys = planes(box.y0, box.y1, cuts.flatMap((c) => [c.y0, c.y1]))
  const zs = planes(box.z0, box.z1, cuts.flatMap((c) => [c.z0, c.z1]))
  const gone = (i: number, j: number, k: number) => cuts.some((c) => c.x0 <= xs[i] && xs[i + 1] <= c.x1 && c.y0 <= ys[j] && ys[j + 1] <= c.y1 && c.z0 <= zs[k] && zs[k + 1] <= c.z1)
  return {
    planes: [xs, ys, zs],
    solid: (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < xs.length - 1 && j < ys.length - 1 && k < zs.length - 1 && !gone(i, j, k),
  }
}
