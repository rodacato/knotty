import { create } from 'zustand'
import { WALL_CABINET_MOUNT_HEIGHT } from '../../domain/checks/typology/constraints'
import { exampleLayout, freePosition, keptInside, nextTurn, openingProblem, WALLS, snapPosition, type FurnitureSource, type Item, type Layout, type Opening, type Space } from './layout'

interface RoomStore {
  layout: Layout | null
  selected: string | null
  view: 'scene' | 'plan'
  panel: 'combine' | 'item' | 'space'
  past: Layout[]
  future: Layout[]
  editingId: string | null
  returnFocus: HTMLElement | null
  launch(source: FurnitureSource, opener?: HTMLElement): void
  add(source: FurnitureSource): void
  addBlock(name: string, size: { width: number; depth: number; height: number }): void
  select(id: string): void
  setView(view: RoomStore['view']): void
  setPanel(panel: RoomStore['panel']): void
  setRoom(room: Space): void
  setOpening(opening: Opening): void
  removeOpening(id: string): void
  addOpening(kind: Opening['kind']): void
  move(id: string, changes: Partial<Pick<Item, 'x' | 'z' | 'elevation'>>, remember?: boolean): void
  beginMove(): void
  settle(id: string): void
  turn(id: string): void
  duplicate(id: string): void
  remove(id: string): void
  replace(id: string, source: FurnitureSource): void
  edit(id: string): void
  undo(): void
  redo(): void
}

const furniture = (source: FurnitureSource): Item => ({
  kind: 'furniture',
  id: crypto.randomUUID(),
  source,
  x: 0,
  z: 0,
  turn: 0,
  elevation: source.design.kind === 'wallCabinet' ? WALL_CABINET_MOUNT_HEIGHT : 0,
})

