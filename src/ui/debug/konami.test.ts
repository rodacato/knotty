import { describe, expect, it } from 'vitest'
import { KONAMI, progress } from './KonamiTrail'

describe('Konami progress', () => {
  it('counts the right keys typed so far', () => {
    expect(progress(['ArrowUp', 'ArrowUp', 'ArrowDown'])).toBe(3)
    expect(progress(KONAMI)).toBe(KONAMI.length)
  })

  it('a wrong key breaks it, and a new attempt can start right away', () => {
    expect(progress(['ArrowUp', 'ArrowUp', 'x'])).toBe(0)
    expect(progress(['ArrowUp', 'ArrowUp', 'ArrowUp'])).toBe(2)
    expect(progress(['a', 'b', 'ArrowUp'])).toBe(1)
  })
})
