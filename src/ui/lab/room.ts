// The «Cuarto» prototype: fichas laid out on a room's floor, seen from above. Nothing here builds or edits furniture; it only places it.
// The floor runs from x 0 (the left wall) to the room's width and from z 0 (the back wall) to its depth, in mm. A piece stands at its center.

export interface Room {
  width: number
  depth: number
  height: number
}

/** A quarter turn at a time: at 0 a piece faces the room, its back to the back wall. */
export type Turn = 0 | 90 | 180 | 270

export interface Placed {
  key: string
  code: string
  x: number
  z: number
  turn: Turn
}

/** A piece's own width (along x) and depth (along z), unturned; its height, when it matters (under a window). */
export interface Size {
  width: number
  depth: number
  height?: number
}

/** The walls as the 3D view shows the room: the back one at z 0, the left one at x 0. */
export type Wall = 'back' | 'left' | 'right' | 'front'

/** A door or a window in a wall: `offset` runs along the wall from its back or left end; `sill` is how high a window starts. */
export interface Opening {
  key: string
  kind: 'door' | 'window'
  wall: Wall
  offset: number
  width: number
  height: number
  sill: number
}

export const DOOR: Omit<Opening, 'key' | 'wall' | 'offset'> = { kind: 'door', width: 900, height: 2100, sill: 0 }
export const WINDOW: Omit<Opening, 'key' | 'wall' | 'offset'> = { kind: 'window', width: 1200, height: 1200, sill: 900 }

/** How far into the room a window reaches: a piece within it that rises past the sill covers the window. A prototype's guess, not a rule of the docs. */
export const WINDOW_REACH = 600

export interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}

export const ROOM: Room = { width: 3000, depth: 3000, height: 2500 }

/** How close an edge comes before it sticks to a wall or a neighbour, in mm. */
export const SNAP = 50

export const nextTurn = (turn: Turn): Turn => ((turn + 90) % 360) as Turn

export function footprint({ width, depth }: Size, turn: Turn): Size {
  return turn % 180 === 0 ? { width, depth } : { width: depth, depth: width }
}

export function rectOf(item: Pick<Placed, 'x' | 'z' | 'turn'>, size: Size): Rect {
  const f = footprint(size, item.turn)
  return { x0: item.x - f.width / 2, x1: item.x + f.width / 2, z0: item.z - f.depth / 2, z1: item.z + f.depth / 2 }
}

export const outside = (room: Room, r: Rect) => r.x0 < 0 || r.z0 < 0 || r.x1 > room.width || r.z1 > room.depth

/** Two pieces that only touch do not overlap: standing side by side is the point. */
export const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1

/** The floor an opening keeps clear: a door, the square its leaf sweeps; a window, a strip along the wall as deep as `WINDOW_REACH`. */
export function openingRect(room: Room, o: Opening): Rect {
  const reach = o.kind === 'door' ? o.width : WINDOW_REACH
  const [a, b] = [o.offset, o.offset + o.width]
  if (o.wall === 'back') return { x0: a, x1: b, z0: 0, z1: reach }
  if (o.wall === 'front') return { x0: a, x1: b, z0: room.depth - reach, z1: room.depth }
  if (o.wall === 'left') return { x0: 0, x1: reach, z0: a, z1: b }
  return { x0: room.width - reach, x1: room.width, z0: a, z1: b }
}

export type Conflict = 'outside' | 'overlap' | 'door' | 'window'

export const CONFLICT_TEXT: Record<Conflict, string> = {
  outside: 'se sale del cuarto',
  overlap: 'se encima con otro',
  door: 'estorba una puerta',
  window: 'tapa una ventana',
}

/** What is wrong with each piece, by key: it sticks out of the room, stands on another, stands where a door opens, or rises in front of a window past its sill. */
export function conflicts(room: Room, items: Placed[], sizeOf: (code: string) => Size | undefined, openings: Opening[] = []): Map<string, Conflict[]> {
  const rects = items.flatMap((item) => {
    const size = sizeOf(item.code)
    return size ? [{ key: item.key, rect: rectOf(item, size), height: size.height ?? 0 }] : []
  })
  const found = new Map<string, Conflict[]>()
  const flag = (key: string, c: Conflict) => found.set(key, [...new Set([...(found.get(key) ?? []), c])])
  for (const [i, a] of rects.entries()) {
    if (outside(room, a.rect)) flag(a.key, 'outside')
    for (const b of rects.slice(i + 1))
      if (overlaps(a.rect, b.rect)) {
        flag(a.key, 'overlap')
        flag(b.key, 'overlap')
      }
    for (const o of openings)
      if (overlaps(a.rect, openingRect(room, o)) && (o.kind === 'door' || a.height > o.sill)) flag(a.key, o.kind)
  }
  return found
}

/** The shift along one axis that brings the nearest edge onto a target, if one is within reach. */
function nearest(edges: [number, number], targets: number[], reach: number): number {
  let best = 0
  let distance = reach + 1
  for (const edge of edges)
    for (const target of targets) {
      const d = Math.abs(target - edge)
      if (d <= reach && d < distance) [best, distance] = [target - edge, d]
    }
  return best
}

/** Where a piece rests after being dropped: each axis sticks to a wall or a neighbour's edge when one is within `SNAP`. */
export function snap(item: Placed, size: Size, room: Room, others: Rect[], reach = SNAP): Pick<Placed, 'x' | 'z'> {
  const r = rectOf(item, size)
  const xs = [0, room.width, ...others.flatMap((o) => [o.x0, o.x1])]
  const zs = [0, room.depth, ...others.flatMap((o) => [o.z0, o.z1])]
  return { x: item.x + nearest([r.x0, r.x1], xs, reach), z: item.z + nearest([r.z0, r.z1], zs, reach) }
}

/** A new piece goes in the middle of the room, as a starting point to drag it from. */
export const centerOf = (room: Room): Pick<Placed, 'x' | 'z'> => ({ x: room.width / 2, z: room.depth / 2 })
