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
  try {
    return JSON.parse(text)
  } catch {
    throw invalidJSON(text)
  }
}

const block = (c: Content): Anthropic.Beta.BetaContentBlockParam =>
  c.kind === 'text' ? { type: 'text', text: c.text } : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: c.base64 } }

/** Everything the call read: the system prompt is cached, and what comes from or goes into the cache is not in `input_tokens`. */
export const readTokens = (u: { input_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) =>
  u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)

export function createAnthropic(apiKey: string, model: string): LLMProvider {
  const transport: Transport = {
    provider: 'anthropic',
    model: model,
    async completeJSON(system, content, schema, _name, signal) {
      try {
        const stream = (await client(apiKey)).beta.messages.stream(
          {
            model: model,
            max_tokens: 32000,
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: content.map(block) }],
            output_config: { format: { type: 'json_schema', schema: schema } },
            ...(WITH_FALLBACK.includes(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          },
          { signal },
        )
        const final = await stream.finalMessage()
        if (final.stop_reason === 'refusal') throw new Error('El modelo se negó a responder esta petición.')
        if (final.stop_reason === 'max_tokens') throw new Error('La respuesta se cortó por el límite de tokens.')
        const text = final.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
        return { json: parseJSON(text), usage: { inputTokens: readTokens(final.usage), outputTokens: final.usage.output_tokens } }
      } catch (e) {
        if (e instanceof InvalidResponse) throw e
        throw new ProviderError(e)
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
