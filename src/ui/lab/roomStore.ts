import { create } from 'zustand'
import { centerOf, DOOR, nextTurn, rectOf, ROOM, snap, WINDOW, type Opening, type Placed, type Room, type Size } from './room'

// What the «Cuarto» prototype holds while it is open: the room and the pieces on its floor, in memory only.

interface RoomStore {
  room: Room
  items: Placed[]
  openings: Opening[]
  selected: string | null
  /** A piece is being dragged: the camera holds still meanwhile. */
  dragging: boolean
  setDragging(dragging: boolean): void
  setRoom(change: Partial<Room>): void
  add(code: string): void
  move(key: string, at: Pick<Placed, 'x' | 'z'>): void
  /** Where a dropped piece rests: stuck to a wall or a neighbour's edge within reach. */
  settle(key: string, sizeOf: (code: string) => Size | undefined): void
  turn(key: string): void
  remove(key: string): void
  select(key: string | null): void
  addOpening(kind: Opening['kind']): void
  changeOpening(key: string, change: Partial<Opening>): void
  removeOpening(key: string): void
}

let counter = 0

export const useRoom = create<RoomStore>()((set) => ({
  room: ROOM,
  items: [],
  openings: [],
  selected: null,
  dragging: false,
  setDragging: (dragging) => set({ dragging }),
  setRoom: (change) => set((s) => ({ room: { ...s.room, ...change } })),
  add: (code) =>
    set((s) => {
      const key = `${code}-${++counter}`
      return { items: [...s.items, { key, code, ...centerOf(s.room), turn: 0 }], selected: key }
    }),
  move: (key, at) => set((s) => ({ items: s.items.map((i) => (i.key === key ? { ...i, ...at } : i)) })),
  settle: (key, sizeOf) =>
    set((s) => {
      const item = s.items.find((i) => i.key === key)
      const size = item && sizeOf(item.code)
      if (!item || !size) return {}
      const others = s.items.filter((i) => i.key !== key).flatMap((i) => {
        const other = sizeOf(i.code)
        return other ? [rectOf(i, other)] : []
      })
      const at = snap(item, size, s.room, others)
      return { items: s.items.map((i) => (i.key === key ? { ...i, ...at } : i)) }
    }),
  turn: (key) => set((s) => ({ items: s.items.map((i) => (i.key === key ? { ...i, turn: nextTurn(i.turn) } : i)) })),
  remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key), selected: s.selected === key ? null : s.selected })),
  select: (selected) => set({ selected }),
  addOpening: (kind) =>
    set((s) => {
      const shape = kind === 'door' ? DOOR : WINDOW
      return { openings: [...s.openings, { key: `${kind}-${++counter}`, wall: 'back', offset: Math.max(0, (s.room.width - shape.width) / 2), ...shape }] }
    }),
  changeOpening: (key, change) => set((s) => ({ openings: s.openings.map((o) => (o.key === key ? { ...o, ...change } : o)) })),
  removeOpening: (key) => set((s) => ({ openings: s.openings.filter((o) => o.key !== key) })),
}))
