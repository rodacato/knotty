import { describe, expect, it } from 'vitest'
import { InvalidResponse } from '../../ports/LLMProvider'
import { parseJSON } from './anthropic'

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
