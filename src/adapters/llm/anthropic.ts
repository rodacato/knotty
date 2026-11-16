import type Anthropic from '@anthropic-ai/sdk'
import { InvalidResponse, type LLMProvider } from '../../ports/LLMProvider'
import { createExpert, invalidJSON, type Content, type Transport } from './common/expert'
import { ProviderError } from './common/errors'

// Models that sometimes refuse because of safety classifiers: the API retries on another model by itself.
const WITH_FALLBACK = ['claude-opus-5', 'claude-fable-5-1']

/** The SDK is heavy: it loads the first time Claude is used. */
async function client(apiKey: string) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 300_000 })
}

/** The model's text as JSON; text that does not parse goes back to the model to be corrected, like a schema mismatch. */
export function parseJSON(text: string): unknown {
  const bare = text
    .trim()
    .replace(/^```(?:json)?\s*\n/, '')
    .replace(/\n```$/, '')
  try {
    return JSON.parse(bare)
  } catch {
    throw invalidJSON(text)
  }
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

export function createAnthropic(apiKey: string, model: string): LLMProvider {
  const transport: Transport = {
    provider: 'anthropic',
    model: model,
    async completeJSON(system, content, schema, name, signal, onResponse) {
      const strict = !tooLarge.has(schema)
      try {
        const stream = (await client(apiKey)).beta.messages.stream(
          {
            model: model,
            max_tokens: 32000,
            system: [{ type: 'text', text: strict ? system : system + formatInPrompt(schema), cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: content.map(block) }],
            ...(strict ? { output_config: { format: { type: 'json_schema' as const, schema: schema } } } : {}),
            ...(WITH_FALLBACK.includes(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          },
          { signal },
        )
        if (onResponse) stream.once('text', onResponse)
        const final = await stream.finalMessage()
        if (final.stop_reason === 'refusal') throw new Error('El modelo se negó a responder esta petición.')
        if (final.stop_reason === 'max_tokens') throw new Error('La respuesta se cortó por el límite de tokens.')
        const text = final.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
        return { json: parseJSON(text), usage: { inputTokens: readTokens(final.usage), outputTokens: final.usage.output_tokens } }
      } catch (e) {
        if (e instanceof InvalidResponse) throw e
        if (strict && !signal?.aborted && (e as { status?: number }).status === 400 && GRAMMAR_TOO_LARGE.test(String((e as Error).message))) {
          tooLarge.add(schema)
          return transport.completeJSON(system, content, schema, name, signal, onResponse)
        }
        // The SDK names its abort error 'Error'; the signal is what says the caller stopped it.
        throw new ProviderError(signal?.aborted ? new DOMException('Request was aborted.', 'AbortError') : e)
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
