import { create, type StoreApi } from 'zustand'
import { ExpertError, type OnProgress, type Stage, type SentPhoto, type PieceEdit, type PieceEditResult } from '../application/useCases'
import type { Notice } from '../application/notices'
import type { Fix } from '../domain/fixes/fixes'
import { trayRequest, type TrayItem } from '../domain/tray/tray'
import type { FurniturePlan } from '../domain/modules/plan'
import type { TraceEntry } from '../domain/trace/trace'
import { analyze } from '../domain/analysis'
import type { Dimensions, Design, Axis, Piece } from '../domain/design/schema'
import type { Box } from '../domain/design/resolve'
import { differences } from '../domain/design/diff'
import { currentDesign, markAnswered, type DesignState, type Message, type Thumbnail } from '../domain/session/state'
import type { Photo } from '../ports/LLMProvider'
import type { VaultState } from '../ports/Preferences'
import { applySettings, NO_SETTINGS, type CatalogSettings } from '../domain/materials/catalog'
import type { Services } from './services'

export type Phase = 'home' | 'capture' | 'analyzing' | 'studio'
export type View = 'front' | 'side' | 'three-quarter' | 'top'

export interface CaptureInput {
  measures: Dimensions | null
  photos: Photo[]
  thumbnails: Thumbnail[]
  notes: string
}

interface Store {
  services: Services | null
  state: DesignState | null
  phase: Phase
  stage: { name: Stage; attempt: number; progress?: { done: number; total: number } } | null
  thinking: boolean
  reconstructionError: string | null
  /** What the expert did in a design attempt that failed, for «Ver qué pasó». */
  failedTrace: TraceEntry[]
  /** The last thing sent to be designed, so it is not lost if it fails and can be retried. */
  draft: CaptureInput | null
  controller: AbortController | null
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
  settingsOpen: boolean
  vault: VaultState
  /** The keys notice on arrival was already handled or postponed. */
  gateClosed: boolean
  /** The person's prices and cutting settings over the catalog. */
  catalogSettings: CatalogSettings
  /** The carpenter is reviewing the purchase; it runs apart from the chat so as not to block it. */
  reviewing: AbortController | null
  verdictError: string | null

  start(services: Services): void
  newDesign(): void
  startCapture(): void
  fromExample(design: Design): void
  /** A whole session from elsewhere (the bench) becomes the current design. */
  openState(state: DesignState): void
  reconstruct(input: CaptureInput): Promise<void>
  adjust(request: string, replyTo?: string | null, photo?: SentPhoto | null): Promise<void>
  cancel(): void
  /** Aborts the reconstruction in progress and asks again with the same input. */
  retryReconstruction(): void
  applyProposal(): void
  discardProposal(): void
  select(id: string | null): void
  toggleExploded(): void
  toggleDimensions(): void
  viewFrom(view: View): void
  toggleProposal(): void
  openSettings(open: boolean): void
  unlock(passphrase: string): Promise<void>
  forgetKeys(): void
  switchToSimulated(): void
  closeGate(): void
  /** After saving settings, the vault may have changed. */
  refreshVault(): void
  viewVersion(n: number | null): void
  backToVersion(n: number): void
  confirmPiece(id: string): void
  addNote(text: string): void
  removeNote(id: string): void
  removeDecision(topic: string): void
  saveCatalogSettings(a: CatalogSettings): void
  review(): Promise<void>
  /** Rebuilds the design from an edited plan; the result says why when it cannot be built. */
  applyPlan(plan: FurniturePlan): { ok: true; notes: string[] } | { ok: false; message: string }
  /** A hand edit on one piece; when it cannot hold, the result says why and what could. */
  /** A solution shown in 3D before applying it. */
  preview: { design: Design; label: string } | null
  previewFix(fix: Fix | null): void
  applyFix(fix: Fix): void
  /** Puts an item in the tray, replaces the one from the same origin, or takes it out. */
  toggleTray(item: TrayItem): void
  /** The tray and what was typed, to the expert in one request. */
  sendTray(typed?: string): Promise<void>
  acceptNotice(notice: Notice): void
  reopenNotice(notice: Notice): void
  restoreFromVersion(n: number, ids: string[]): { ok: true } | { ok: false; message: string }
  undoChange(n: number): { ok: true } | { ok: false; message: string }
  editPiece(id: string, edit: PieceEdit): PieceEditResult
  resizeFurniture(axis: Axis, value: number): PieceEditResult
  cancelReview(): void
}

