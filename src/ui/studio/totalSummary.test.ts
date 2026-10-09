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
    expect(totalCovers({ sheets: 3, onlyPlywood: true, withBanding: true, withFinish: true })).toBe('3 hojas de triplay, herrajes, cubrecanto y acabado.')
    expect(totalCovers({ sheets: 3, onlyPlywood: true, withBanding: true, withFinish: false })).toBe('3 hojas de triplay, herrajes y cubrecanto.')
  })

  it('leaves the edge banding out when the piece buys none', () => {
    expect(totalCovers({ sheets: 2, onlyPlywood: true, withBanding: false, withFinish: false })).toBe('2 hojas de triplay y herrajes.')
    expect(totalCovers({ sheets: 2, onlyPlywood: true, withBanding: false, withFinish: true })).toBe('2 hojas de triplay, herrajes y acabado.')
  })

  it('says one sheet in the singular', () => {
    expect(totalCovers({ sheets: 1, onlyPlywood: true, withBanding: true, withFinish: false })).toBe('1 hoja de triplay, herrajes y cubrecanto.')
    expect(totalCovers({ sheets: 1, onlyPlywood: false, withBanding: true, withFinish: false })).toBe('1 tablero, herrajes y cubrecanto.')
  })

  it('does not call the sheets plywood when some are not', () => {
    expect(totalCovers({ sheets: 4, onlyPlywood: false, withBanding: true, withFinish: false })).toBe('4 tableros, herrajes y cubrecanto.')
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
