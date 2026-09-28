import { bounds, drawerGroups } from '../../domain/design/boxes'
import type { Axis, Design, Piece } from '../../domain/design/schema'
import type { Box } from '../../domain/design/resolve'

// The exploded view as assembly instructions: sub-assemblies apart first, then each opens in the order it is built.
// All in mm and in the design's axes; deterministic, so the same design always comes apart the same way.

export type Offset = [number, number, number]

export interface Explosion {
  /** How far each piece moves, by id. */
  offsets: Map<string, Offset>
  /** The box around every piece once moved. */
  bounds: Box
}

const AXES: Axis[] = ['x', 'y', 'z']
const INDEX: Record<Axis, number> = { x: 0, y: 1, z: 2 }
const TOLERANCE = 0.5

/** What moves as one: a drawer with all its parts, or a single piece. */
interface Unit {
  id: string
  pieces: Piece[]
  box: Box
}

interface Assembly {
  id: string
  units: Unit[]
}

const low = (axis: Axis) => `${axis}0` as const
const high = (axis: Axis) => `${axis}1` as const
const center = (b: Box, axis: Axis) => (b[low(axis)] + b[high(axis)]) / 2
const size = (b: Box, axis: Axis) => b[high(axis)] - b[low(axis)]
const moved = (b: Box, o: Offset): Box => ({ x0: b.x0 + o[0], x1: b.x1 + o[0], y0: b.y0 + o[1], y1: b.y1 + o[1], z0: b.z0 + o[2], z1: b.z1 + o[2] })
const along = (axis: Axis, distance: number): Offset => {
  const o: Offset = [0, 0, 0]
  o[INDEX[axis]] = distance
  return o
}
const add = (a: Offset, b: Offset): Offset => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

/** The gap between parts that come apart: proportional to the furniture, within what reads at a glance. */
export const gapOf = (design: Design) => Math.min(200, Math.max(60, Math.round(0.12 * Math.max(design.dimensions.width, design.dimensions.height, design.dimensions.depth))))

function unitsOf(design: Design, boxes: Map<string, Box>): Unit[] {
  const drawers = new Set(drawerGroups(design))
  const units = new Map<string, Piece[]>()
  for (const p of design.pieces) {
    if (!boxes.has(p.id)) continue
    const id = p.group && drawers.has(p.group) ? `drawer:${p.group}` : p.id
    units.set(id, [...(units.get(id) ?? []), p])
  }
  return [...units].map(([id, pieces]) => ({ id, pieces, box: bounds(pieces.map((p) => boxes.get(p.id)!)) }))
}

const isDrawer = (u: Unit) => u.id.startsWith('drawer:')
const only = (u: Unit) => u.pieces[0]

/** A named group other than a drawer is its own sub-assembly; the rest is the main one. A drawer goes with the sub-assembly it sits in. */
function assembliesOf(units: Unit[]): Assembly[] {
  const named = new Map<string, Unit[]>()
  for (const u of units) if (!isDrawer(u) && only(u).group) named.set(only(u).group!, [...(named.get(only(u).group!) ?? []), u])
  const around = [...named].map(([id, us]) => ({ id, box: bounds(us.map((u) => u.box)) }))
  const inside = (u: Unit, b: Box) => AXES.every((a) => center(u.box, a) > b[low(a)] && center(u.box, a) < b[high(a)])
  const main: Unit[] = []
  for (const u of units) {
    if (!isDrawer(u) && only(u).group) continue
    const host = isDrawer(u) ? around.find((a) => inside(u, a.box)) : undefined
    if (host) named.get(host.id)!.push(u)
    else main.push(u)
  }
  return [{ id: '', units: main }, ...[...named].sort(([a], [b]) => a.localeCompare(b)).map(([id, us]) => ({ id, units: us }))]
}

/** What stands under the lowest floor board (legs, a kick, a bed's drawer bank) comes apart from what rests on it. */
function splitStand(a: Assembly): [Assembly, Assembly] | null {
  const floors = a.units.filter((u) => !isDrawer(u) && only(u).role === 'bottom' && only(u).normal === 'y')
  if (floors.length === 0) return null
  const floor = Math.min(...floors.map((u) => u.box.y0))
  const stand = a.units.filter((u) => u.box.y1 <= floor + TOLERANCE)
  const upper = a.units.filter((u) => u.box.y1 > floor + TOLERANCE)
  return stand.length && upper.length ? [{ id: `${a.id}:stand`, units: stand }, { id: `${a.id}:upper`, units: upper }] : null
}

/** Where the assembly opens: away from its back. Without a back it has no front, and what sits inside it stays. */
function frontOf(units: Unit[], box: Box): { axis: Axis; sign: 1 | -1 } | null {
  const back = units.find((u) => !isDrawer(u) && only(u).role === 'back')
  if (!back) return null
  const axis = only(back).normal
  return { axis, sign: center(back.box, axis) <= center(box, axis) ? 1 : -1 }
}

