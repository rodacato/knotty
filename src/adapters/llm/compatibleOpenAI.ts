import type { LLMProvider } from '../../ports/LLMProvider'
import { createExpert, type Content, type Transport } from './common/expert'
import { ProviderError } from './common/errors'

// OpenAI and any compatible API (SheLLM). If the host does not take strict schemas or images, it falls back by itself and remembers it.

export interface CompatibleConnection {
  provider: 'openai' | 'shellm'
  host: string
  apiKey: string
  model: string
  label: string
}

interface Completed {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

const capabilities = new Map<string, { schema: boolean; images: boolean; stream: boolean; reasoning: boolean }>()
export const normalizeHost = (host: string) => host.trim().replace(/\/+$/, '').replace(/\/v1$/, '')

class Refusal extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Error ${status} del proveedor: ${body.slice(0, 300)}`)
  }
}

const LIMIT_MS = 5 * 60_000

/** When it could not even connect, with SheLLM it is almost always the host being off or the origin missing from its CORS list. */
function offline(c: Pick<CompatibleConnection, 'host'> & { provider?: CompatibleConnection['provider'] }) {
  if (c.provider !== 'shellm') return 'No se pudo conectar desde el navegador: revisa tu conexión a internet.'
  const origin = typeof location === 'undefined' ? 'el origen de Knotty' : location.origin
  return `No se pudo conectar con SheLLM en ${normalizeHost(c.host)}. Revisa que esté corriendo y que SHELLM_CORS_ORIGINS incluya ${origin}. Si pasa después de mucho rato, el túnel o proxy pudo cortar la conexión por tiempo.`
}

const LATE_CUTOFF_S = 45

function timeoutCut(c: { provider?: CompatibleConnection['provider'] }, seconds: number) {
  const name = c.provider === 'shellm' ? 'SheLLM' : 'El proveedor'
  return `${name} cortó la petición a los ${seconds} s: el modelo tardó más que su límite de tiempo. Armar el diseño completo puede tomar 2 o 3 minutos; ${c.provider === 'shellm' ? 'sube TIMEOUT_MS de SheLLM a 300000' : 'intenta de nuevo'} o usa un modelo más rápido.`
}

/** Does the host answer a GET? If so, what failed was the POST itself. */
async function answers(c: Pick<CompatibleConnection, 'host' | 'apiKey'>) {
  try {
    const r = await fetch(`${normalizeHost(c.host)}/v1/models`, { signal: AbortSignal.timeout(5000), headers: c.apiKey ? { authorization: `Bearer ${c.apiKey}` } : {} })
    return r.ok || r.status === 304
  } catch {
    return false
  }
}

function postBlocked(c: Pick<CompatibleConnection, 'host'> & { provider?: CompatibleConnection['provider'] }, body: RequestInit['body']) {
  const kb = typeof body === 'string' ? Math.round(body.length / 1024) : null
  const name = c.provider === 'shellm' ? 'SheLLM' : 'El host'
  return `${name} responde, pero el navegador no pudo mandarle el pedido${kb ? ` (${kb} KB)` : ''}. Suele ser CORS del POST: que permita las cabeceras Content-Type y Authorization desde ${typeof location === 'undefined' ? 'este sitio' : location.origin}. Si hay un proxy o túnel enfrente, revisa también su límite de tamaño y de tiempo.`
}

async function ask(c: Pick<CompatibleConnection, 'host' | 'apiKey'> & { provider?: CompatibleConnection['provider'] }, route: string, init: RequestInit = {}) {
  let response: Response
  const limit = AbortSignal.timeout(LIMIT_MS)
  const start = Date.now()
  try {
    response = await fetch(`${normalizeHost(c.host)}/v1${route}`, {
      ...init,
      signal: init.signal ? AbortSignal.any([init.signal, limit]) : limit,
      headers: { 'content-type': 'application/json', ...(c.apiKey ? { authorization: `Bearer ${c.apiKey}` } : {}) },
    })
  } catch (e) {
    if (limit.aborted && !init.signal?.aborted) throw new Error(`El experto tardó más de ${LIMIT_MS / 60_000} minutos en responder. Intenta de nuevo o con un modelo más rápido.`)
    const seconds = Math.round((Date.now() - start) / 1000)
    // A cut after a long time is a time limit, even when it arrives without CORS headers and looks like no connection.
    if (e instanceof TypeError && seconds >= LATE_CUTOFF_S) throw new Error(timeoutCut(c, seconds))
    if (e instanceof TypeError) throw new Error(init.method === 'POST' && (await answers(c)) ? postBlocked(c, init.body) : offline(c))
    throw new ProviderError(e)
  }
  if (response.status === 401 || response.status === 403) throw new Error(c.apiKey ? 'La API key no es válida.' : 'El host pide una API key.')
  if (response.status === 429) throw new Error('Límite de peticiones alcanzado; espera un momento.')
  if (response.status === 504 || response.status === 524) throw new Error(timeoutCut(c, Math.round((Date.now() - start) / 1000)))
  if (response.status === 404) throw new Error('El modelo o la ruta no existen en ese host.')
  if (!response.ok) throw new Refusal(response.status, await response.text())
  try {
    return (response.headers.get('content-type') ?? '').includes('text/event-stream') ? await readStream(response) : await response.json()
  } catch (e) {
    // The connection can also drop mid-stream: it is explained as if it had not started.
    if (limit.aborted && !init.signal?.aborted) throw new Error(`El experto tardó más de ${LIMIT_MS / 60_000} minutos en responder. Intenta de nuevo o con un modelo más rápido.`)
    if (e instanceof TypeError) throw new Error(timeoutCut(c, Math.round((Date.now() - start) / 1000)))
    throw e
  }
}

/** Puts the pieces of a chat/completions SSE stream together in the shape of a whole answer. */
async function readStream(response: Response): Promise<Completed> {
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
  let pending = ''
  let content = ''
  let refusal = ''
  let end: string | undefined
  let usage: Completed['usage']
  let finished = false
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    pending += value
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''
    for (const line of lines) {
      const datum = line.startsWith('data:') ? line.slice(5).trim() : ''
      if (datum === '[DONE]') finished = true
      if (!datum || datum === '[DONE]') continue
      const event = JSON.parse(datum) as { choices?: { delta?: { content?: string | null; refusal?: string | null }; finish_reason?: string | null }[]; usage?: Completed['usage']; error?: { message?: string } }
      if (event.error) {
        const detail = event.error.message ?? 'error sin detalle'
        // 143 is SIGTERM: the host killed the model, almost always for its own time limit.
        if (/code 143|SIGTERM|timed? ?out/i.test(detail)) throw new Error(`El proveedor detuvo al modelo antes de terminar (${detail}); suele ser su límite de tiempo. En SheLLM sube TIMEOUT_MS a 300000.`)
        throw new Error(`El proveedor cortó la respuesta: ${detail}`)
      }
      const choice = event.choices?.[0]
      content += choice?.delta?.content ?? ''
      refusal += choice?.delta?.refusal ?? ''
      end = choice?.finish_reason ?? end
      if (event.usage) usage = event.usage
    }
  }
  // A proxy that cuts without an error leaves the stream half done: better to say so than to report invalid JSON.
  if (!finished && !end) throw new StreamCut(content.length)
  return { choices: [{ message: { content: content, refusal: refusal || null }, finish_reason: end }], usage }
}

class StreamCut extends Error {
  constructor(received: number) {
    super(`La conexión se cortó a media respuesta (llegaron ${Math.round(received / 1024)} KB). Suele ser un proxy como Cloudflare que corta tras 100 s sin datos mientras el modelo piensa.`)
  }
}

/** The top-level JSON objects in the text, respecting braces inside strings. */
function topLevelObjects(text: string): string[] {
  const objects: string[] = []
  let depthValue = 0
  let start = -1
  let chained = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (chained) {
      if (c === '\\') i++
      else if (c === '"') chained = false
    } else if (c === '"') chained = depthValue > 0
    else if (c === '{' && depthValue++ === 0) start = i
    else if (c === '}' && depthValue > 0 && --depthValue === 0) objects.push(text.slice(start, i + 1))
  }
  return objects
}

const ESCAPES: Record<string, string> = { '\n': '\\n', '\t': '\\t', '\r': '\\r' }

/** Escapes raw newlines and tabs inside strings: JSON forbids them, but some models write them. */
function escapeControls(json: string) {
  let output = ''
  let chained = false
  for (let i = 0; i < json.length; i++) {
    const c = json[i]
    if (chained && c === '\\') {
      output += c + (json[++i] ?? '')
      continue
    }
    if (c === '"') chained = !chained
    output += chained && ESCAPES[c] ? ESCAPES[c] : c
  }
  return output
}

/** An object with a single key whose value is the JSON written as text: the model wrapped it once too often. */
function unwrap(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const values = Object.values(value)
  if (values.length !== 1 || typeof values[0] !== 'string') return value
  try {
    const inner = JSON.parse(values[0])
    return inner && typeof inner === 'object' ? inner : value
  } catch {
    return value
  }
}

/** Strips code fences and other text; if several attempts came in a row, keeps the last one that can be read. */
function extractJSON(text: string) {
  // How much arrived and how it ends tell a cut answer from a badly written one.
  const sample = `${text.length.toLocaleString('es-MX')} caracteres, termina en «${text.slice(-40).replace(/\s+/g, ' ')}»`
  const candidates = topLevelObjects(text)
  if (!text.includes('{')) throw new Error(`El modelo no devolvió JSON (${sample}).`)
  for (const candidate of candidates.reverse()) {
    for (const version of [candidate, escapeControls(candidate)]) {
      try {
        return unwrap(JSON.parse(version))
      } catch {
        // A broken attempt: try it fixed, then the previous one.
      }
    }
  }
  throw new Error(`El modelo devolvió un JSON inválido (${sample}).`)
}

export function createCompatible(c: CompatibleConnection): LLMProvider {
  const key = normalizeHost(c.host)
  const can = () => capabilities.get(key) ?? { schema: true, images: true, stream: true, reasoning: true }

  const transport: Transport = {
    provider: c.provider,
    model: c.model,
    async completeJSON(system, content, schema, name, signal) {
      for (;;) {
        const { schema: withSchema, images, stream, reasoning } = can()
        const photos = content.filter((x) => x.kind === 'image').length
        const parts: Content[] = images
          ? content
          : [
              ...content.filter((x) => x.kind === 'text'),
              ...(photos ? [{ kind: 'text' as const, text: `(The person took ${photos} photos, but this provider cannot see them. Work from the measures, the notes and the angles; mark low confidence and ask what you cannot know.)` }] : []),
            ]
        const instruction = withSchema ? system : `${system}\n\n# Output format\nAnswer only with a JSON object that follows this JSON Schema, with no text around it:\n${JSON.stringify(schema)}`
        try {
          const r = (await ask(c, '/chat/completions', {
            method: 'POST',
            signal,
            body: JSON.stringify({
              model: c.model,
              messages: [
                { role: 'system', content: instruction },
                { role: 'user', content: parts.map((p) => (p.kind === 'text' ? { type: 'text', text: p.text } : { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${p.base64}`, detail: 'high' } })) },
              ],
              response_format: withSchema ? { type: 'json_schema', json_schema: { name: name, strict: true, schema: schema } } : { type: 'json_object' },
              // Streaming, the connection is never silent for minutes: neither the host nor a proxy cuts it for being idle.
              ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
              // Filling in JSON with a schema needs little thinking: long reasoning is most of the time and the cost.
              ...(reasoning ? { reasoning_effort: 'low' } : {}),
            }),
          })) as Completed
          const choice = r.choices?.[0]
          if (choice?.message?.refusal) throw new Error(`El modelo se negó: ${choice.message.refusal}`)
          if (choice?.finish_reason === 'length') throw new Error('La respuesta se cortó por el límite de tokens.')
          const warnings = !images && photos ? [`${c.label.split(' · ')[0]} no aceptó las fotos, así que el experto trabajó sin verlas: con tus medidas, notas y respuestas.`] : undefined
          return { json: extractJSON(choice?.message?.content ?? ''), usage: { inputTokens: r.usage?.prompt_tokens, outputTokens: r.usage?.completion_tokens }, warnings: warnings }
        } catch (e) {
          if (!(e instanceof Refusal)) throw e
          // A 413 is the whole body being too large: with photos, it is almost always them.
          const byImages = (e.status === 400 && /image/i.test(e.body)) || e.status === 413
          if (e.status === 400 && reasoning && /reasoning/i.test(e.body)) capabilities.set(key, { ...can(), reasoning: false })
          else if (e.status === 400 && stream && /stream/i.test(e.body)) capabilities.set(key, { ...can(), stream: false })
          else if (e.status === 400 && withSchema && /response_format|json_schema/i.test(e.body)) capabilities.set(key, { ...can(), schema: false })
          else if (images && photos && byImages) capabilities.set(key, { ...can(), images: false })
          else throw e
        }
      }
    },
  }
  return createExpert(transport, c.label)
}

export async function compatibleModels(c: Pick<CompatibleConnection, 'host' | 'apiKey'>, openAIOnly: boolean): Promise<string[]> {
  const r = (await ask(c, '/models')) as { data?: { id: string }[] }
  const ids = (r.data ?? []).map((m) => m.id)
  return openAIOnly ? ids.filter((id) => /^(gpt|o\d|chatgpt)/.test(id) && !/audio|realtime|transcribe|tts|image|search/.test(id)).sort() : ids
}
