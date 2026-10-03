import { AsyncLocalStorage } from 'node:async_hooks'
import { allowlistHeaders, type CallTelemetry } from '../../src/application/bench/manifest'
import type { ExpertResponse, LLMProvider } from '../../src/ports/LLMProvider'

// What the provider says about each request, read from the response without changing it. Only the host is kept of a URL, and only
// allowlisted headers: the request, its Authorization and its body are never read.

export interface RequestTelemetry extends CallTelemetry {
  /** Host only: no path, query or credentials. */
  host: string
  /** Which provider call of the job made the request; null outside any call. */
  call: number | null
}

interface Context {
  jobId: string
  call: number | null
}

type Fetch = typeof globalThis.fetch

const hostOf = (input: Parameters<Fetch>[0]) => {
  try {
    return new URL(input instanceof Request ? input.url : String(input)).host
  } catch {
    return 'unknown'
  }
}

/** `model` and `id` from a JSON answer, or from the first SSE chunk that carries them (OpenAI-style chunks, or Anthropic's message_start). */
export function identityOfBody(text: string, sse: boolean): { model: string | null; id: string | null } {
  const found = (value: unknown) => {
    const v = value as { model?: unknown; id?: unknown; message?: { model?: unknown; id?: unknown } } | null
    const model = v?.model ?? v?.message?.model
    const id = v?.id ?? v?.message?.id
    return { model: typeof model === 'string' ? model : null, id: typeof id === 'string' ? id : null }
  }
  const candidates = sse ? text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).filter((d) => d && d !== '[DONE]') : [text]
  for (const candidate of candidates) {
    try {
      const { model, id } = found(JSON.parse(candidate))
      if (model || id) return { model, id }
    } catch {
      if (!sse) break
    }
  }
  return { model: null, id: null }
}

export function createTelemetry(options: { fetch?: Fetch; now?: () => number } = {}) {
  const context = new AsyncLocalStorage<Context>()
  const now = options.now ?? (() => performance.now())
  const records = new Map<string, RequestTelemetry[]>()
  const pending = new Map<string, Promise<void>>()
  const models = new Set<string>()
  let original: Fetch | null = null

  const keep = (jobId: string, record: RequestTelemetry) => {
    records.set(jobId, [...(records.get(jobId) ?? []), record])
    if (record.responseModel) models.add(record.responseModel)
  }

  const observed: Fetch = async (input, init) => {
    const ctx = context.getStore()
    const started = now()
    const response = await (original ?? options.fetch ?? globalThis.fetch)(input, init)
    if (!ctx) return response
    const ttfbMs = Math.round(now() - started)
    const headers = allowlistHeaders(Object.fromEntries(response.headers.entries()))
    const sse = (response.headers.get('content-type') ?? '').includes('text/event-stream')
    const copy = response.clone()
    const read = copy
      .text()
      .catch(() => '')
      .then((text) => {
        const { model, id } = identityOfBody(text, sse)
        keep(ctx.jobId, { host: hostOf(input), call: ctx.call, status: response.status, ttfbMs, totalMs: Math.round(now() - started), responseModel: model, requestId: id ?? headers['x-request-id'] ?? headers['request-id'] ?? null, headersAllowlisted: headers })
      })
    pending.set(ctx.jobId, Promise.all([pending.get(ctx.jobId), read]).then(() => undefined))
    return response
  }

  return {
    /** Wraps the global fetch; call it once, before anything creates a client that captured fetch. */
    install() {
      if (original) return
      original = globalThis.fetch
      globalThis.fetch = observed
    },
    uninstall() {
      if (original) globalThis.fetch = original
      original = null
    },
    /** The fetch to use directly in tests, with no global side effects. */
    fetch: observed,
    /** Runs `fn` so every request it makes is tied to the job and, when given, the provider call. */
    run: <T>(jobId: string, fn: () => T, call: number | null = null): T => context.run({ jobId, call }, fn),
    /** Waits for the bodies still being read, then hands back what the job's requests showed. */
    async take(jobId: string): Promise<RequestTelemetry[]> {
      await pending.get(jobId)
      pending.delete(jobId)
      const taken = records.get(jobId) ?? []
      records.delete(jobId)
      return taken
    },
    /** The response models seen so far, across jobs. */
    effectiveModels: () => [...models].sort(),
    /** Wraps a provider so each of its calls carries the job and its ordinal. */
    provider(inner: LLMProvider, jobId: string): LLMProvider {
      let n = 0
      const wrap =
        <A extends unknown[], R extends ExpertResponse<unknown>>(call: (...args: A) => Promise<R>) =>
        (...args: A) =>
          context.run({ jobId, call: n++ }, () => call(...args))
      return {
        ...inner,
        reconstruct: wrap(inner.reconstruct.bind(inner)),
        proposeAdjustment: wrap(inner.proposeAdjustment.bind(inner)),
        reviewPurchase: wrap(inner.reviewPurchase.bind(inner)),
        readPhoto: wrap(inner.readPhoto.bind(inner)),
        planDesign: inner.planDesign ? wrap(inner.planDesign.bind(inner)) : null,
        adjustPlan: inner.adjustPlan ? wrap(inner.adjustPlan.bind(inner)) : null,
      }
    },
  }
}

export type Telemetry = ReturnType<typeof createTelemetry>
