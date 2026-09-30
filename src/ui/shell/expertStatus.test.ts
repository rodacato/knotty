import { describe, expect, it } from 'vitest'
import type { LLMConfiguration } from '../../ports/Preferences'
import { expertConnected } from './expertStatus'

const connection = { model: '', apiKey: '', host: '' }
const config = (active: LLMConfiguration['active'], patch: Partial<typeof connection> = {}): LLMConfiguration => ({
  active,
  keyStorage: 'memory',
  connections: {
    anthropic: { ...connection, ...(active === 'anthropic' ? patch : {}) },
    openai: { ...connection, ...(active === 'openai' ? patch : {}) },
    shellm: { ...connection, host: 'http://localhost:1234', ...(active === 'shellm' ? patch : {}) },
  },
})

describe('expertConnected', () => {
  it('is false for the simulated expert', () => {
    expect(expertConnected(config('simulated'))).toBe(false)
  })
  it('is false while the provider lacks its key or model', () => {
    expect(expertConnected(config('anthropic', { model: 'm' }))).toBe(false)
    expect(expertConnected(config('anthropic', { apiKey: 'k' }))).toBe(false)
  })
  it('is true once the provider has all it needs', () => {
    expect(expertConnected(config('anthropic', { apiKey: 'k', model: 'm', host: 'x' }))).toBe(true)
  })
})
