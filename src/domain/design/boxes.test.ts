import { describe, expect, it } from 'vitest'
import { bounds, drawerGroups, overlap } from './boxes'
import type { Design } from './schema'

const box = (x0: number, x1: number, y0 = 0, y1 = 10, z0 = 0, z1 = 10) => ({ x0, x1, y0, y1, z0, z1 })

describe('boxes', () => {
  it('overlap is how far two boxes go into each other; negative, the gap between them', () => {
    expect(overlap(box(0, 10), box(6, 20), 'x')).toBe(4)
    expect(overlap(box(0, 10), box(10, 20), 'x')).toBe(0)
    expect(overlap(box(0, 10), box(13, 20), 'x')).toBe(-3)
  })

  it('bounds is the box around them all', () => {
    expect(bounds([box(0, 10), box(-5, 3, 2, 40, 1, 5)])).toEqual({ x0: -5, x1: 10, y0: 0, y1: 40, z0: 0, z1: 10 })
  })

  it('each drawer once, by the group of its front', () => {
    const pieces = [
      { role: 'drawer-front', group: 'top' },
      { role: 'drawer-side', group: 'top' },
      { role: 'drawer-side', group: 'loose' },
      { role: 'drawer-front', group: 'bottom' },
      { role: 'drawer-front', group: 'top' },
      { role: 'drawer-front' },
    ]
    expect(drawerGroups({ pieces } as unknown as Design)).toEqual(['top', 'bottom'])
  })
})
