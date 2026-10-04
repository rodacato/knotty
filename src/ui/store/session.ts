import type { PieceEdit, PieceEditResult, WorkshopResult } from '../../application/useCases'
import type { Notice } from '../../application/notices'
import type { Fix } from '../../domain/editing/fixes/fixes'
import type { TrayItem } from '../../domain/session/tray/tray'
import type { Base, Example } from '../../domain/furniture/examples'
import type { FurniturePlan } from '../../domain/furniture/modules/plan'
import type { SavingSearch } from '../../domain/furniture/saving/saving'
import { applySettings } from '../../domain/materials/catalog'
import type { Axis } from '../../domain/design/schema'
import type { FinishId } from '../../domain/materials/finishes'
import type { EdgeProfileId } from '../../domain/materials/edgeProfiles'
import type { ChoosableJoint, JointGroupId } from '../../domain/editing/joints/choice'
import type { Edge } from '../../domain/design/schema'
import type { DesignKind } from '../../domain/design/kind'
import { questionAnswerKey, type DesignState } from '../../domain/session/state'
import { debugAccess } from '../debug/access'
import type { Services } from '../services'
import { moveTo, shownDesign, transition } from './scene'
import type { Get, Set, Slice, Store } from './types'

// The open design and the commands that change it without asking the expert.

type Phase = 'home' | 'capture' | 'analyzing' | 'studio'

export interface SessionSlice {
  services: Services | null
  state: DesignState | null
  phase: Phase
  /** The base being adjusted before the Studio; a step of the home screen, never saved. */
  adjusting: Base | null

