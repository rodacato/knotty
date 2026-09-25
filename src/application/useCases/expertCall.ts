import type { Repair } from '../../domain/repair/repair'
import type { TraceEntry } from '../../domain/trace/trace'
import { InvalidResponse, type ExpertResponse } from '../../ports/LLMProvider'

/** The expert could not do something and says so; the message is for the person. */
export class ExpertError extends Error {
  constructor(
    message: string,
    readonly trace: TraceEntry[] = [],
  ) {
    super(message)
  }
}

export const traceEntry = (
  step: TraceEntry['step'],
  attempt: number,
  started: number,
  response: ExpertResponse<unknown> | null,
  outcome: TraceEntry['outcome'],
  errors: TraceEntry['errors'],
  repairs: Repair[] = [],
  subject: string | null = null,
): TraceEntry => ({
  at: new Date(started).toISOString(),
  step,
  subject,
  attempt,
  seconds: Math.round((Date.now() - started) / 100) / 10,
  outputTokens: response?.usage.outputTokens ?? null,
  promptId: response?.origin.promptId ?? null,
  outcome,
  errors,
  repairs: repairs.map((r) => r.message),
})

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

export type Call<T> = { ok: true; response: ExpertResponse<T>; started: number } | { ok: false; unreadable: InvalidResponse | null; started: number }

interface CallOptions {
  step: TraceEntry['step']
  attempt: number
  signal: AbortSignal
  trace: TraceEntry[]
  /** `skip`: an optional step, any failure is traced and skipped. `correct`: an unreadable answer goes back to be corrected, anything else ends the request. */
  onFailure: 'skip' | 'correct'
  code?: string
  subject?: string | null
}

/** One timed call to the expert that traces its own failure; a cancelled request always throws the original error. */
export async function expertCall<T>(call: () => Promise<ExpertResponse<T>>, o: CallOptions): Promise<Call<T>> {
  const started = Date.now()
  try {
    return { ok: true, response: await call(), started }
  } catch (e) {
    const unreadable = e instanceof InvalidResponse ? e : null
    if (o.onFailure === 'correct') {
      if (unreadable) {
        o.trace.push(traceEntry(o.step, o.attempt, started, null, 'unreadable', [{ code: 'E_SCHEMA', message: unreadable.problems.slice(0, 500) }], [], o.subject ?? null))
        return { ok: false, unreadable, started }
      }
      if (o.signal.aborted) throw e
      o.trace.push(traceEntry(o.step, o.attempt, started, null, 'failed', [{ code: 'E_PROVIDER', message: errorText(e) }], [], o.subject ?? null))
      throw new ExpertError(e instanceof Error ? e.message : 'Algo falló al consultar al experto.', o.trace)
    }
    if (o.signal.aborted) throw e
    const code = o.code ?? (unreadable ? 'E_SCHEMA' : 'E_PROVIDER')
    const message = o.code || !unreadable ? errorText(e) : unreadable.problems
    o.trace.push(traceEntry(o.step, o.attempt, started, null, unreadable ? 'unreadable' : 'failed', [{ code, message: message.slice(0, 500) }], [], o.subject ?? null))
    return { ok: false, unreadable, started }
  }
}
