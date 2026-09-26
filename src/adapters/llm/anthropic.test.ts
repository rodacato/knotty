import { describe, expect, it } from 'vitest'
import { InvalidResponse } from '../../ports/LLMProvider'
import { parseJSON, readTokens } from './anthropic'

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
