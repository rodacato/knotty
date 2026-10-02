import { z } from 'zod'
import { InvalidResponse, type ExpertResponse, type LLMProvider } from '../../ports/LLMProvider'
import { ProviderError } from './common/errors'

// Records the answers at the provider port and replays them offline through the app.
// The recorded `value` is already schema-validated: adapter-level parsing and repair cannot be replayed from it.

export const RECORDING_VERSION = 1

export const METHODS = ['reconstruct', 'planDesign', 'adjustPlan', 'proposeAdjustment', 'readPhoto', 'reviewPurchase'] as const
export type Method = (typeof METHODS)[number]

/** Stable stringify: sorted keys, no undefined, no `signal`. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
    return value === undefined || typeof value === 'function' ? 'null' : JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const body = Object.entries(value as Record<string, unknown>)
    .filter(([k, v]) => v !== undefined && typeof v !== 'function' && k !== 'signal')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
  return `{${body.join(',')}}`
}

/** cyrb53: a 53-bit non-cryptographic hash, in hex. */
export function hashString(text: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

/** The request as it is identified: images by hash and size, the catalog by the caller's stamp, no signal. */
function identity(value: unknown, catalogStamp: string): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, v) => {
      if (key === 'base64' && typeof v === 'string') return `[image ${hashString(v)} ${v.length}]`
      if (key === 'catalog') return `[catalog ${catalogStamp}]`
      if (key === 'signal') return undefined
      return v
    }) ?? 'null',
  )
}

export const requestKey = (method: string, request: unknown, catalogStamp: string) => `${method}:${hashString(canonicalJson(identity(request, catalogStamp)))}`

export interface RecordedError {
  kind: 'invalid-response' | 'provider' | 'other'
  name: string
  message: string
  problems?: string
  response?: unknown
}

export type RecordedOutcome =
  | { ok: true; value: unknown; origin: ExpertResponse<unknown>['origin']; usage: ExpertResponse<unknown>['usage']; warnings: string[] }
  | { ok: false; error: RecordedError }

export interface RecordedCall {
  method: Method
  key: string
  request: unknown
  outcome: RecordedOutcome
  ms: number
}

export interface Recording {
  version: number
  catalogStamp: string
  /** Methods the recorded provider did not have (null), so the replay is as absent as the original. */
  unsupported: Method[]
  entries: RecordedCall[]
}

export const emptyRecording = (catalogStamp: string): Recording => ({ version: RECORDING_VERSION, catalogStamp, unsupported: [], entries: [] })

const RecordedErrorSchema = z.object({
  kind: z.enum(['invalid-response', 'provider', 'other']),
  name: z.string(),
  message: z.string(),
  problems: z.string().optional(),
  response: z.unknown().optional(),
})

export const RecordingSchema = z.object({
  version: z.literal(RECORDING_VERSION),
  catalogStamp: z.string(),
  unsupported: z.array(z.enum(METHODS)),
  entries: z.array(
    z.object({
      method: z.enum(METHODS),
      key: z.string(),
      request: z.unknown(),
      outcome: z.union([
        z.object({
          ok: z.literal(true),
          value: z.unknown(),
          origin: z.object({ promptId: z.string(), provider: z.string(), model: z.string() }),
          usage: z.object({ inputTokens: z.number().optional(), outputTokens: z.number().optional() }),
          warnings: z.array(z.string()),
        }),
        z.object({ ok: z.literal(false), error: RecordedErrorSchema }),
      ]),
      ms: z.number(),
    }),
  ),
})

/** Refuses loudly a file that is not a recording of this version. */
export function parseRecording(raw: unknown): Recording {
  const version = (raw as { version?: unknown } | null)?.version
  if (version !== RECORDING_VERSION) throw new Error(`Recording version ${String(version)} is not supported (expected ${RECORDING_VERSION}).`)
  return RecordingSchema.parse(raw) as Recording
}

const clone = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T))

function recordError(e: unknown): RecordedError {
  if (e instanceof InvalidResponse) return { kind: 'invalid-response', name: e.name, message: e.message, problems: e.problems, response: clone(e.response) }
  if (e instanceof ProviderError) return { kind: 'provider', name: e.name, message: e.message }
  return e instanceof Error ? { kind: 'other', name: e.name, message: e.message } : { kind: 'other', name: 'Error', message: String(e) }
}

function rebuildError(error: RecordedError): Error {
  if (error.kind === 'invalid-response') return new InvalidResponse(clone(error.response), error.problems ?? '')
  if (error.kind === 'provider') return new ProviderError(Object.assign(new Error(error.message), { name: error.name === 'AbortError' ? 'AbortError' : 'Error' }))
  return Object.assign(new Error(error.message), { name: error.name })
}

