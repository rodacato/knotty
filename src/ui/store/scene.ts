import type { Fix } from '../../domain/editing/fixes/fixes'
import { analyze } from '../../domain/checks/analysis'
import type { Design, Piece } from '../../domain/design/schema'
import type { Box } from '../../domain/design/resolve'
import { differences } from '../../domain/design/diff'
import { currentDesign, type DesignState } from '../../domain/session/state'
import type { Services } from '../services'
import type { Set, Slice, Store } from './types'

// What the 3D scene shows and how it moves from one design to the next.

export type View = 'front' | 'side' | 'three-quarter' | 'top'

export interface SceneChanges {
  added: string[]
  modified: string[]
  removed: { piece: Piece; box: Box }[]
  nonce: number
}

export type SceneMode = 'closed' | 'open' | 'exploded'

/** Editing the furniture from outside or from inside (UI-74): a mode the person enters and leaves, apart from how the furniture shows. */
export type EditSide = 'outside' | 'inside'

export interface SceneSlice {
  selection: string | null
  /** The piece the camera turns and zooms about; null frames the whole furniture. Choosing a piece sets it, and the person can leave it while keeping the selection. */
  focus: string | null
  /** Pieces the person hid to see behind them: view only, never saved into the design or its history. */
  hidden: string[]
  /** Pieces a message is about, marked in the 3D until the person picks other ones or leaves: view only, like `hidden`. */
  flagged: string[]
  /** How the furniture shows: as built, with drawers out and doors open, or apart piece by piece. */
  mode: SceneMode
  /** The side being edited; null when the person is only looking. */
  editing: EditSide | null
  /** How the person was looking before editing, to go back to it. */
  beforeEditing: { mode: SceneMode; view: View } | null
  dimensions: boolean
  view: { name: View; nonce: number }
  showProposal: boolean
  /** What changed in the last transition, to animate it: new pieces fall, modified ones glow, removed ones fade. */
  changes: SceneChanges
  /** A previous version being viewed without restoring it. */
  viewedVersion: number | null
  /** Goes up every time the design appears from scratch, to animate from sketch to wood. */
  reveal: number
  /** A solution shown in 3D before applying it. */
  preview: { design: Design; label: string } | null

  select(id: string | null): void
  unfocus(): void
  hide(id: string): void
  /** Marks the pieces; the same ones again clears the mark. */
  flag(ids: string[]): void
  showAll(): void
  setMode(mode: SceneMode): void
  /** Enters editing one side, or leaves it with null; what is not applied is the caller's to settle first. */
  edit(side: EditSide | null): void
  toggleDimensions(): void
  viewFrom(view: View): void
  toggleProposal(): void
  viewVersion(n: number | null): void
  /** Shows a solution or another design in 3D without applying it. */
  previewFix(fix: Pick<Fix, 'design' | 'label'> | null): void
}

/** The hidden pieces this design still has: an id a change removed no longer counts. */
export const hiddenIn = (hidden: string[], design: Design) => hidden.filter((id) => design.pieces.some((p) => p.id === id))

export const shownDesign = (e: DesignState) => e.proposal?.design ?? currentDesign(e)

/** What the scene shows: a previous version, the proposal or the current design. */
export function visibleDesign(s: Pick<Store, 'state' | 'viewedVersion' | 'showProposal'>): Design | null {
  if (!s.state) return null
  if (s.viewedVersion !== null) return s.state.versions.find((v) => v.n === s.viewedVersion)?.design ?? currentDesign(s.state)
  return s.state.proposal && s.showProposal ? s.state.proposal.design : currentDesign(s.state)
}

