import type { PieceEdit, PieceEditResult } from '../../application/useCases'
import type { Notice } from '../../application/notices'
import type { Fix } from '../../domain/editing/fixes/fixes'
import type { TrayItem } from '../../domain/session/tray/tray'
import type { Example } from '../../domain/furniture/examples'
import type { FurniturePlan } from '../../domain/furniture/modules/plan'
import type { Axis } from '../../domain/design/schema'
import type { FinishId } from '../../domain/materials/finishes'
import type { DesignKind } from '../../domain/design/kind'
import { questionAnswerKey, type DesignState } from '../../domain/session/state'
import type { Services } from '../services'
import { moveTo, shownDesign, transition } from './scene'
import type { Get, Slice } from './types'

// The open design and the commands that change it without asking the expert.

type Phase = 'home' | 'capture' | 'analyzing' | 'studio'

export interface SessionSlice {
  services: Services | null
  state: DesignState | null
  phase: Phase

  start(services: Services): void
  newDesign(): void
  startCapture(): void
  /** One of the home screen's examples, a ready design or a plan. */
  fromExample(example: Example): void
  /** A whole session from elsewhere (the bench) becomes the current design. */
  openState(state: DesignState): void
  applyProposal(): void
  /** An option answered from the chat: Knotty builds it when it can, otherwise it goes to the expert. */
  chooseOption(messageId: string, question: number, option: string): Promise<void>
  discardProposal(): void
  backToVersion(n: number): void
  confirmPiece(id: string): void
  addNote(text: string): void
  removeNote(id: string): void
  removeDecision(topic: string): void
  /** Rebuilds the design from an edited plan; the result says why when it cannot be built. */
  applyPlan(plan: FurniturePlan): { ok: true; notes: string[] } | { ok: false; message: string }
  applyFix(fix: Fix): void
  /** Puts an item in the tray, replaces the one from the same origin, or takes it out. */
  toggleTray(item: TrayItem): void
  acceptNotice(notice: Notice): void
  reopenNotice(notice: Notice): void
  restoreFromVersion(n: number, ids: string[]): { ok: true } | { ok: false; message: string }
  undoChange(n: number): { ok: true } | { ok: false; message: string }
  /** A hand edit on one piece; when it cannot hold, the result says why and what could. */
  editPiece(id: string, edit: PieceEdit): PieceEditResult
  resizeFurniture(axis: Axis, value: number): PieceEditResult
  /** The finish picked in Materiales, as a version of its own. */
  chooseFinish(finish: FinishId): void
  /** What the furniture is; `redo` when it is another module's and has to be designed again. */
  chooseKind(kind: DesignKind): { ok: true } | { ok: false; redo: true } | { ok: false; message: string }
}

const NO_DESIGN = 'No hay un diseño abierto.'

/** Runs a command on the open design; before `start` or without a design it does nothing, or answers `closed`. */
function withSession(get: Get, command: (services: Services, state: DesignState) => void): void
function withSession<R>(get: Get, command: (services: Services, state: DesignState) => R, closed: R): R
function withSession<R>(get: Get, command: (services: Services, state: DesignState) => R, closed?: R) {
  const { services, state } = get()
  return services && state ? command(services, state) : closed
}

