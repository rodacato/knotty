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
