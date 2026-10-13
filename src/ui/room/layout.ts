import type { Design, Dimensions } from '../../domain/design/schema'
import type { Example } from '../../domain/furniture/examples'
import type { Room as CatalogRoom } from '../../domain/furniture/references'

export interface Space {
  width: number
  depth: number
  height: number
}
export type Wall = 'back' | 'front' | 'left' | 'right'
export type Turn = 0 | 90 | 180 | 270
export interface Opening {
  id: string
  kind: 'door' | 'window'
  wall: Wall
  offset: number
  width: number
  height: number
  sill: number
  hinge: 'start' | 'end'
  swing: 'inside' | 'outside' | 'sliding'
}
export interface FurnitureSource {
  identity: string
  code: string | null
  version: number | null
  name: string
  design: Design
  example: Example | null
  room: CatalogRoom
}
interface Placement {
  id: string
  x: number
  z: number
  elevation: number
  turn: Turn
}
export type Item = Placement & ({ kind: 'furniture'; source: FurnitureSource } | { kind: 'block'; name: string; size: Dimensions })
export interface Layout {
  room: Space
  openings: Opening[]
  items: Item[]
  anchorId: string
}
export interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}
export type IssueKind = 'outside' | 'height' | 'overlap' | 'door' | 'window'
export interface Issue {
  item: string
  kind: IssueKind
  message: string
}
export const WALLS: [Wall, string][] = [
  ['back', 'Pared de arriba'],
  ['right', 'Pared derecha'],
  ['front', 'Pared de abajo'],
  ['left', 'Pared izquierda'],
]
export const sizeOf = (i: Item) => (i.kind === 'furniture' ? i.source.design.dimensions : i.size)
export const nameOf = (i: Item) => (i.kind === 'furniture' ? i.source.name : i.name)
export const nextTurn = (t: Turn): Turn => ((t + 90) % 360) as Turn
/** The wall a piece of furniture faces: unturned, its front looks at the bottom wall of the plan. */
export const facing = (t: Turn): Wall => (['front', 'left', 'back', 'right'] as const)[t / 90]
const EPS = 0.01
export const intersects = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - EPS && b0 < a1 - EPS
export const overlaps = (a: Rect, b: Rect) => intersects(a.x0, a.x1, b.x0, b.x1) && intersects(a.z0, a.z1, b.z0, b.z1)
export function rectOf(i: Item): Rect {
  const s = sizeOf(i)
  const [w, d] = i.turn % 180 === 0 ? [s.width, s.depth] : [s.depth, s.width]
  return { x0: i.x - w / 2, x1: i.x + w / 2, z0: i.z - d / 2, z1: i.z + d / 2 }
}
export const validSpace = (s: Space) => [s.width, s.depth, s.height].every((v) => Number.isFinite(v) && v >= 500 && v <= 15000)
export function openingProblem(room: Space, o: Opening, openings: Opening[] = []): string | null {
  const length = o.wall === 'back' || o.wall === 'front' ? room.width : room.depth
  if (![o.offset, o.width, o.height, o.sill].every(Number.isFinite) || o.width <= 0 || o.height <= 0 || o.offset < 0 || o.sill < 0)
    return 'Escribe medidas positivas y una distancia desde la esquina de cero o más.'
  if (o.offset + o.width > length) return 'No cabe en esa pared: revisa el ancho y la distancia desde la esquina.'
  if ((o.kind === 'window' ? o.sill : 0) + o.height > room.height) return 'La abertura rebasa la altura del cuarto.'
  const bottom = o.kind === 'door' ? 0 : o.sill
  if (
    openings.some(
      (other) =>
        other.id !== o.id &&
        other.wall === o.wall &&
        intersects(o.offset, o.offset + o.width, other.offset, other.offset + other.width) &&
        intersects(bottom, bottom + o.height, other.kind === 'door' ? 0 : other.sill, (other.kind === 'door' ? 0 : other.sill) + other.height),
    )
  )
    return 'Se cruza con otra abertura: cambia la pared o su colocación.'
  return null
}

/** Along the wall, then inward: the same coordinates serve all four walls. */
export function atWall(room: Space, wall: Wall, r: Rect) {
  if (wall === 'back') return { a0: r.x0, a1: r.x1, b0: r.z0, b1: r.z1 }
  if (wall === 'front') return { a0: r.x0, a1: r.x1, b0: room.depth - r.z1, b1: room.depth - r.z0 }
  if (wall === 'left') return { a0: r.z0, a1: r.z1, b0: r.x0, b1: r.x1 }
  return { a0: r.z0, a1: r.z1, b0: room.width - r.x1, b1: room.width - r.x0 }
}