/** What changes from one design to another, with the box of what disappears to draw its ghost. */
export function transition(before: Design, after: Design, catalog: Services['catalog'], nonce: number): SceneChanges {
  const ga = analyze(before, catalog)
  const gb = analyze(after, catalog)
  if (!ga.valid || !gb.valid) return { added: [], modified: [], removed: [], nonce }
  const d = differences(before, ga.geo.boxes, after, gb.geo.boxes)
  const removed = d.removed.map((id) => ({ piece: before.pieces.find((p) => p.id === id)!, box: ga.geo.boxes.get(id)! }))
  return { added: d.added, modified: d.changed, removed, nonce }
}

/** The scene change from one session to the next, each seen through the design it shows (its proposal, if any). */
function sessionTransition(before: DesignState, after: DesignState, catalog: Services['catalog'], previous: SceneChanges): SceneChanges {
  return transition(shownDesign(before), shownDesign(after), catalog, previous.nonce + 1)
}

/** Replaces the session and animates the change, along with whatever else the command resets. */
export function moveTo(set: Set, services: Services, before: DesignState, after: DesignState, also: Partial<Store> = {}) {
  set((s) => ({ state: after, ...also, changes: sessionTransition(before, after, services.catalog, s.changes) }))
}

export const createScene: Slice<SceneSlice> = (set, get) => ({
  selection: null,
  focus: null,
  hidden: [],
  flagged: [],
  mode: 'closed',
  editing: null,
  beforeEditing: null,
  dimensions: true,
  view: { name: 'three-quarter', nonce: 0 },
  showProposal: true,
  changes: { added: [], modified: [], removed: [], nonce: 0 },
  viewedVersion: null,
  reveal: 0,
  preview: null,

  select: (id) =>
    set((s) => {
      const selection = s.selection === id ? null : id
      return { selection, focus: selection }
    }),
  unfocus: () => set({ focus: null }),
  hide: (id) => set((s) => ({ hidden: s.hidden.includes(id) ? s.hidden : [...s.hidden, id], selection: s.selection === id ? null : s.selection })),
  showAll: () => set({ hidden: [] }),
  flag: (ids) => set((s) => ({ flagged: ids.length === s.flagged.length && ids.every((id) => s.flagged.includes(id)) ? [] : ids })),
  // Apart or open, the furniture reads best from the front three-quarter view.
  setMode: (mode) => set((s) => (s.mode === mode ? {} : { mode, ...(mode === 'closed' ? {} : { view: { name: 'three-quarter', nonce: s.view.nonce + 1 } }) })),
  // Outside is edited on the closed furniture; inside, from the front with its fronts left out. Leaving goes back to how the person was looking.
  edit: (side) =>
    set((s) => {
      if (side === s.editing) return {}
      const back = s.beforeEditing ?? { mode: s.mode, view: s.view.name }
      const common = { editing: side, cell: null, part: null, selection: null, focus: null }
      if (!side) return { ...common, beforeEditing: null, mode: back.mode, view: { name: back.view, nonce: s.view.nonce + 1 } }
      return { ...common, beforeEditing: back, mode: 'closed' as const, ...(side === 'inside' ? { view: { name: 'front' as const, nonce: s.view.nonce + 1 } } : {}) }
    }),
  toggleDimensions: () => set((s) => ({ dimensions: !s.dimensions })),
  viewFrom: (name) => set((s) => ({ view: { name, nonce: s.view.nonce + 1 } })),

  toggleProposal() {
    const before = visibleDesign(get())
    set((s) => ({ showProposal: !s.showProposal }))
    const after = visibleDesign(get())
    const { services } = get()
    if (services && before && after) set((s) => ({ changes: transition(before, after, services.catalog, s.changes.nonce + 1) }))
  },

  viewVersion(viewedVersion) {
    const before = visibleDesign(get())
    set({ viewedVersion, selection: null })
    const after = visibleDesign(get())
    const { services } = get()
    if (services && before && after && before !== after) set((s) => ({ changes: transition(before, after, services.catalog, s.changes.nonce + 1) }))
  },

  previewFix: (fix) => set({ preview: fix ? { design: fix.design, label: fix.label } : null, viewedVersion: null }),
})
