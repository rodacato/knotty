import { afterEach, describe, expect, it, vi } from 'vitest'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { InvalidResponse } from '../../ports/LLMProvider'
import { createAnthropic, parseJSON, readTokens } from './anthropic'

afterEach(() => vi.unstubAllGlobals())

describe('parseJSON', () => {
  it('reads valid JSON', () => {
    expect(parseJSON('{"explanation": "Veo un buró"}')).toEqual({ explanation: 'Veo un buró' })
  })

  it('reads JSON inside a code fence, which a model writes when the schema travels in the prompt', () => {
    expect(parseJSON('```json\n{"explanation": "Veo un buró"}\n```')).toEqual({ explanation: 'Veo un buró' })
  })

  it('invalid JSON is an InvalidResponse, so the use cases send it back to be corrected', () => {
    const text = '{"explanation": "Veo un buró", "design": {"pieces": ['
    const error = (() => {
      try {
        parseJSON(text)
      } catch (e) {
        return e
      }
    })()
    expect(error).toBeInstanceOf(InvalidResponse)
    expect(error).toMatchObject({ response: text, problems: expect.stringMatching(/not valid JSON \(\d+ characters, ends in «.*pieces": \[»\)/) })
  })
})

describe('input tokens', () => {
  it('count what came from the cache and what went into it: the system prompt is cached', () => {
    expect(readTokens({ input_tokens: 400, cache_read_input_tokens: 2500, cache_creation_input_tokens: 0 })).toBe(2900)
    expect(readTokens({ input_tokens: 400, cache_read_input_tokens: null, cache_creation_input_tokens: 2500 })).toBe(2900)
    expect(readTokens({ input_tokens: 2900 })).toBe(2900)
  })
})

describe('a schema the API cannot compile', () => {
  it('is asked again with the schema in the prompt, and every later call skips the strict format', async () => {
    const bodies: Record<string, unknown>[] = []
    const reply = (message: string) => new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message } }), { status: 400, headers: { 'content-type': 'application/json' } })
    vi.stubGlobal('fetch', async (_: unknown, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      return reply(bodies.length === 1 ? 'The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools.' : 'stop here')
    })
    const expert = createAnthropic('sk-test', 'claude-haiku-5-5')
    const review = () => expert.reviewPurchase({ context: '', review: '', design: exampleBookcase, checks: [], catalog: testCatalog }, new AbortController().signal).catch((e: unknown) => e)

    expect(await review()).toMatchObject({ message: expect.stringMatching(/stop here/) })
    expect(await review()).toMatchObject({ message: expect.stringMatching(/stop here/) })

    const system = (b: Record<string, unknown>) => (b.system as { text: string }[])[0].text
    expect(bodies).toHaveLength(3)
    expect(bodies[0].output_config).toBeDefined()
    expect(system(bodies[0])).not.toContain('# Output format')
    for (const later of bodies.slice(1)) {
      expect(later.output_config).toBeUndefined()
      expect(system(later)).toContain('# Output format')
      expect(system(later)).toContain(JSON.stringify((bodies[0].output_config as { format: { schema: unknown } }).format.schema))
    }
  })
})

describe('a call the caller stops', () => {
  it('comes out as an AbortError, which is how the bench tells cancelled from failed', async () => {
    const pending = (_: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    vi.stubGlobal('fetch', pending)
    const stop = new AbortController()
    const asking = createAnthropic('sk-test', 'claude-sonnet-4-5').reviewPurchase({ context: '', review: '', design: exampleBookcase, checks: [], catalog: testCatalog }, stop.signal)
    setTimeout(() => stop.abort(), 50)
    expect(await asking.catch((e: unknown) => e)).toMatchObject({ name: 'AbortError' })
  })
})