export function blocksOpening(room: Space, i: Item, o: Opening): boolean {
  const height = sizeOf(i).height
  const bottom = o.kind === 'door' ? 0 : o.sill
  if (!intersects(i.elevation, i.elevation + height, bottom, bottom + o.height)) return false
  const { a0, a1, b0, b1 } = atWall(room, o.wall, rectOf(i))
  const crosses = intersects(a0, a1, o.offset, o.offset + o.width)
  // A wall opening is obstructed at its plane; a guessed access strip is not a physical collision.
  if (crosses && b0 <= EPS && b1 > EPS) return true
  if (o.kind !== 'door' || o.swing !== 'inside') return false
  const u0 = o.hinge === 'start' ? a0 - o.offset : o.offset + o.width - a1
  const u1 = o.hinge === 'start' ? a1 - o.offset : o.offset + o.width - a0
  if (u1 <= EPS || b1 <= EPS || u0 >= o.width || b0 >= o.width) return false
  // The swept leaf is a quarter disk, not its enclosing square.
  return Math.hypot(Math.max(0, u0), Math.max(0, b0)) < o.width - EPS
}

export function issues(layout: Layout): Issue[] {
  const found: Issue[] = []
  for (const [index, item] of layout.items.entries()) {
    const r = rectOf(item),
      s = sizeOf(item)
    const add = (kind: IssueKind, message: string) => found.push({ item: item.id, kind, message })
    if (r.x0 < -EPS || r.z0 < -EPS || r.x1 > layout.room.width + EPS || r.z1 > layout.room.depth + EPS) add('outside', 'Se sale del cuarto.')
    if (item.elevation < 0 || item.elevation + s.height > layout.room.height + EPS) add('height', 'Rebasa el piso o el techo del cuarto.')
    for (const other of layout.items.slice(index + 1)) {
      if (overlaps(r, rectOf(other)) && intersects(item.elevation, item.elevation + s.height, other.elevation, other.elevation + sizeOf(other).height)) {
        add('overlap', `Ocupa el mismo espacio que ${nameOf(other)}.`)
        found.push({
          item: other.id,
          kind: 'overlap',
          message: `Ocupa el mismo espacio que ${nameOf(item)}.`,
        })
      }
    }
    for (const o of layout.openings)
      if (blocksOpening(layout.room, item, o)) add(o.kind, o.kind === 'door' ? 'Bloquea la puerta o el recorrido de su hoja.' : 'Se coloca delante de la ventana a su misma altura.')
  }
  return found
}

export function freePosition(layout: Layout, item: Item): { x: number; z: number } {
  const r = rectOf(item),
    w = r.x1 - r.x0,
    d = r.z1 - r.z0
  const candidates = layout.items.flatMap((i) => {
    const other = rectOf(i)
    return [
      { x: other.x1 + w / 2 + 80, z: other.z0 + d / 2 },
      { x: other.x0 - w / 2 - 80, z: other.z0 + d / 2 },
    ]
  })
  candidates.push({ x: layout.room.width / 2, z: d / 2 })
  for (let z = d / 2; z <= layout.room.depth - d / 2; z += 100) for (let x = w / 2; x <= layout.room.width - w / 2; x += 100) candidates.push({ x, z })
  for (const position of candidates) {
    const candidate = { ...item, ...position }
    if (!issues({ ...layout, items: [...layout.items, candidate] }).some((issue) => issue.item === item.id)) return position
  }
  return { x: layout.room.width / 2, z: layout.room.depth / 2 }
}

export function snapPosition(layout: Layout, item: Item): { x: number; z: number } {
  const r = rectOf(item)
  let { x, z } = item
  const shift = (low: number, high: number, end: number) => (Math.abs(low) <= 40 ? -low : Math.abs(end - high) <= 40 ? end - high : 0)
  x += shift(r.x0, r.x1, layout.room.width)
  z += shift(r.z0, r.z1, layout.room.depth)
  const moved = { ...item, x, z }
  const candidate = {
    ...layout,
    items: layout.items.map((i) => (i.id === item.id ? moved : i)),
  }
  return issues(candidate).some((issue) => issue.item === item.id) ? { x: item.x, z: item.z } : { x, z }
}

export function exampleLayout(item: Item): Layout {
  const room = { width: 3000, depth: 3500, height: 2500 }
  const layout: Layout = {
    room,
    anchorId: item.id,
    items: [],
    openings: [
      {
        id: 'example-door',
        kind: 'door',
        wall: 'front',
        offset: 150,
        width: 800,
        height: 2100,
        sill: 0,
        hinge: 'start',
        swing: 'inside',
      },
      {
        id: 'example-window',
        kind: 'window',
        wall: 'left',
        offset: 1100,
        width: 1200,
        height: 1100,
        sill: 1000,
        hinge: 'start',
        swing: 'sliding',
      },
    ],
  }
  return { ...layout, items: [{ ...item, ...freePosition(layout, item) }] }
}