export interface SceneChanges {
  added: string[]
  modified: string[]
  removed: { piece: Piece; box: Box }[]
  nonce: number
}

const shownDesign = (e: DesignState) => e.proposal?.design ?? currentDesign(e)

/** What the scene shows: a previous version, the proposal or the current design. */
export function visibleDesign(s: Pick<Store, 'state' | 'viewedVersion' | 'showProposal'>): Design | null {
  if (!s.state) return null
  if (s.viewedVersion !== null) return s.state.versions.find((v) => v.n === s.viewedVersion)?.design ?? currentDesign(s.state)
  return s.state.proposal && s.showProposal ? s.state.proposal.design : currentDesign(s.state)
}

/** What changes from one design to another, with the box of what disappears to draw its ghost. */
function transition(before: Design, after: Design, catalog: Services['catalog'], nonce: number): SceneChanges {
  const ga = analyze(before, catalog)
  const gb = analyze(after, catalog)
  if (!ga.valid || !gb.valid) return { added: [], modified: [], removed: [], nonce }
  const d = differences(before, ga.geo.boxes, after, gb.geo.boxes)
  const removed = d.removed.map((id) => ({ piece: before.pieces.find((p) => p.id === id)!, box: ga.geo.boxes.get(id)! }))
  return { added: d.added, modified: d.changed, removed, nonce }
}

type Set = StoreApi<Store>['setState']
type Get = StoreApi<Store>['getState']

/** A request to the expert: the message shows at once, and the answer replaces the state when it arrives. */
async function askExpert(set: Set, get: Get, text: string, replyTo: string | null, thumbnail: string | null, call: (signal: AbortSignal, onAdvance: OnProgress) => Promise<DesignState>) {
  const { services, state, thinking } = get()
  if (!services || !state || thinking) return
  const controller = new AbortController()
  const pending: Message = { id: 'pendiente', author: 'user', text, date: new Date().toISOString(), questions: [], answered: false, version: null, proposal: null, error: false, requestedPhotos: [], thumbnail, answers: [], suggestions: [] }
  const optimistic = { ...state, tray: [], chat: [...markAnswered(state.chat, replyTo), pending] }
  set({ thinking: true, controller, stage: { name: 'proposing', attempt: 0 }, state: optimistic })
  const fresh = await call(controller.signal, (name, attempt) => set({ stage: { name, attempt } }))
  set((s) => ({
    state: fresh,
    thinking: false,
    stage: null,
    controller: null,
    showProposal: true,
    viewedVersion: null,
    changes: transition(shownDesign(state), shownDesign(fresh), services.catalog, s.changes.nonce + 1),
  }))
}