  start(services: Services): void
  newDesign(): void
  /** The debug tools' throwaway designs: while on, nothing reaches the saved design. It is a state of the app, not a screen. */
  sandboxed: boolean
  /** The ficha the sandbox's design was opened from, for exporting it back; null for anything else. */
  sandboxOrigin: string | null
  /** Opens a variant or a ficha on a throwaway design; only with the debug access. */
  sandboxExample(example: Example, origin?: string | null): void
  /** Opens a design a bench case made, on a throwaway design. */
  sandboxState(state: DesignState): void
  /** Back to the saved design, as it was. */
  leaveSandbox(): void
  startCapture(): void
  adjustBase(base: Base): void
  closeAdjust(): void
  /** Leaves the capture for the home with the bases. */
  goHome(): void
  /** One of the home screen's examples, a ready design or a plan. */
  fromExample(example: Example): void
  /** A whole session from elsewhere (the bench) becomes the current design. */
  openState(state: DesignState): void
  applyProposal(): void
  /** The proposal with the solution Knotty builds for its critical findings, as one version; nothing when there is none. */
  applyProposalWithFix(): void
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
  /** Locks or frees a field of the plan for «Ahorrar material». */
  lockField(key: string, locked: boolean): void
  /** The ways to use fewer sheets on this plan, with the cutting settings of Materiales; null without a design. */
  findSavings(plan: FurniturePlan): SavingSearch | null
  applyFix(fix: Fix): void
  /** Several solutions as one version; all or none, and the result says why when they do not fit together. */
  applyFixes(fixes: Fix[]): { ok: true } | { ok: false; message: string }
  /** Puts an item in the tray, replaces the one from the same origin, or takes it out. */
  toggleTray(item: TrayItem): void
  acceptNotice(notice: Notice): void
  reopenNotice(notice: Notice): void
  /** Sets an expert's question aside, or brings it back; it is not answered either way. */
  dismissQuestion(notice: Notice): void
  reopenQuestion(notice: Notice): void
  restoreFromVersion(n: number, ids: string[]): { ok: true } | { ok: false; message: string }
  undoChange(n: number): { ok: true } | { ok: false; message: string }
  /** A hand edit on one piece; when it cannot hold, the result says why and what could. */
  editPiece(id: string, edit: PieceEdit): PieceEditResult
  resizeFurniture(axis: Axis, value: number): PieceEditResult
  /** The finish picked in Materiales, as a version of its own. */
  chooseFinish(finish: FinishId): void
  /** How a group of joints is made, as a version of its own; refused when the boards are too thin for it. */
  chooseJoint(group: JointGroupId, type: ChoosableJoint): WorkshopResult
  /** The profile of some edges of a piece; null leaves them straight. */
  chooseEdgeProfiles(pieceId: string, edges: Edge[], profile: EdgeProfileId | null): WorkshopResult
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

const CLOSED = { ok: false as const, message: NO_DESIGN }
const NO_EDIT = { ...CLOSED, alternatives: [] }

/** A command that may make a version: when it does, the scene moves to it. The result goes back as the use case gave it. */
function versioned<R extends { ok: true; state: DesignState } | { ok: false }, C = typeof CLOSED>(set: Set, get: Get, command: (services: Services, state: DesignState) => R, closed: C = CLOSED as C, also: Partial<Store> = {}): R | C {
  return withSession<R | C>(
    get,
    (services, state) => {
      const r = command(services, state)
      if (r.ok && r.state !== state) moveTo(set, services, state, r.state, { viewedVersion: null, ...also })
      return r
    },
    closed,
  )
}

/** What the scene keeps about one design and must not carry into another. */
const ANOTHER_DESIGN = { adjusting: null, viewedVersion: null, selection: null, hidden: [], flagged: [], preview: null, planDraft: null, cell: null, part: null } satisfies Partial<Store>

/** A design opens in the Studio: it appears from scratch, seen from the front three-quarter view. */
const opened = (s: Store, state: DesignState): Partial<Store> => ({ ...ANOTHER_DESIGN, state, phase: 'studio', reveal: s.reveal + 1, view: { name: 'three-quarter', nonce: s.view.nonce + 1 } })

/** The sandbox starts the first time something from the bench opens; only with the debug access. */
function enterSandbox(get: Get, set: Set): boolean {
  const { services, sandboxed } = get()
  if (!services || !debugAccess(services.debug)) return false
  if (sandboxed) return true
  get().controller?.abort()
  services.sandbox.enter()
  set({ sandboxed: true })
  return true
}

export const createSession: Slice<SessionSlice> = (set, get) => ({
  services: null,
  state: null,
  phase: 'home',
  adjusting: null,

  start(services) {
    const state = services.useCases.load()
    set({ services, state, phase: state ? 'studio' : 'home', debugVisible: debugAccess(services.debug), reveal: state ? 1 : 0, vault: services.preferences.vaultState(), catalogSettings: services.materials.settings() })
  },

  newDesign() {
    get().controller?.abort()
    get().services?.useCases.newDesign()
    set({ ...ANOTHER_DESIGN, state: null, phase: 'capture', mode: 'closed', reconstructionError: null, draft: null, thinking: false, stage: null })
  },

  sandboxed: false,
  sandboxOrigin: null,

  sandboxExample(example, origin = null) {
    if (!enterSandbox(get, set)) return
    set({ sandboxOrigin: origin })
    get().fromExample(example)
  },

  sandboxState(state) {
    if (!enterSandbox(get, set)) return
    set({ sandboxOrigin: null })
    get().openState(state)
  },

  leaveSandbox() {
    const { services } = get()
    if (!services || !get().sandboxed) return
    get().controller?.abort()
    services.sandbox.leave()
    const state = services.useCases.load()
    set((s) => ({ ...ANOTHER_DESIGN, sandboxed: false, sandboxOrigin: null, state, phase: state ? 'studio' : 'home', mode: 'closed', draft: null, thinking: false, stage: null, reveal: s.reveal + 1 }))
  },

  adjustBase: (base) => set({ adjusting: base }),

  closeAdjust: () => set({ adjusting: null }),

  startCapture: () => set({ phase: 'capture', adjusting: null, reconstructionError: null, draft: null }),

  goHome: () => set({ phase: 'home', reconstructionError: null, draft: null }),

  openState(state) {
    const { services } = get()
    if (!services) return
    set((s) => opened(s, services.useCases.adopt(state)))
  },

  fromExample(example) {
    const { services } = get()
    if (!services) return
    set((s) => opened(s, services.useCases.openExample(example)))
  },

  toggleTray: (item) => withSession(get, (services, state) => set({ state: services.useCases.toggleTray(state, item) })),

  applyProposal: () => withSession(get, (services, state) => set({ state: services.useCases.applyProposal(state), viewedVersion: null })),
  applyProposalWithFix: () =>
    withSession(get, (services, state) => {
      const fixed = services.useCases.applyProposalWithFix(state)
      if (fixed) moveTo(set, services, state, fixed, { preview: null, viewedVersion: null })
    }),

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
  chooseJoint: (group, type) => versioned(set, get, (services, state) => services.useCases.chooseJoint(state, group, type)),
  chooseEdgeProfiles: (pieceId, edges, profile) => versioned(set, get, (services, state) => services.useCases.chooseEdgeProfiles(state, pieceId, edges, profile)),
  chooseKind: (kind) => versioned(set, get, (services, state) => services.useCases.chooseKind(state, kind)),
  addNote: (text) => withSession(get, (services, state) => set({ state: services.useCases.addRequirement(state, text) })),
  removeNote: (id) => withSession(get, (services, state) => set({ state: services.useCases.removeRequirement(state, id) })),
  removeDecision: (topic) => withSession(get, (services, state) => set({ state: services.useCases.removeDecision(state, topic) })),
  applyFix: (fix) => withSession(get, (services, state) => moveTo(set, services, state, services.useCases.applyFix(state, fix), { preview: null, viewedVersion: null })),
  applyFixes: (fixes) => versioned(set, get, (services, state) => services.useCases.applyFixes(state, fixes), CLOSED, { preview: null }),
  acceptNotice: (notice) => withSession(get, (services, state) => set({ state: services.useCases.acceptNotice(state, notice.findings, notice.title) })),
  reopenNotice: (notice) => withSession(get, (services, state) => set({ state: services.useCases.reopenNotice(state, notice.findings) })),
  dismissQuestion: (notice) => withSession(get, (services, state) => notice.question && set({ state: services.useCases.dismissQuestion(state, notice.question.messageId, notice.question.index) })),
  reopenQuestion: (notice) => withSession(get, (services, state) => notice.question && set({ state: services.useCases.reopenQuestion(state, notice.question.messageId, notice.question.index) })),

  restoreFromVersion: (n, ids) => versioned(set, get, (services, state) => services.useCases.restoreFromVersion(state, n, ids)),
  undoChange: (n) => versioned(set, get, (services, state) => services.useCases.undoChange(state, n)),
  editPiece: (id, edit) => versioned(set, get, (services, state) => services.useCases.editPiece(state, id, edit), NO_EDIT),
  resizeFurniture: (axis, value) => versioned(set, get, (services, state) => services.useCases.resizeFurniture(state, axis, value), NO_EDIT),
  applyPlan: (plan) => versioned(set, get, (services, state) => services.useCases.applyPlan(state, plan)),

  lockField: (key, locked) => withSession(get, (services, state) => set({ state: services.useCases.lockField(state, key, locked) })),

  findSavings: (plan) => withSession(get, (services, state) => services.useCases.findSavings(state, plan, applySettings(services.catalog, get().catalogSettings)), null),
})
