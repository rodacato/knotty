import { describe, expect, it } from 'vitest'
import { DEFAULT_PARALLEL, SHELLM_PARALLEL, defaultParallel } from './run'

describe('concurrency per host', () => {
  it('lets SheLLM take the measured level and keeps the others conservative', () => {
    expect(defaultParallel('shellm:claude')).toBe(SHELLM_PARALLEL)
    expect(defaultParallel('anthropic:claude-sonnet-5')).toBe(DEFAULT_PARALLEL)
    expect(defaultParallel('openai:gpt-5')).toBe(DEFAULT_PARALLEL)
    expect(defaultParallel('simulated')).toBe(DEFAULT_PARALLEL)
  })

  it('never defaults above the level that was measured', () => {
    expect(SHELLM_PARALLEL).toBeLessThanOrEqual(4)
    expect(DEFAULT_PARALLEL).toBeLessThan(SHELLM_PARALLEL)
  })
})