/** Wraps every method; each call is appended to `sink.entries`. Nothing but the sanitized request and the answer is kept. */
export function recordingProvider(inner: LLMProvider, sink: Recording, options: { catalogStamp: string }): LLMProvider {
  sink.catalogStamp = options.catalogStamp
  const wrap =
    <R extends ExpertResponse<unknown>, A extends [unknown, AbortSignal]>(method: Method, call: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const started = performance.now()
      const request = identity(args[0], options.catalogStamp)
      const key = requestKey(method, args[0], options.catalogStamp)
      const ms = () => Math.round(performance.now() - started)
      try {
        const answer = await call(...args)
        sink.entries.push({ method, key, request, ms: ms(), outcome: { ok: true, value: clone(answer.value), origin: { ...answer.origin }, usage: { ...answer.usage }, warnings: [...(answer.warnings ?? [])] } })
        return answer
      } catch (e) {
        sink.entries.push({ method, key, request, ms: ms(), outcome: { ok: false, error: recordError(e) } })
        throw e
      }
    }
  const optional = <A extends [unknown, AbortSignal], R extends ExpertResponse<unknown>>(method: Method, call: ((...args: A) => Promise<R>) | null) => {
    if (call) return wrap(method, call.bind(inner))
    if (!sink.unsupported.includes(method)) sink.unsupported.push(method)
    return null
  }
  return {
    ...inner,
    reconstruct: wrap('reconstruct', inner.reconstruct.bind(inner)),
    proposeAdjustment: wrap('proposeAdjustment', inner.proposeAdjustment.bind(inner)),
    reviewPurchase: wrap('reviewPurchase', inner.reviewPurchase.bind(inner)),
    readPhoto: wrap('readPhoto', inner.readPhoto.bind(inner)),
    planDesign: optional('planDesign', inner.planDesign),
    adjustPlan: optional('adjustPlan', inner.adjustPlan),
  }
}

/** The first path where two canonical requests differ, or null. */
export function firstDifference(a: unknown, b: unknown, path = '$'): string | null {
  if (a === b) return null
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return path
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  for (const k of keys) {
    const at = Array.isArray(a) ? `${path}[${k}]` : `${path}.${k}`
    if (!(k in a) || !(k in b)) return at
    const found = firstDifference((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], at)
    if (found) return found
  }
  return null
}

export class ReplayMismatch extends Error {
  constructor(
    readonly method: string,
    readonly key: string,
    readonly reason: string,
    readonly nearest: RecordedCall | null,
    readonly differsAt: string | null,
  ) {
    super(`Replay mismatch on ${method} (${key}): ${reason}${differsAt ? `; first difference at ${differsAt}` : ''}`)
    this.name = 'ReplayMismatch'
  }
}

export interface ReplayProvider extends LLMProvider {
  /** Entries never consumed: a non-empty list means the recording does not fit what ran. */
  unused(): RecordedCall[]
  /** Every mismatch thrown: the app may wrap or swallow the error, so the runner must check this list. */
  mismatches(): ReplayMismatch[]
}

export function replayProvider(recording: Recording, options: { catalogStamp: string }): ReplayProvider {
  const consumed = new Set<RecordedCall>()
  const mismatches: ReplayMismatch[] = []
  const calls: Partial<Record<Method, number>> = {}
  const catalogMatches = recording.catalogStamp === options.catalogStamp

  const answer = (method: Method, request: unknown): RecordedOutcome => {
    const ordinal = (calls[method] = (calls[method] ?? -1) + 1)
    const key = requestKey(method, request, options.catalogStamp)
    const sameMethod = recording.entries.filter((e) => e.method === method)
    const nearest = sameMethod[ordinal] ?? null
    const fail = (reason: string, from: RecordedCall | null = nearest) => {
      const mismatch = new ReplayMismatch(method, key, reason, from, from ? firstDifference(from.request, identity(request, options.catalogStamp)) : null)
      mismatches.push(mismatch)
      return mismatch
    }
    if (!catalogMatches) throw fail(`catalog stamp "${options.catalogStamp}" differs from the recording's "${recording.catalogStamp}"`)
    const same = sameMethod.filter((e) => e.key === key)
    const next = same.find((e) => !consumed.has(e))
    if (!next) throw fail(same.length ? `every recorded answer for this request was already used (${same.length})` : 'no recorded call has this request', same.at(-1) ?? nearest)
    consumed.add(next)
    return next.outcome
  }

  const serve =
    <R extends ExpertResponse<unknown>>(method: Method) =>
    async (request: unknown): Promise<R> => {
      const outcome = answer(method, request)
      if (!outcome.ok) throw rebuildError(outcome.error)
      return { value: clone(outcome.value), origin: { ...outcome.origin }, usage: { ...outcome.usage }, ...(outcome.warnings.length ? { warnings: [...outcome.warnings] } : {}) } as R
    }
  const optional = <F>(method: Method, fn: F) => (recording.unsupported.includes(method) ? null : fn)

  return {
    id: 'replay',
    label: 'Replay',
    reconstruct: serve('reconstruct'),
    proposeAdjustment: serve('proposeAdjustment'),
    reviewPurchase: serve('reviewPurchase'),
    readPhoto: serve('readPhoto'),
    planDesign: optional('planDesign', serve('planDesign')),
    adjustPlan: optional('adjustPlan', serve('adjustPlan')),
    mismatches: () => [...mismatches],
    unused: () => recording.entries.filter((e) => !consumed.has(e)),
  } as ReplayProvider
}
