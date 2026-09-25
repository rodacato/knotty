import type { Fix } from '../../domain/fixes/fixes'
import { analyze } from '../../domain/analysis'
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

export interface SceneSlice {
  selection: string | null
  exploded: boolean
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
  toggleExploded(): void
  toggleDimensions(): void
  viewFrom(view: View): void
  toggleProposal(): void
  viewVersion(n: number | null): void
  previewFix(fix: Fix | null): void
}

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
export function sessionTransition(before: DesignState, after: DesignState, catalog: Services['catalog'], previous: SceneChanges): SceneChanges {
  return transition(shownDesign(before), shownDesign(after), catalog, previous.nonce + 1)
}

/** Replaces the session and animates the change, along with whatever else the command resets. */
export function moveTo(set: Set, services: Services, before: DesignState, after: DesignState, also: Partial<Store> = {}) {
  set((s) => ({ state: after, ...also, changes: sessionTransition(before, after, services.catalog, s.changes) }))
}

export const createScene: Slice<SceneSlice> = (set, get) => ({
  selection: null,
  exploded: false,
  dimensions: true,
  view: { name: 'three-quarter', nonce: 0 },
  showProposal: true,
  changes: { added: [], modified: [], removed: [], nonce: 0 },
  viewedVersion: null,
  reveal: 0,
  preview: null,

  select: (id) => set((s) => ({ selection: s.selection === id ? null : id })),
  toggleExploded: () => set((s) => ({ exploded: !s.exploded })),
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
