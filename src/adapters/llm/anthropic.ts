import type Anthropic from '@anthropic-ai/sdk'
import { InvalidResponse, type LLMProvider } from '../../ports/LLMProvider'
import { createExpert, type Content, type Transport } from './common/expert'
import { ProviderError } from './common/errors'
import { extractJSON } from './common/json'

// Models that sometimes refuse because of safety classifiers: the API retries on another model by itself.
const WITH_FALLBACK = ['claude-opus-5', 'claude-fable-5-1']

/** The SDK is heavy: it loads the first time Claude is used. */
async function client(apiKey: string) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 300_000 })
}

// Schemas the API refused to compile into a grammar: from then on they travel in the prompt, and Zod still validates the answer.
const tooLarge = new WeakSet<object>()
const GRAMMAR_TOO_LARGE = /compiled grammar is too large/i

const formatInPrompt = (schema: Record<string, unknown>) =>
  `\n\n# Output format\nAnswer only with a JSON object that follows this JSON Schema, with no text around it:\n${JSON.stringify(schema)}`

const block = (c: Content): Anthropic.Beta.BetaContentBlockParam =>
  c.kind === 'text' ? { type: 'text', text: c.text } : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: c.base64 } }

/** Everything the call read: the system prompt is cached, and what comes from or goes into the cache is not in `input_tokens`. */
export const readTokens = (u: { input_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) =>
  u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)

// The SDK's timeout stops counting once the headers arrive: a stream that goes quiet after that is cut here.
const IDLE_MS = 120_000

const stalledError = () => Object.assign(new Error('The stream went quiet.'), { name: 'APIConnectionTimeoutError' })

/** How hard a model that thinks by default works on each answer; `off` turns its thinking off. Unset, the model's own default. */
export type Effort = 'low' | 'medium' | 'high' | 'off'

// Measured with `npm run compare`: Haiku 5.5 at low designs as well as at its default medium, in a quarter less time.
const EFFORT_OF: [prefix: string, effort: Effort][] = [['claude-haiku-5-5', 'low']]

export function createAnthropic(apiKey: string, model: string, { idleMs = IDLE_MS, effort: chosen }: { idleMs?: number; effort?: Effort } = {}): LLMProvider {
  const effort = chosen ?? EFFORT_OF.find(([prefix]) => model.startsWith(prefix))?.[1]
  const outputConfig = (schema: Record<string, unknown>, strict: boolean) => {
    const config = { ...(strict ? { format: { type: 'json_schema' as const, schema: schema } } : {}), ...(effort && effort !== 'off' ? { effort } : {}) }
    return Object.keys(config).length ? { output_config: config } : {}
  }
  const transport: Transport = {
    provider: 'anthropic',
    model: model,
    async completeJSON(system, content, schema, name, signal, onResponse) {
      const strict = !tooLarge.has(schema)
      let stalled = false
      let idle: ReturnType<typeof setTimeout> | undefined
      try {
        const stream = (await client(apiKey)).beta.messages.stream(
          {
            model: model,
            max_tokens: 32000,
            system: [{ type: 'text', text: strict ? system : system + formatInPrompt(schema), cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: content.map(block) }],
            ...outputConfig(schema, strict),
            ...(effort === 'off' ? { thinking: { type: 'disabled' as const } } : {}),
            ...(WITH_FALLBACK.includes(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          },
          { signal },
        )
        if (onResponse) stream.once('text', onResponse)
        const watch = () => {
          clearTimeout(idle)
          idle = setTimeout(() => {
            stalled = true
            stream.abort()
          }, idleMs)
        }
        stream.on('connect', watch)
        stream.on('streamEvent', watch)
        const final = await stream.finalMessage()
        if (final.stop_reason === 'refusal') throw new Error('El modelo se negó a responder esta petición.')
        if (final.stop_reason === 'max_tokens') throw new Error('La respuesta se cortó por el límite de tokens.')
        const text = final.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
        return { json: extractJSON(text), usage: { inputTokens: readTokens(final.usage), outputTokens: final.usage.output_tokens } }
      } catch (e) {
        if (e instanceof InvalidResponse) throw e
        if (stalled && !signal?.aborted) throw new ProviderError(stalledError())
        if (strict && !signal?.aborted && (e as { status?: number }).status === 400 && GRAMMAR_TOO_LARGE.test(String((e as Error).message))) {
          tooLarge.add(schema)
          return transport.completeJSON(system, content, schema, name, signal, onResponse)
        }
        // The SDK names its abort error 'Error'; the signal is what says the caller stopped it.
        throw new ProviderError(signal?.aborted ? new DOMException('Request was aborted.', 'AbortError') : e)
      } finally {
        clearTimeout(idle)
      }
    },
  }
  return createExpert(transport, `Claude · ${model}`)
}

export async function anthropicModels(apiKey: string): Promise<string[]> {
  try {
    const ids: string[] = []
    for await (const m of (await client(apiKey)).models.list({ limit: 100 })) ids.push(m.id)
    return ids
  } catch (e) {
    throw new ProviderError(e)
  }
}