export const useStore = create<Store>((set, get) => ({
  services: null,
  state: null,
  phase: 'home',
  stage: null,
  thinking: false,
  reconstructionError: null,
  failedTrace: [],
  draft: null,
  controller: null,
  selection: null,
  exploded: false,
  dimensions: true,
  view: { name: 'three-quarter', nonce: 0 },
  showProposal: true,
  changes: { added: [], modified: [], removed: [], nonce: 0 },
  viewedVersion: null,
  reveal: 0,
  settingsOpen: false,
  vault: 'none',
  gateClosed: false,
  catalogSettings: NO_SETTINGS,
  preview: null,
  reviewing: null,
  verdictError: null,

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

  fromExample(design) {
    const { services } = get()
    if (!services) return
    set((s) => ({ state: services.useCases.fromExample(design), phase: 'studio', reveal: s.reveal + 1, view: { name: 'three-quarter', nonce: s.view.nonce + 1 } }))
  },

  async reconstruct(input) {
    const { services } = get()
    if (!services) return
    const controller = new AbortController()
    set({ phase: 'analyzing', controller, stage: { name: input.photos.length ? 'reading-photos' : 'designing', attempt: 0 }, reconstructionError: null, draft: input })
    // A retry orphans the previous request: whatever it answers no longer counts.
    const isCurrent = () => get().controller === controller
    try {
      const state = await services.useCases.reconstruct(input, controller.signal, (name, attempt, progress) => isCurrent() && set({ stage: { name, attempt, progress } }))
      if (!isCurrent()) return
      set((s) => ({ state, phase: 'studio', stage: null, controller: null, draft: null, reveal: s.reveal + 1, view: { name: 'three-quarter', nonce: s.view.nonce + 1 } }))
    } catch (e) {
      if (!isCurrent()) return
      const cancelled = controller.signal.aborted
      set({
        phase: 'capture',
        stage: null,
        controller: null,
        reconstructionError: cancelled ? null : e instanceof Error ? e.message : 'Algo falló al analizar las fotos.',
        failedTrace: e instanceof ExpertError ? e.trace : [],
      })
    }
  },

  adjust(request, replyTo = null, photo = null) {
    const { services, state } = get()
    if (!services || !state || !request.trim()) return Promise.resolve()
    return askExpert(set, get, request.trim(), replyTo, photo?.thumbnail ?? null, (signal, onAdvance) => services.useCases.adjust(state, request.trim(), signal, onAdvance, replyTo, photo))
  },

  toggleTray(item) {
    const { services, state } = get()
    if (!services || !state) return
    set({ state: services.useCases.toggleTray(state, item) })
  },

  sendTray(typed = '') {
    const { services, state } = get()
    if (!services || !state || (!state.tray.length && !typed.trim())) return Promise.resolve()
    const { text, answers } = trayRequest(state.tray, typed)
    return askExpert(set, get, text, answers, null, (signal, onAdvance) => services.useCases.sendTray(state, typed, signal, onAdvance))
  },

  cancel: () => get().controller?.abort(),

  retryReconstruction() {
    const { draft, controller } = get()
    if (!draft) return
    controller?.abort()
    void get().reconstruct(draft)
  },

  applyProposal() {
    const { services, state } = get()
    if (!services || !state) return
    set({ state: services.useCases.applyProposal(state), viewedVersion: null })
  },

  discardProposal() {
    const { services, state } = get()
    if (!services || !state) return
    const fresh = services.useCases.discardProposal(state)
    set((s) => ({ state: fresh, changes: transition(shownDesign(state), shownDesign(fresh), services.catalog, s.changes.nonce + 1) }))
  },

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
  openSettings: (settingsOpen) => set({ settingsOpen }),

  async unlock(passphrase) {
    const { services } = get()
    if (!services) return
    await services.preferences.unlock(passphrase)
    set({ vault: services.preferences.vaultState() })
  },

  forgetKeys() {
    const { services } = get()
    if (!services) return
    services.preferences.forgetKeys()
    set({ vault: services.preferences.vaultState() })
  },

  switchToSimulated() {
    const { services } = get()
    if (!services) return
    void services.preferences.save({ ...services.preferences.load(), active: 'simulated' }).catch(() => {})
    set({ gateClosed: true })
  },

  closeGate: () => set({ gateClosed: true }),

  viewVersion(viewedVersion) {
    const before = visibleDesign(get())
    set({ viewedVersion, selection: null })
    const after = visibleDesign(get())
    const { services } = get()
    if (services && before && after && before !== after) set((s) => ({ changes: transition(before, after, services.catalog, s.changes.nonce + 1) }))
  },

  backToVersion(n) {
    const { services, state, viewedVersion } = get()
    if (!services || !state) return
    const fresh = services.useCases.backToVersion(state, n)
    const before = viewedVersion !== null ? (state.versions.find((v) => v.n === viewedVersion)?.design ?? shownDesign(state)) : shownDesign(state)
    set((s) => ({ state: fresh, viewedVersion: null, changes: transition(before, shownDesign(fresh), services.catalog, s.changes.nonce + 1) }))
  },

  confirmPiece(id) {
    const { services, state } = get()
    if (!services || !state) return
    const fresh = services.useCases.confirmPiece(state, id)
    set((s) => ({ state: fresh, changes: transition(shownDesign(state), shownDesign(fresh), services.catalog, s.changes.nonce + 1) }))
  },

  addNote(text) {
    const { services, state } = get()
    if (services && state) set({ state: services.useCases.addRequirement(state, text) })
  },

  removeNote(id) {
    const { services, state } = get()
    if (services && state) set({ state: services.useCases.removeRequirement(state, id) })
  },

  removeDecision(topic) {
    const { services, state } = get()
    if (services && state) set({ state: services.useCases.removeDecision(state, topic) })
  },

  previewFix: (fix) => set({ preview: fix ? { design: fix.design, label: fix.label } : null, viewedVersion: null }),

  applyFix(fix) {
    const { services, state } = get()
    if (!services || !state) return
    const fresh = services.useCases.applyFix(state, fix)
    set((s) => ({ state: fresh, preview: null, viewedVersion: null, changes: transition(shownDesign(state), shownDesign(fresh), services.catalog, s.changes.nonce + 1) }))
  },

  acceptNotice(notice) {
    const { services, state } = get()
    if (!services || !state) return
    set({ state: services.useCases.acceptNotice(state, notice.findings, notice.title) })
  },

  reopenNotice(notice) {
    const { services, state } = get()
    if (!services || !state) return
    set({ state: services.useCases.reopenNotice(state, notice.findings) })
  },

  restoreFromVersion(n, ids) {
    const { services, state } = get()
    if (!services || !state) return { ok: false, message: 'No hay un diseño abierto.' }
    const r = services.useCases.restoreFromVersion(state, n, ids)
    if (!r.ok) return r
    set((s) => ({ state: r.state, viewedVersion: null, changes: transition(shownDesign(state), shownDesign(r.state), services.catalog, s.changes.nonce + 1) }))
    return { ok: true }
  },

  undoChange(n) {
    const { services, state } = get()
    if (!services || !state) return { ok: false, message: 'No hay un diseño abierto.' }
    const r = services.useCases.undoChange(state, n)
    if (!r.ok) return r
    set((s) => ({ state: r.state, viewedVersion: null, changes: transition(shownDesign(state), shownDesign(r.state), services.catalog, s.changes.nonce + 1) }))
    return { ok: true }
  },

  editPiece(id, edit) {
    const { services, state } = get()
    if (!services || !state) return { ok: false, message: 'No hay un diseño abierto.', alternatives: [] }
    const r = services.useCases.editPiece(state, id, edit)
    if (r.ok) set((s) => ({ state: r.state, viewedVersion: null, changes: transition(shownDesign(state), shownDesign(r.state), services.catalog, s.changes.nonce + 1) }))
    return r
  },

  resizeFurniture(axis, value) {
    const { services, state } = get()
    if (!services || !state) return { ok: false, message: 'No hay un diseño abierto.', alternatives: [] }
    const r = services.useCases.resizeFurniture(state, axis, value)
    if (r.ok) set((s) => ({ state: r.state, viewedVersion: null, changes: transition(shownDesign(state), shownDesign(r.state), services.catalog, s.changes.nonce + 1) }))
    return r
  },

  applyPlan(plan) {
    const { services, state } = get()
    if (!services || !state) return { ok: false, message: 'No hay un diseño abierto.' }
    const r = services.useCases.applyPlan(state, plan)
    if (!r.ok) return r
    set((s) => ({ state: r.state, viewedVersion: null, changes: transition(shownDesign(state), shownDesign(r.state), services.catalog, s.changes.nonce + 1) }))
    return { ok: true, notes: r.notes }
  },

  async review() {
    const { services, state, catalogSettings, reviewing } = get()
    if (!services || !state || reviewing) return
    const controller = new AbortController()
    set({ reviewing: controller, verdictError: null })
    try {
      const verdict = await services.useCases.reviewPurchase(state, applySettings(services.catalog, catalogSettings), controller.signal)
      // If the design changed meanwhile, its signature no longer matches and it shows as stale.
      const isCurrent = get().state
      set({ state: isCurrent ? services.useCases.saveReview(isCurrent, verdict) : null, reviewing: null })
    } catch (e) {
      set({ reviewing: null, verdictError: controller.signal.aborted ? null : e instanceof Error ? e.message : 'No se pudo revisar la compra.' })
    }
  },

  cancelReview: () => get().reviewing?.abort(),

  saveCatalogSettings(catalogSettings) {
    get().services?.materials.saveSettings(catalogSettings)
    set({ catalogSettings })
  },

  refreshVault() {
    const { services } = get()
    if (services) set({ vault: services.preferences.vaultState() })
  },
}))
