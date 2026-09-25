import type { DebugLog } from '../../ports/DebugLog'
import type { LLMProvider, Respuesta } from '../../ports/LLMProvider'

// Wraps a provider so every call lands in the debug log: what was asked, what came back, how long it took.

/** Photos are summarized by size and the catalog is left out: both are big and neither helps to debug. */
function sanitize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, v) => {
      if (key === 'base64' && typeof v === 'string') return `[JPEG de ${Math.round((v.length * 3) / 4 / 1024)} KB]`
      if (key === 'catalogo') return '[catálogo]'
      return v
    }),
  )
}

const LABELS: Record<string, string> = {
  reconstruir: 'Diseño completo',
  proponerAjuste: 'Cambio',
  dictaminar: 'Revisión antes de comprar',
  readPhoto: 'Lectura de foto',
  planDesign: 'Esqueleto',
  adjustPlan: 'Cambio en la ficha',
}

export function withDebugLog(provider: LLMProvider, log: DebugLog): LLMProvider {
  const wrap =
    <A extends [unknown, AbortSignal], R extends Respuesta<unknown>>(method: string, call: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const started = performance.now()
      const request = sanitize(args[0])
      try {
        const answer = await call(...args)
        const ms = Math.round(performance.now() - started)
        log.record({
          kind: 'llm',
          summary: `${LABELS[method] ?? method} · ${provider.etiqueta} · ${(ms / 1000).toFixed(1)} s${answer.consumo.tokensSalida ? ` · ${answer.consumo.tokensSalida} tokens` : ''}`,
          ms,
          data: { method, request, answer: { valor: answer.valor, origen: answer.origen, consumo: answer.consumo, avisos: answer.avisos ?? [] } },
        })
        return answer
      } catch (e) {
        const ms = Math.round(performance.now() - started)
        const error = e instanceof Error ? { name: e.name, message: e.message, ...(e as { problemas?: string }).problemas !== undefined ? { problemas: (e as { problemas?: string }).problemas } : {} } : String(e)
        log.record({ kind: 'error', summary: `${LABELS[method] ?? method} falló · ${(ms / 1000).toFixed(1)} s · ${e instanceof Error ? e.message.slice(0, 120) : ''}`, ms, data: { method, request, error } })
        throw e
      }
    }
  return {
    ...provider,
    reconstruir: wrap('reconstruir', provider.reconstruir.bind(provider)),
    proponerAjuste: wrap('proponerAjuste', provider.proponerAjuste.bind(provider)),
    dictaminar: wrap('dictaminar', provider.dictaminar.bind(provider)),
    readPhoto: wrap('readPhoto', provider.readPhoto.bind(provider)),
    planDesign: provider.planDesign ? wrap('planDesign', provider.planDesign.bind(provider)) : null,
    adjustPlan: provider.adjustPlan ? wrap('adjustPlan', provider.adjustPlan.bind(provider)) : null,
  }
}