export const createSession: Slice<SessionSlice> = (set, get) => ({
  services: null,
  state: null,
  phase: 'home',

  start(services) {
    const state = services.useCases.load()
    set({ services, state, phase: state ? 'studio' : 'home', reveal: state ? 1 : 0, vault: services.preferences.vaultState(), catalogSettings: services.materials.settings() })
  },

  newDesign() {
    get().controller?.abort()
    get().services?.useCases.newDesign()
    set({ state: null, phase: 'capture', selection: null, exploded: false, reconstructionError: null, draft: null, thinking: false, stage: null })
  },

  startCapture: () => set({ phase: 'capture', reconstructionError: null, draft: null }),

  openState(state) {
    const { services } = get()
    if (!services) return
    set((s) => ({ state: services.useCases.adopt(state), phase: 'studio', viewedVersion: null, selection: null, preview: null, reveal: s.reveal + 1, view: { name: 'three-quarter', nonce: s.view.nonce + 1 } }))
  },

  fromExample(example) {
    const { services } = get()
    if (!services) return
    set((s) => ({ state: services.useCases.openExample(example), phase: 'studio', reveal: s.reveal + 1, view: { name: 'three-quarter', nonce: s.view.nonce + 1 } }))
  },

  toggleTray: (item) => withSession(get, (services, state) => set({ state: services.useCases.toggleTray(state, item) })),

  applyProposal: () => withSession(get, (services, state) => set({ state: services.useCases.applyProposal(state), viewedVersion: null })),

  chooseOption(messageId, question, option) {
    const { services, state, thinking } = get()
    if (!services || !state || thinking) return Promise.resolve()
    const fixed = services.useCases.answerWithFix(state, messageId, question, option)
    if (!fixed) return get().adjust(option, `${messageId}#${questionAnswerKey(question)}`)
    moveTo(set, services, state, fixed, { preview: null, viewedVersion: null })
    return Promise.resolve()
  },

  discardProposal: () => withSession(get, (services, state) => moveTo(set, services, state, services.useCases.discardProposal(state))),

  backToVersion: (n) =>
    withSession(get, (services, state) => {
      const { viewedVersion } = get()
      const fresh = services.useCases.backToVersion(state, n)
      const before = viewedVersion !== null ? (state.versions.find((v) => v.n === viewedVersion)?.design ?? shownDesign(state)) : shownDesign(state)
      set((s) => ({ state: fresh, viewedVersion: null, changes: transition(before, shownDesign(fresh), services.catalog, s.changes.nonce + 1) }))
    }),

  confirmPiece: (id) => withSession(get, (services, state) => moveTo(set, services, state, services.useCases.confirmPiece(state, id))),
  chooseFinish: (finish) => withSession(get, (services, state) => moveTo(set, services, state, services.useCases.chooseFinish(state, finish))),
  chooseKind: (kind) =>
    withSession(
      get,
      (services, state) => {
        const r = services.useCases.chooseKind(state, kind)
        if (!r.ok) return r
        moveTo(set, services, state, r.state, { viewedVersion: null })
        return { ok: true as const }
      },
      { ok: false as const, message: NO_DESIGN },
    ),
  addNote: (text) => withSession(get, (services, state) => set({ state: services.useCases.addRequirement(state, text) })),
  removeNote: (id) => withSession(get, (services, state) => set({ state: services.useCases.removeRequirement(state, id) })),
  removeDecision: (topic) => withSession(get, (services, state) => set({ state: services.useCases.removeDecision(state, topic) })),
  applyFix: (fix) => withSession(get, (services, state) => moveTo(set, services, state, services.useCases.applyFix(state, fix), { preview: null, viewedVersion: null })),
  acceptNotice: (notice) => withSession(get, (services, state) => set({ state: services.useCases.acceptNotice(state, notice.findings, notice.title) })),
  reopenNotice: (notice) => withSession(get, (services, state) => set({ state: services.useCases.reopenNotice(state, notice.findings) })),

  restoreFromVersion: (n, ids) =>
    withSession(
      get,
      (services, state) => {
        const r = services.useCases.restoreFromVersion(state, n, ids)
        if (!r.ok) return r
        moveTo(set, services, state, r.state, { viewedVersion: null })
        return { ok: true as const }
      },
      { ok: false as const, message: NO_DESIGN },
    ),

  undoChange: (n) =>
    withSession(
      get,
      (services, state) => {
        const r = services.useCases.undoChange(state, n)
        if (!r.ok) return r
        moveTo(set, services, state, r.state, { viewedVersion: null })
        return { ok: true as const }
      },
      { ok: false as const, message: NO_DESIGN },
    ),

  editPiece: (id, edit) =>
    withSession(
      get,
      (services, state) => {
        const r = services.useCases.editPiece(state, id, edit)
        if (r.ok) moveTo(set, services, state, r.state, { viewedVersion: null })
        return r
      },
      { ok: false, message: NO_DESIGN, alternatives: [] },
    ),

  resizeFurniture: (axis, value) =>
    withSession(
      get,
      (services, state) => {
        const r = services.useCases.resizeFurniture(state, axis, value)
        if (r.ok) moveTo(set, services, state, r.state, { viewedVersion: null })
        return r
      },
      { ok: false, message: NO_DESIGN, alternatives: [] },
    ),

  applyPlan: (plan) =>
    withSession(
      get,
      (services, state) => {
        const r = services.useCases.applyPlan(state, plan)
        if (!r.ok) return r
        moveTo(set, services, state, r.state, { viewedVersion: null })
        return { ok: true as const, notes: r.notes }
      },
      { ok: false as const, message: NO_DESIGN },
    ),
})
