import { ASSUMPTIONS } from '../assumptions'
import { hardwareByRole, pickHardware, type Catalog } from '../materials/catalog'
import { CONTACT_TOLERANCE } from './boxes'
import type { Box } from './resolve'
import type { Design, Rod } from './schema'

// Where a closet rod runs, how far it spans and what room is under it, read from where the pieces are.

export interface RodRun {
  id: string
  ceiling: string
  walls: [string, string]
  /** Its ends along the width, its height and how far from the back. */
  x0: number
  x1: number
  y: number
  z: number
  /** From the rod down to the first board under it, or to the floor. */
  below: number
  /** Front to back, what the clothes on it have. */
  depth: number
}

const holds = (box: Box, y: number, z: number) => box.y0 <= y && box.y1 >= y && box.z0 <= z && box.z1 >= z

/** Null when the pieces do not give the rod two ends. */
export function rodRun(design: Pick<Design, 'pieces'>, boxes: Map<string, Box>, rod: Rod): RodRun | null {
  const ceiling = boxes.get(rod.under)
  const wall = boxes.get(rod.from)
  if (!ceiling || !wall) return null
  const y = ceiling.y0 - ASSUMPTIONS.rods.drop
  const [z0, z1] = [Math.max(ceiling.z0, wall.z0), Math.min(ceiling.z1, wall.z1)]
  const z = (z0 + z1) / 2
  const far = design.pieces
    .flatMap((p) => {
      const box = boxes.get(p.id)
      return p.normal === 'x' && p.id !== rod.from && box && box.x0 >= wall.x1 - CONTACT_TOLERANCE && holds(box, y, z) ? [{ id: p.id, box }] : []
    })
    .sort((p, q) => p.box.x0 - q.box.x0)[0]
  if (!far) return null
  const floors = design.pieces.flatMap((p) => {
    const box = boxes.get(p.id)
    return p.normal === 'y' && box && box.y1 <= y && box.x0 < far.box.x0 && box.x1 > wall.x1 && box.z0 <= z && box.z1 >= z ? [box.y1] : []
  })
  return { id: rod.id, ceiling: rod.under, walls: [rod.from, far.id], x0: wall.x1, x1: far.box.x0, y, z, below: y - Math.max(0, ...floors), depth: z1 - z0 }
}

export const rodRuns = (design: Pick<Design, 'pieces' | 'rods'>, boxes: Map<string, Box>): RodRun[] => (design.rods ?? []).flatMap((rod) => rodRun(design, boxes, rod) ?? [])

/** What the rods take from the catalog: for each, the shortest tube that reaches across, to be cut to length (the longest when none does), and a flange at each end. */
export function rodHardware(design: Pick<Design, 'pieces' | 'rods'>, boxes: Map<string, Box>, catalog: Catalog): { hardwareId: string; count: number }[] {
  const tubes = hardwareByRole(catalog, 'closet-rod')
    .filter((h) => h.length)
    .sort((p, q) => p.length! - q.length!)
  const flange = pickHardware(catalog, 'rod-flange')
  return rodRuns(design, boxes).flatMap((run) => {
    const tube = tubes.find((h) => h.length! >= run.x1 - run.x0) ?? tubes.at(-1)
    return [...(tube ? [{ hardwareId: tube.id, count: 1 }] : []), ...(flange ? [{ hardwareId: flange.id, count: 2 }] : [])]
  })
}
