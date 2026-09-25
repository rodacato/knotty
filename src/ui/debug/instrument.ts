import type { DebugLog } from '../../ports/DebugLog'
import type { CaptureInput } from '../store'
import { useStore } from '../store'

// Records what the person does and what the app goes through, without touching each action.

type Store = ReturnType<typeof useStore.getState>
type Describe = (...args: never[]) => { summary: string; data?: unknown }

const photos = (e: CaptureInput) => e.photos.map((f) => ({ angle: f.angle, kb: Math.round((f.base64.length * 3) / 4 / 1024), note: f.note ?? null }))

const ACTIONS: Partial<Record<keyof Store, Describe>> = {
  reconstruct: (input: CaptureInput) => ({ summary: `Diseñar: «${input.notes.slice(0, 60)}»${input.photos.length ? ` con ${input.photos.length} fotos` : ''}`, data: { measures: input.measures, notes: input.notes, photos: photos(input) } }),
  adjust: (request: string, replyTo?: string | null, photo?: { angle: string } | null) => ({ summary: `Pedir: «${request.slice(0, 80)}»`, data: { request, replyTo: replyTo ?? null, photo: photo?.angle ?? null } }),
  retryReconstruction: () => ({ summary: 'Reintentar el diseño' }),
  cancel: () => ({ summary: 'Cancelar' }),
  applyProposal: () => ({ summary: 'Aplicar la propuesta bajo su riesgo' }),
  discardProposal: () => ({ summary: 'Descartar la propuesta' }),
  backToVersion: (n: number) => ({ summary: `Volver a la versión ${n}` }),
  confirmPiece: (id: string) => ({ summary: `Confirmar la pieza ${id}` }),
  review: () => ({ summary: 'Revisar antes de comprar' }),
  newDesign: () => ({ summary: 'Nuevo diseño' }),
  fromExample: (design: { nombre: string }) => ({ summary: `Abrir el ejemplo ${design.nombre}` }),
  switchToSimulated: () => ({ summary: 'Usar el experto simulado' }),
}

export function instrumentStore(log: DebugLog) {
  const state = useStore.getState()
  const wrapped: Partial<Store> = {}
  for (const [key, describe] of Object.entries(ACTIONS) as [keyof Store, Describe][]) {
    const original = state[key] as unknown as (...args: unknown[]) => unknown
    ;(wrapped as Record<string, unknown>)[key] = (...args: unknown[]) => {
      try {
        log.record({ kind: 'action', ...(describe as (...a: unknown[]) => { summary: string; data?: unknown })(...args) })
      } catch {
        // Logging must never get in the way of the action itself.
      }
      return original(...args)
    }
  }
  useStore.setState(wrapped)

  // Stages and errors are read from the store as they change.
  return useStore.subscribe((now, before) => {
    if (now.stage && (now.stage.name !== before.stage?.name || now.stage.attempt !== before.stage?.attempt || now.stage.progress?.done !== before.stage?.progress?.done))
      log.record({ kind: 'stage', summary: `Etapa: ${now.stage.name}${now.stage.attempt ? `, intento ${now.stage.attempt + 1}` : ''}${now.stage.progress ? ` (${now.stage.progress.done} de ${now.stage.progress.total})` : ''}`, data: now.stage })
    if (now.reconstructionError && now.reconstructionError !== before.reconstructionError) log.record({ kind: 'error', summary: `El diseño falló: ${now.reconstructionError}`, data: { trace: now.failedTrace } })
    if (now.verdictError && now.verdictError !== before.verdictError) log.record({ kind: 'error', summary: `La revisión falló: ${now.verdictError}` })
    if (now.state && before.state && now.state.current !== before.state.current) log.record({ kind: 'action', summary: `Versión ${now.state.current}: ${now.state.versions.find((v) => v.n === now.state!.current)?.summary ?? ''}` })
  })
}

/** Uncaught errors, with their stack: the ones nobody sees otherwise. */
export function captureGlobalErrors(log: DebugLog) {
  const onError = (e: ErrorEvent) => log.record({ kind: 'error', summary: `Error: ${e.message}`, data: { message: e.message, source: e.filename, line: e.lineno, stack: e.error instanceof Error ? e.error.stack : null } })
  const onRejection = (e: PromiseRejectionEvent) =>
    log.record({ kind: 'error', summary: `Promesa rechazada: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`, data: { stack: e.reason instanceof Error ? e.reason.stack : null } })
  addEventListener('error', onError)
  addEventListener('unhandledrejection', onRejection)
  return () => {
    removeEventListener('error', onError)
    removeEventListener('unhandledrejection', onRejection)
  }
}
