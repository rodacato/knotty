import { currentPlan } from '../../application/useCases'
import type { Design } from '../../domain/design/schema'
import type { CellPath } from '../../domain/furniture/modules/cabinetCells'
import type { CabinetPart } from '../../domain/furniture/modules/cabinetParts'
import type { FurniturePlan } from '../../domain/furniture/modules/plan'
import type { Slice } from './types'

// The plan the person is changing before applying it: one draft for the plan sheet and the interior view, shown in 3D as it goes.

export interface PlanDraft {
  /** The version it was started on: a new version from anywhere else leaves it behind. */
  version: number
  plan: FurniturePlan
  /** What the plan builds, with the changes made on top of it; null when it cannot be built, and `message` says why. */
  design: Design | null
  message: string | null
  notes: string[]
  /** The plans before each change, to undo one step at a time. */
  steps: FurniturePlan[]
}

export interface PlanDraftSlice {
  planDraft: PlanDraft | null
  /** The cell of the cabinet chosen in the interior view. */
  cell: CellPath | null
  /** The part of the cabinet opened by touching the closed furniture, and the piece that was touched. */
  part: { id: CabinetPart; piece: string | null } | null
  /** One change to the draft, built at once; back to the applied plan, there is no draft. `merge` folds it into the last step, as a drag does. */
  editPlan(plan: FurniturePlan, merge?: boolean): void
  undoPlanEdit(): void
  discardPlanDraft(): void
  applyPlanDraft(): { ok: true; notes: string[] } | { ok: false; message: string }
  selectCell(path: CellPath | null): void
  selectPart(part: CabinetPart | null, piece?: string | null): void
}

const same = (a: FurniturePlan, b: FurniturePlan) => JSON.stringify(a) === JSON.stringify(b)

/** The draft of this version, if any: one started on another version no longer applies. */
export const draftOf = (s: { planDraft: PlanDraft | null; state: { current: number } | null }) => (s.planDraft && s.state && s.planDraft.version === s.state.current ? s.planDraft : null)

export const createPlanDraft: Slice<PlanDraftSlice> = (set, get) => {
  const built = (plan: FurniturePlan, steps: FurniturePlan[]): PlanDraft | null => {
    const { services, state } = get()
    if (!services || !state) return null
    const applied = currentPlan(state).plan
    if (applied && same(applied, plan)) return null
    const r = services.useCases.previewPlan(state, plan)
    return { version: state.current, plan, steps, design: r.ok ? r.design : null, message: r.ok ? null : r.message, notes: r.ok ? r.notes : [] }
  }
  return {
    planDraft: null,
    cell: null,
    part: null,

    editPlan(plan, merge = false) {
      const s = get()
      const draft = draftOf(s)
      const before = draft?.plan ?? (s.state ? currentPlan(s.state).plan : null)
      if (!before || same(before, plan)) return
      set({ planDraft: built(plan, merge && draft ? draft.steps : [...(draft?.steps ?? []), before]) })
    },
    undoPlanEdit() {
      const draft = draftOf(get())
      const previous = draft?.steps.at(-1)
      if (!draft || !previous) return
      const next = built(previous, draft.steps.slice(0, -1))
      set({ planDraft: next })
    },
    discardPlanDraft: () => set({ planDraft: null }),
    applyPlanDraft() {
      const draft = draftOf(get())
      if (!draft) return { ok: true, notes: [] }
      const r = get().applyPlan(draft.plan)
      if (r.ok) set({ planDraft: null })
      return r
    },
    selectCell: (cell) => set({ cell }),
    selectPart: (id, piece = null) => set({ part: id ? { id, piece } : null, ...(id ? { selection: null, focus: null } : {}) }),
  }
}
