import type { DebugLog } from '../../ports/DebugLog'
import type { CaptureInput } from '../tienda'
import { useTienda } from '../tienda'

// Records what the person does and what the app goes through, without touching each action.

type Store = ReturnType<typeof useTienda.getState>
type Describe = (...args: never[]) => { summary: string; data?: unknown }

const photos = (e: CaptureInput) => e.photos.map((f) => ({ angulo: f.angle, kb: Math.round((f.base64.length * 3) / 4 / 1024), note: f.note ?? null }))

const ACTIONS: Partial<Record<keyof Store, Describe>> = {
  reconstruir: (entrada: CaptureInput) => ({ summary: `Diseñar: «${entrada.notes.slice(0, 60)}»${entrada.photos.length ? ` con ${entrada.photos.length} fotos` : ''}`, data: { medidas: entrada.measures, notas: entrada.notes, fotos: photos(entrada) } }),
  ajustar: (peticion: string, respondeA?: string | null, foto?: { angulo: string } | null) => ({ summary: `Pedir: «${peticion.slice(0, 80)}»`, data: { peticion, respondeA: respondeA ?? null, foto: foto?.angulo ?? null } }),
  reintentarReconstruccion: () => ({ summary: 'Reintentar el diseño' }),
  cancelar: () => ({ summary: 'Cancelar' }),
  aplicarPropuesta: () => ({ summary: 'Aplicar la propuesta bajo su riesgo' }),
  descartarPropuesta: () => ({ summary: 'Descartar la propuesta' }),
  volverAVersion: (n: number) => ({ summary: `Volver a la versión ${n}` }),
  confirmarPieza: (id: string) => ({ summary: `Confirmar la pieza ${id}` }),
  dictaminar: () => ({ summary: 'Revisar antes de comprar' }),
  nuevoDiseno: () => ({ summary: 'Nuevo diseño' }),
  desdeEjemplo: (diseno: { nombre: string }) => ({ summary: `Abrir el ejemplo ${diseno.nombre}` }),
  usarSimulado: () => ({ summary: 'Usar el experto simulado' }),
}

export function instrumentStore(log: DebugLog) {
  const state = useTienda.getState()
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
  useTienda.setState(wrapped)

  // Stages and errors are read from the store as they change.
  return useTienda.subscribe((now, before) => {
    if (now.etapa && (now.etapa.nombre !== before.etapa?.nombre || now.etapa.intento !== before.etapa?.intento || now.etapa.progress?.done !== before.etapa?.progress?.done))
      log.record({ kind: 'stage', summary: `Etapa: ${now.etapa.nombre}${now.etapa.intento ? `, intento ${now.etapa.intento + 1}` : ''}${now.etapa.progress ? ` (${now.etapa.progress.done} de ${now.etapa.progress.total})` : ''}`, data: now.etapa })
    if (now.errorReconstruccion && now.errorReconstruccion !== before.errorReconstruccion) log.record({ kind: 'error', summary: `El diseño falló: ${now.errorReconstruccion}`, data: { trace: now.failedTrace } })
    if (now.errorDictamen && now.errorDictamen !== before.errorDictamen) log.record({ kind: 'error', summary: `La revisión falló: ${now.errorDictamen}` })
    if (now.estado && before.estado && now.estado.actual !== before.estado.actual) log.record({ kind: 'action', summary: `Versión ${now.estado.actual}: ${now.estado.versiones.find((v) => v.n === now.estado!.actual)?.resumen ?? ''}` })
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
