import { describe, expect, it } from 'vitest'
import { conflicts, footprint, nextTurn, rectOf, snap, type Placed, type Room } from './room'

const room: Room = { width: 3000, depth: 3000, height: 2500 }
const bed = { width: 2000, depth: 1000 }
const shelf = { width: 900, depth: 300 }
const at = (key: string, code: string, x: number, z: number, turn: Placed['turn'] = 0): Placed => ({ key, code, x, z, turn })
const sizes: Record<string, { width: number; depth: number }> = { bed, shelf }

describe('the room prototype', () => {
  it('turns a piece a quarter at a time, swapping its footprint at 90 and 270', () => {
    expect([0, 90, 180, 270].map((t) => nextTurn(t as Placed['turn']))).toEqual([90, 180, 270, 0])
    expect(footprint(bed, 90)).toEqual({ width: 1000, depth: 2000 })
    expect(footprint(bed, 180)).toEqual(bed)
    expect(rectOf(at('a', 'bed', 1500, 500, 90), bed)).toEqual({ x0: 1000, x1: 2000, z0: -500, z1: 1500 })
  })

  it('flags a piece that sticks out of the room or stands on another, and not two that only touch', () => {
    const items = [at('a', 'bed', 1000, 500), at('b', 'shelf', 2450, 150), at('c', 'shelf', 2450, 450)]
    expect(conflicts(room, items, (code) => sizes[code])).toEqual(new Set())
    expect(conflicts(room, [at('a', 'bed', 900, 500)], (code) => sizes[code])).toEqual(new Set(['a']))
    expect(conflicts(room, [at('a', 'bed', 1000, 500), at('b', 'shelf', 1500, 400)], (code) => sizes[code])).toEqual(new Set(['a', 'b']))
  })

  it('sticks a dropped piece to a wall or a neighbour within reach, and leaves it where it is otherwise', () => {
    expect(snap(at('a', 'bed', 1030, 520), bed, room, [])).toEqual({ x: 1000, z: 500 })
    const neighbour = rectOf(at('n', 'bed', 1000, 500), bed)
    expect(snap(at('b', 'shelf', 2480, 1500), shelf, room, [neighbour])).toEqual({ x: 2450, z: 1500 })
    expect(snap(at('c', 'shelf', 1500, 1500), shelf, room, [])).toEqual({ x: 1500, z: 1500 })
  })
})
