import { describe, expect, it } from 'vitest'
import { InvalidResponse } from '../../../ports/LLMProvider'
import { extractJSON } from './json'

const failure = (text: string) => {
  try {
    extractJSON(text)
  } catch (e) {
    return e
  }
}

describe('extractJSON', () => {
  it('reads valid JSON', () => {
    expect(extractJSON('{"explanation": "Veo un buró"}')).toEqual({ explanation: 'Veo un buró' })
  })

  it('reads JSON inside a code fence or after a sentence', () => {
    expect(extractJSON('```json\n{"explanation": "Veo un buró"}\n```')).toEqual({ explanation: 'Veo un buró' })
    expect(extractJSON('Aquí va:\n{"explanation": "Veo un buró"}')).toEqual({ explanation: 'Veo un buró' })
  })

  it('ignores a stray closing brace after a complete object, as Haiku wrote on the piece-by-piece path', () => {
    expect(extractJSON('{"explanation": "Un exhibidor", "design": {"changes": ["Hazlo 10 cm más alto"]}}}')).toEqual({
      explanation: 'Un exhibidor',
      design: { changes: ['Hazlo 10 cm más alto'] },
    })
  })

  it('braces inside strings do not split the object', () => {
    expect(extractJSON('{"note": "usa {dos} tornillos"}')).toEqual({ note: 'usa {dos} tornillos' })
  })

  it('a cut answer is an InvalidResponse, so the use cases send it back to be corrected', () => {
    const text = '{"explanation": "Veo un buró", "design": {"pieces": ['
    const error = failure(text)
    expect(error).toBeInstanceOf(InvalidResponse)
    expect(error).toMatchObject({ response: text, problems: expect.stringMatching(/not valid JSON \(\d+ characters, ends in «.*pieces": \[»\)/) })
  })

  it('text with no object says so', () => {
    expect(failure('No puedo con esto')).toMatchObject({ problems: expect.stringMatching(/has no JSON object/) })
  })
})
