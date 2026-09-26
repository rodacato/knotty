import { ExpertError, type OnProgress, type Stage, type SentPhoto } from '../../application/useCases'
import { applySettings } from '../../domain/materials/catalog'
import { trayRequest } from '../../domain/session/tray/tray'
import type { TraceEntry } from '../../domain/session/trace/trace'
import type { Dimensions } from '../../domain/design/schema'
import { markAnswered, type DesignState, type Message, type Thumbnail } from '../../domain/session/state'
import type { Photo } from '../../ports/LLMProvider'
import { moveTo } from './scene'
import type { Get, Set, Slice } from './types'

// Every call to the expert: what it is doing, how to cancel or retry it, and what failed.

export interface CaptureInput {
  measures: Dimensions | null
  photos: Photo[]
  thumbnails: Thumbnail[]
  notes: string
}

export interface ExpertSlice {
  stage: { name: Stage; attempt: number; progress?: { done: number; total: number } } | null
  thinking: boolean
  reconstructionError: string | null
  /** What the expert did in a design attempt that failed, for «Ver qué pasó». */
  failedTrace: TraceEntry[]
  /** The last thing sent to be designed, so it is not lost if it fails and can be retried. */
  draft: CaptureInput | null
  controller: AbortController | null
  /** The carpenter is reviewing the purchase; it runs apart from the chat so as not to block it. */
  reviewing: AbortController | null
  verdictError: string | null

  reconstruct(input: CaptureInput): Promise<void>
  adjust(request: string, replyTo?: string | null, photo?: SentPhoto | null): Promise<void>
  /** The tray and what was typed, to the expert in one request. */
  sendTray(typed?: string): Promise<void>
  cancel(): void
  /** Aborts the reconstruction in progress and asks again with the same input. */
  retryReconstruction(): void
  review(): Promise<void>
  cancelReview(): void
}

/** A request to the expert: the message shows at once, and the answer replaces the state when it arrives. */
async function askExpert(set: Set, get: Get, text: string, replyTo: string | null, thumbnail: string | null, call: (signal: AbortSignal, onAdvance: OnProgress) => Promise<DesignState>) {
  const { services, state, thinking } = get()
  if (!services || !state || thinking) return
  const controller = new AbortController()
  const pending: Message = { id: 'pending', author: 'user', text, date: new Date().toISOString(), questions: [], answered: false, version: null, proposal: null, error: false, requestedPhotos: [], thumbnail, answers: [], suggestions: [], solutions: [] }
  const optimistic = { ...state, tray: [], chat: [...markAnswered(state.chat, replyTo), pending] }
  set({ thinking: true, controller, stage: { name: 'proposing', attempt: 0 }, state: optimistic })
  const fresh = await call(controller.signal, (name, attempt) => set({ stage: { name, attempt } }))
  moveTo(set, services, state, fresh, { thinking: false, stage: null, controller: null, showProposal: true, viewedVersion: null })
}

export const createExpert: Slice<ExpertSlice> = (set, get) => ({
  stage: null,
  thinking: false,
  reconstructionError: null,
  failedTrace: [],
  draft: null,
  controller: null,
  reviewing: null,
  verdictError: null,

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
})