export const useRoom = create<RoomStore>((set, get) => {
  const commit = (layout: Layout) => {
    const previous = get().layout
    set({
      layout,
      past: previous ? [...get().past.slice(-39), previous] : [],
      future: [],
    })
  }
  const changeItem = (id: string, change: (item: Item) => Item) => {
    const layout = get().layout
    if (layout)
      commit({
        ...layout,
        items: layout.items.map((i) => (i.id === id ? change(i) : i)),
      })
  }
  const restore = (layout: Layout, past: Layout[], future: Layout[]) =>
    set({
      layout,
      past,
      future,
      selected: layout.items.some((i) => i.id === get().selected) ? get().selected : (layout.items.at(-1)?.id ?? null),
    })
  return {
    layout: null,
    selected: null,
    view: 'scene',
    panel: 'combine',
    past: [],
    future: [],
    editingId: null,
    returnFocus: null,
    launch(source, opener) {
      const { layout, editingId } = get()
      const placed = layout?.items.filter((i) => i.kind === 'furniture' && i.source.identity === source.identity) ?? []
      const anchor = placed.find((i) => i.id === editingId) ?? placed.find((i) => i.id === layout?.anchorId) ?? placed[0]
      if (layout && anchor?.kind === 'furniture') {
        if (anchor.source.design !== source.design || layout.anchorId !== anchor.id)
          commit({
            ...layout,
            anchorId: anchor.id,
            items: layout.items.map((i) => (i.id === anchor.id ? { ...i, source } : i)),
          })
        set({
          selected: anchor.id,
          returnFocus: opener ?? null,
          editingId: null,
        })
        return
      }
      const item = furniture(source)
      const next = layout
        ? {
            ...layout,
            anchorId: item.id,
            items: [...layout.items, { ...item, ...freePosition(layout, item) }],
          }
        : exampleLayout(item)
      if (layout) commit(next)
      else set({ layout: next, past: [], future: [] })
      set({
        selected: item.id,
        returnFocus: opener ?? null,
        panel: 'combine',
        view: 'scene',
        editingId: null,
      })
    },
    add(source) {
      const layout = get().layout
      if (!layout) return
      const item = furniture(source)
      commit({
        ...layout,
        items: [...layout.items, { ...item, ...freePosition(layout, item) }],
      })
      set({ selected: item.id })
    },
    addBlock(name, size) {
      const layout = get().layout
      if (!layout) return
      const item: Item = {
        kind: 'block',
        id: crypto.randomUUID(),
        name,
        size,
        x: 0,
        z: 0,
        turn: 0,
        elevation: 0,
      }
      commit({
        ...layout,
        items: [...layout.items, { ...item, ...freePosition(layout, item) }],
      })
      set({ selected: item.id, panel: 'item', view: 'plan' })
    },
    select: (selected) => set({ selected, panel: 'item' }),
    setView: (view) => set({ view }),
    setPanel: (panel) => set({ panel }),
    setRoom(room) {
      const layout = get().layout
      if (layout) commit({ ...layout, room })
    },
    setOpening(opening) {
      const layout = get().layout
      if (layout)
        commit({
          ...layout,
          openings: layout.openings.map((o) => (o.id === opening.id ? opening : o)),
        })
    },
    removeOpening(id) {
      const layout = get().layout
      if (layout)
        commit({
          ...layout,
          openings: layout.openings.filter((o) => o.id !== id),
        })
    },
    addOpening(kind) {
      const layout = get().layout
      if (!layout) return
      const width = Math.min(kind === 'door' ? 800 : 1200, layout.room.width)
      const height = Math.min(kind === 'door' ? 2100 : 1000, layout.room.height)
      const sill = kind === 'window' ? Math.max(0, Math.min(1000, layout.room.height - height)) : 0
      let opening: Opening = { id: crypto.randomUUID(), kind, wall: 'back', offset: (layout.room.width - width) / 2, width, height, sill, hinge: 'start', swing: 'inside' }
      const candidates = WALLS.flatMap(([wall]) => {
        const length = wall === 'back' || wall === 'front' ? layout.room.width : layout.room.depth
        const offsets = [(length - width) / 2]
        for (let offset = 50; offset + width <= length; offset += 100) offsets.push(offset)
        return offsets.map((offset) => ({ ...opening, wall, offset }))
      })
      opening = candidates.find((candidate) => !openingProblem(layout.room, candidate, layout.openings)) ?? opening
      commit({ ...layout, openings: [...layout.openings, opening] })
      set({ panel: 'space', view: 'plan' })
    },
    move(id, changes, remember = true) {
      const layout = get().layout
      if (!layout) return
      const next = {
        ...layout,
        items: layout.items.map((i) => (i.id === id ? { ...i, ...changes } : i)),
      }
      if (remember) commit(next)
      else set({ layout: next })
    },
    beginMove() {
      const layout = get().layout
      if (layout) set({ past: [...get().past.slice(-39), layout], future: [] })
    },
    settle(id) {
      const layout = get().layout,
        item = layout?.items.find((i) => i.id === id)
      if (layout && item) get().move(id, snapPosition(layout, item), false)
    },
    turn: (id) => changeItem(id, (i) => keptInside(get().layout!.room, { ...i, turn: nextTurn(i.turn) })),
    duplicate(id) {
      const layout = get().layout,
        original = layout?.items.find((i) => i.id === id)
      if (!layout || !original) return
      const item = { ...original, id: crypto.randomUUID() }
      commit({
        ...layout,
        items: [...layout.items, { ...item, ...freePosition(layout, item) }],
      })
      set({ selected: item.id })
    },
    remove(id) {
      const layout = get().layout
      if (layout) {
        commit({ ...layout, items: layout.items.filter((i) => i.id !== id) })
        set({ selected: null })
      }
    },
    replace: (id, source) =>
      changeItem(id, (i) => ({
        ...furniture(source),
        id: i.id,
        x: i.x,
        z: i.z,
        turn: i.turn,
        elevation: source.design.kind === 'wallCabinet' ? i.elevation || WALL_CABINET_MOUNT_HEIGHT : 0,
      })),
    edit: (editingId) => set({ editingId }),
    undo() {
      const { layout, past, future } = get()
      if (layout && past.length) restore(past[past.length - 1], past.slice(0, -1), [layout, ...future])
    },
    redo() {
      const { layout, past, future } = get()
      if (layout && future.length) restore(future[0], [...past, layout], future.slice(1))
    },
  }
})
