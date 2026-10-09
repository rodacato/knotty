import { describe, expect, it } from 'vitest'
import { finishCounted, leftOut, totalCovers } from './totalSummary'

describe('finishCounted', () => {
  it('counts a finish whose containers all have a price', () => {
    expect(finishCounted([240, 95])).toBe(true)
  })

  it('does not count a finish with a container that has no price', () => {
    expect(finishCounted([240, null])).toBe(false)
  })

  it('does not count a finish with nothing to buy', () => {
    expect(finishCounted([])).toBe(false)
  })
})

describe('totalCovers', () => {
  it('names the finish only when it is in the total', () => {
    expect(totalCovers(3, true)).toBe('3 hojas de triplay, herrajes, cubrecanto y acabado.')
    expect(totalCovers(3, false)).toBe('3 hojas de triplay, herrajes y cubrecanto.')
  })

  it('says one sheet in the singular', () => {
    expect(totalCovers(1, false)).toBe('1 hoja de triplay, herrajes y cubrecanto.')
  })
})

describe('leftOut', () => {
  it('names what has no price', () => {
    expect(leftOut(['Barniz de poliuretano Polyform 3000 1 L', 'Tornillo para madera #8 × ¾"'])).toBe(
      'Sin contar lo que no tiene precio: Barniz de poliuretano Polyform 3000 1 L, Tornillo para madera #8 × ¾".',
    )
  })

  it('says nothing when every price is known', () => {
    expect(leftOut([])).toBeNull()
  })
})
