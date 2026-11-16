import { describe, expect, it } from 'vitest'
import { anthropicSpec } from './spec'

describe('an Anthropic model in KNOTTY_MODELS', () => {
  it('carries its effort after @, and without one keeps the model default', () => {
    expect(anthropicSpec('claude-haiku-5-5@low')).toEqual({ model: 'claude-haiku-5-5', effort: 'low' })
    expect(anthropicSpec('claude-haiku-5-5@off')).toEqual({ model: 'claude-haiku-5-5', effort: 'off' })
    expect(anthropicSpec('claude-haiku-5-5')).toEqual({ model: 'claude-haiku-5-5' })
  })

  it('stops the run on an effort it does not know, before any call', () => {
    expect(() => anthropicSpec('claude-haiku-5-5@fast')).toThrow(/Unknown effort «fast»/)
  })
})