/** Each unit's move inside its assembly, by what it is. */
function openAssembly(a: Assembly, gap: number, boxOf: (p: Piece) => Box): Map<string, Offset> {
  const box = bounds(a.units.map((u) => u.box))
  const front = frontOf(a.units, box)
  const away = (u: Unit, axis: Axis): 1 | -1 => {
    const d = center(u.box, axis) - center(box, axis)
    if (Math.abs(d) > TOLERANCE) return d > 0 ? 1 : -1
    return front?.axis === axis ? front.sign : 1
  }
  /** Out through the face it closes, past what slides out of the carcass. */
  const outward = (axis: Axis, sign: number) => along(axis, sign * (size(box, axis) / 2 + gap))
  const forward = (share: number): Offset => (front ? along(front.axis, front.sign * size(box, front.axis) * share) : [0, 0, 0])
  const moveOf = (u: Unit): Offset => {
    if (isDrawer(u)) {
      const face = u.pieces.find((p) => p.role === 'drawer-front')!
      return outward(face.normal, center(boxOf(face), face.normal) >= center(u.box, face.normal) ? 1 : -1)
    }
    const p = only(u)
    const n = p.normal
    if (p.role === 'door' || (p.role === 'other' && front?.axis === n)) return outward(n, away(u, n))
    switch (p.role) {
      case 'top':
        return along('y', gap)
      case 'bottom':
      case 'kick':
        return [0, 0, 0]
      case 'shelf':
        return forward(0.5)
      case 'divider':
        return forward(0.25)
      case 'apron':
        return along(n, (away(u, n) * gap) / 2)
      default:
        return along(n, away(u, n) * gap)
    }
  }
  return new Map(a.units.map((u) => [u.id, moveOf(u)]))
}

const explodedBox = (a: Assembly, moves: Map<string, Offset>, shift: Offset) => bounds(a.units.map((u) => moved(u.box, add(moves.get(u.id)!, shift))))

/** The axis two boxes overlap least along, relative to the smaller: the one they sit side by side on. */
function sideBySide(a: Box, b: Box): Axis {
  const ratio = (axis: Axis) => (Math.min(a[high(axis)], b[high(axis)]) - Math.max(a[low(axis)], b[low(axis)])) / Math.max(1, Math.min(size(a, axis), size(b, axis)))
  return AXES.reduce((best, axis) => (ratio(axis) < ratio(best) ? axis : best))
}

export function explode(design: Design, boxes: Map<string, Box>): Explosion {
  const gap = gapOf(design)
  const boxOf = (p: Piece) => boxes.get(p.id)!
  const units = unitsOf(design, boxes)
  const [main, ...subs] = assembliesOf(units)
  const moves = new Map<string, Offset>()
  const shifts = new Map<string, Offset>()
  const place = (a: Assembly, shift: Offset) => a.units.forEach((u) => shifts.set(u.id, shift))

  // The main assembly: its stand stays on the floor and the rest lifts clear of it.
  const split = splitStand(main)
  const parts = split ?? [main]
  for (const part of parts) for (const [id, m] of openAssembly(part, gap, boxOf)) moves.set(id, m)
  let placed: Box
  if (split) {
    const [stand, upper] = split
    place(stand, [0, 0, 0])
    const standBox = explodedBox(stand, moves, [0, 0, 0])
    const lift = Math.max(0, standBox.y1 - explodedBox(upper, moves, [0, 0, 0]).y0) + gap
    place(upper, [0, lift, 0])
    placed = bounds([standBox, explodedBox(upper, moves, [0, lift, 0])])
  } else {
    place(main, [0, 0, 0])
    placed = explodedBox(main, moves, [0, 0, 0])
  }

  // Each sub-assembly moves away from the rest along the side it joins it on, far enough that nothing overlaps.
  const assembled = main.units.length ? bounds(main.units.map((u) => u.box)) : null
  for (const sub of subs) {
    for (const [id, m] of openAssembly(sub, gap, boxOf)) moves.set(id, m)
    const own = explodedBox(sub, moves, [0, 0, 0])
    if (!assembled) {
      place(sub, [0, 0, 0])
      placed = own
      continue
    }
    const box = bounds(sub.units.map((u) => u.box))
    const axis = sideBySide(box, assembled)
    const sign = center(box, axis) >= center(assembled, axis) ? 1 : -1
    const distance = sign > 0 ? placed[high(axis)] + gap - own[low(axis)] : placed[low(axis)] - gap - own[high(axis)]
    const shift = along(axis, distance)
    place(sub, shift)
    placed = bounds([placed, explodedBox(sub, moves, shift)])
  }

  const floor = Math.min(0, placed.y0)
  const offsets = new Map<string, Offset>()
  for (const u of units) {
    const o = add(add(moves.get(u.id)!, shifts.get(u.id)!), [0, -floor, 0])
    for (const p of u.pieces) offsets.set(p.id, o)
  }
  return { offsets, bounds: moved(placed, [0, -floor, 0]) }
}

/** No piece moves: the furniture as built. */
export function assembled(design: Design, boxes: Map<string, Box>): Explosion {
  return { offsets: new Map(design.pieces.map((p) => [p.id, [0, 0, 0]])), bounds: bounds(design.pieces.filter((p) => boxes.has(p.id)).map((p) => boxes.get(p.id)!)) }
}
