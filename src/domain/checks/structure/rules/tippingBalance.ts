import { isDrawerPart, type Design, type Piece } from '../../../design/schema'
import type { Box, Geometry } from '../../../design/resolve'
import { ASSUMPTIONS } from '../assumptions'

/** What holds a piece of storage furniture up and what pulls it forward, in kg·m about the front edge of what it stands on. */
export interface TippingBalance {
  holds: number
  /** Every drawer full and fully out and every door open. */
  pulls: number
  /** The same, with a child hanging from the highest drawer within reach. */
  pullsWithChild: number
}

const span = (b: Box) => [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0]
const union = (boxes: Box[]): Box => ({
  x0: Math.min(...boxes.map((b) => b.x0)), x1: Math.max(...boxes.map((b) => b.x1)),
  y0: Math.min(...boxes.map((b) => b.y0)), y1: Math.max(...boxes.map((b) => b.y1)),
  z0: Math.min(...boxes.map((b) => b.z0)), z1: Math.max(...boxes.map((b) => b.z1)),
})

/**
 * The criteria of the ASTM F2057-23 stability test in a simplified model: the carcass holds, its drawers (full of clothes, fully out) and doors (open at 90°) pull,
 * and a child hangs from the edge of the highest drawer within reach. Null when it cannot be told where the furniture stands or which way it faces.
 */
export function tippingBalance(design: Design, geo: Geometry, onFloor: Box[]): TippingBalance | null {
  const { density, drawerLoad, child } = ASSUMPTIONS.tipping
  const box = (p: Piece) => geo.boxes.get(p.id)
  const fronts = design.pieces.filter((p) => p.role === 'drawer-front' || p.role === 'door')
  const sides = design.pieces.filter((p) => p.role === 'side')
  if (!onFloor.length || !fronts.length || !sides.length) return null

  const middle = (b: Box) => (b.z0 + b.z1) / 2
  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length
  const facing = mean(fronts.map((p) => middle(box(p)!))) >= mean(sides.map((p) => middle(box(p)!))) ? 1 : -1
  const ahead = (z: number) => facing * z
  const frontEdge = (b: Box) => (facing > 0 ? b.z1 : -b.z0)
  const pivot = Math.max(...onFloor.map(frontEdge))
  const mass = (b: Box) => (span(b).reduce((v, s) => v * s, 1) * density) / 1e9

  const holds = design.pieces.filter((p) => !isDrawerPart(p) && p.role !== 'door').reduce((sum, p) => sum + mass(box(p)!) * (pivot - ahead(middle(box(p)!))), 0)

  const drawers = new Map<string, Piece[]>()
  for (const p of design.pieces) if (isDrawerPart(p) && p.group) drawers.set(p.group, [...(drawers.get(p.group) ?? []), p])
  let pulls = 0
  let childLever = 0
  let highest = 0
  for (const parts of drawers.values()) {
    const boxes = parts.map((p) => box(p)!)
    const whole = union(boxes)
    const bottom = parts.find((p) => p.role === 'drawer-bottom')
    const sideBoxes = parts.filter((p) => p.role === 'drawer-side').map((p) => box(p)!)
    // Inside of the drawer, from its own boards: between its walls and above its bottom.
    const wall = Math.min(...sideBoxes.flatMap(span))
    const [bottomWidth, bottomThickness, bottomLength] = bottom ? span(box(bottom)!) : [0, 0, 0]
    const inside = Math.max(0, bottomWidth - 2 * wall) * Math.max(0, bottomLength - 2 * wall) * Math.max(0, Math.max(...sideBoxes.map((b) => span(b)[1])) - bottomThickness)
    const out = whole.z1 - whole.z0
    const weight = boxes.reduce((sum, b) => sum + mass(b), 0) + (inside * drawerLoad) / 1e9
    pulls += weight * (ahead(middle(whole)) + out - pivot)
    if (whole.y1 <= child.reach && whole.y1 > highest) {
      highest = whole.y1
      childLever = frontEdge(whole) + out - pivot
    }
  }
  for (const p of design.pieces.filter((p) => p.role === 'door')) {
    const b = box(p)!
    pulls += mass(b) * (frontEdge(b) + span(b)[0] / 2 - pivot)
  }
  return { holds: holds / 1000, pulls: pulls / 1000, pullsWithChild: (pulls + child.mass * childLever) / 1000 }
}
