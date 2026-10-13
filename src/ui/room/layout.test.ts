import { describe, expect, it } from 'vitest'
import { blocksOpening, exampleLayout, facing, freePosition, issues, openingProblem, rectOf, slidOpening, validSpace, type Item, type Layout, type Opening } from './layout'

const room = { width: 5000, depth: 5000, height: 2500 }
const block = (changes: Partial<Item> = {}): Item =>
  ({
    kind: 'block',
    id: 'one',
    name: 'Existente',
    size: { width: 100, depth: 100, height: 1800 },
    x: 1250,
    z: 500,
    elevation: 0,
    turn: 0,
    ...changes,
  }) as Item
const door: Opening = {
  id: 'door',
  kind: 'door',
  wall: 'back',
  offset: 1000,
  width: 1000,
  height: 2100,
  sill: 0,
  hinge: 'start',
  swing: 'inside',
}
const layout = (items: Item[], openings: Opening[] = []): Layout => ({
  room,
  items,
  openings,
  anchorId: items[0]?.id ?? '',
})

describe('room spatial checks', () => {
  it('uses the turned outside dimensions, and detects furniture above the ceiling', () => {
    const item = block({
      x: 500,
      z: 1000,
      size: { width: 1600, depth: 400, height: 2600 },
    })
    expect(issues(layout([item])).map((i) => i.kind)).toEqual(['outside', 'height'])
    expect(rectOf({ ...item, turn: 90 })).toEqual({
      x0: 300,
      x1: 700,
      z0: 200,
      z1: 1800,
    })
    expect(issues(layout([{ ...item, turn: 90 }])).map((i) => i.kind)).toEqual(['height'])
  })

  it('faces the bottom wall unturned, and each quarter turn takes the front to the next wall clockwise', () => {
    expect(([0, 90, 180, 270] as const).map(facing)).toEqual(['front', 'left', 'back', 'right'])
  })

  it('lets a wall cabinet occupy the same footprint as a lower cabinet without allowing a real overlap', () => {
    const floor = block({ size: { width: 600, depth: 600, height: 900 } })
    const hanging = block({
      id: 'two',
      elevation: 1450,
      size: { width: 600, depth: 370, height: 700 },
    })
    expect(issues(layout([floor, hanging]))).toEqual([])
    expect(issues(layout([floor, { ...hanging, elevation: 899 }])).filter((i) => i.kind === 'overlap')).toHaveLength(2)
    expect(issues(layout([floor, { ...hanging, elevation: 900 }]))).toEqual([])
  })

  it('checks the door sweep rather than flagging the empty corner of its enclosing square', () => {
    expect(blocksOpening(room, block(), door)).toBe(true)
    expect(blocksOpening(room, block({ x: 1850, z: 850 }), door)).toBe(false)
    expect(blocksOpening(room, block(), { ...door, swing: 'outside' })).toBe(false)
    expect(blocksOpening(room, block(), { ...door, swing: 'sliding' })).toBe(false)
    expect(blocksOpening(room, block({ z: 50 }), { ...door, swing: 'outside' })).toBe(true)
  })

  it('moves the hinge to the other end and applies the same sweep on every wall', () => {
    const nearStart = block({ x: 1050, z: 700 })
    expect(blocksOpening(room, nearStart, door)).toBe(true)
    expect(blocksOpening(room, nearStart, { ...door, hinge: 'end' })).toBe(false)
    expect(
      blocksOpening(room, block({ x: 1250, z: 4500 }), {
        ...door,
        wall: 'front',
      }),
    ).toBe(true)
    expect(
      blocksOpening(room, block({ x: 500, z: 1250 }), {
        ...door,
        wall: 'left',
      }),
    ).toBe(true)
    expect(
      blocksOpening(room, block({ x: 4500, z: 1250 }), {
        ...door,
        wall: 'right',
      }),
    ).toBe(true)
    expect(
      blocksOpening(
        room,
        block({
          elevation: 2200,
          size: { width: 100, depth: 100, height: 100 },
        }),
        door,
      ),
    ).toBe(false)
  })

  it('checks a window at its wall plane and actual vertical interval, without a guessed 60 cm strip', () => {
    const window: Opening = {
      ...door,
      kind: 'window',
      sill: 1000,
      height: 1000,
    }
    expect(blocksOpening(room, block({ z: 350 }), window)).toBe(false)
    expect(blocksOpening(room, block({ z: 50 }), window)).toBe(true)
    expect(blocksOpening(room, block({ z: 50, size: { width: 100, depth: 100, height: 900 } }), window)).toBe(false)
    expect(
      blocksOpening(
        room,
        block({
          z: 50,
          elevation: 2100,
          size: { width: 100, depth: 100, height: 200 },
        }),
        window,
      ),
    ).toBe(false)
  })

  it('places additions in free space, respects rotated footprints, and reports an oversized item', () => {
    const first = exampleLayout(block({ size: { width: 1400, depth: 2000, height: 1200 } }))
    const second = block({
      id: 'two',
      turn: 90,
      size: { width: 700, depth: 350, height: 1800 },
    })
    const placed = { ...second, ...freePosition(first, second) }
    expect(issues({ ...first, items: [...first.items, placed] })).toEqual([])
    const large = block({
      id: 'large',
      size: { width: 6000, depth: 6000, height: 1000 },
    })
    expect(
      issues({
        ...first,
        items: [{ ...large, ...freePosition(first, large) }],
      }).some((i) => i.kind === 'outside'),
    ).toBe(true)
  })

  it('rejects invalid room and opening input, including after the room gets smaller', () => {
    expect(validSpace(room)).toBe(true)
    expect(validSpace({ ...room, width: NaN })).toBe(false)
    expect(validSpace({ ...room, depth: 0 })).toBe(false)
    expect(openingProblem(room, door)).toBeNull()
    expect(openingProblem(room, { ...door, offset: 4500 })).toContain('pared')
    expect(openingProblem({ ...room, height: 2000 }, door)).toContain('altura')
    expect(openingProblem(room, { ...door, width: Infinity })).toContain('positivas')
  })
  it('checks opening overlap on the same wall and at the same height', () => {
    const second = { ...door, id: 'second', offset: door.offset + 100 }
    expect(openingProblem(room, door, [door])).toBeNull()
    expect(openingProblem(room, second, [door])).toContain('otra abertura')
    expect(openingProblem(room, { ...second, wall: 'left' }, [door])).toBeNull()
    expect(openingProblem(room, { ...second, kind: 'window', sill: 2200, height: 200 }, [door])).toBeNull()
  })

  it('slides a dragged opening along its wall, keeps it between the corners and moves it to the wall the pointer goes to', () => {
    const door: Opening = { id: 'door', kind: 'door', wall: 'back', offset: 1000, width: 800, height: 2100, sill: 0, hinge: 'start', swing: 'inside' }
    expect(slidOpening(room, door, 2304, 120, 300)).toMatchObject({ wall: 'back', offset: 2000 })
    expect(slidOpening(room, door, 4950, 300, 300)).toMatchObject({ wall: 'back', offset: 4200 })
    expect(slidOpening(room, door, -200, 0, 300)).toMatchObject({ wall: 'back', offset: 0 })
    expect(slidOpening(room, door, 4900, 2500, 300)).toMatchObject({ wall: 'right', offset: 2100 })
    expect(slidOpening({ ...room, depth: 700 }, door, 4900, 350, 300)).toMatchObject({ wall: 'back', offset: 4200 })
  })
})
