import { describe, expect, it } from 'vitest'
import { analyze } from '../../domain/checks/analysis'
import type { Design } from '../../domain/design/schema'
import type { Box } from '../../domain/design/resolve'
import { basesOf, exampleDesign } from '../../domain/furniture/examples'
import { exampleSideboard, testBases, testReferences } from '../../domain/furniture/fixtures/references.test-util'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { exampleNightstand } from '../../domain/furniture/fixtures/nightstand'
import { exampleWallCabinet } from '../../domain/furniture/fixtures/wallCabinet'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { buildBed, type BedPlan } from '../../domain/furniture/modules/bed'
import { buildTable, tableModule, type TablePlan } from '../../domain/furniture/modules/table'
import { explode, type Explosion } from './explode'

// The exploded view of the furniture the person starts from, of two desks on legs with a pedestal, and of a bed with drawers under it and a bookcase headboard.

function boxesOf(design: Design) {
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return a.geo.boxes
}

const bed: BedPlan = {
  kind: 'bed',
  name: 'Cama individual con cajones',
  mattress: 'individual',
  material: 'T18',
  height: 400,
  legs: 'none',
  legHeight: 150,
  drawers: { side: 'both', count: 3, position: 'head' },
  headboard: { style: 'bookcase', height: 1100, depth: 250, shelves: 2 },
}
/** The tall stool as it takes its low stretcher: a short frame, where a rail pushed half a gap would cross the legs. */
const stool: TablePlan = { kind: 'table', use: 'seat', name: 'Taburete alto', material: 'T18', dimensions: { width: 340, height: 650, depth: 290 }, overhang: 20, shelf: false, pedestal: { side: 'none', drawers: 0 }, legs: 'legs', legStyle: 'splayed', stretcher: 'h' }
const tied: [string, Design][] = [...tableModule.benchVariants().filter(([, plan]) => plan.legs === 'legs' && (plan.stretcher ?? 'none') !== 'none'), ['taburete alto con travesaños en H', stool] as [string, TablePlan], ['taburete alto con travesaños', { ...stool, stretcher: 'ends' }] as [string, TablePlan]].map(([name, plan]) => [name, buildTable(plan, testCatalog).design])
const desksWithPedestal = basesOf(['KC-ESC-03', 'KC-ESC-07'].map((code) => testReferences.latest(code)!))
const designs: [string, Design][] = [
  ...[exampleBookcase, exampleNightstand, exampleWallCabinet].map((d) => [d.name, d] as [string, Design]),
  ...[...testBases, ...desksWithPedestal].map((b) => [b.name, exampleDesign(b, testCatalog).design] as [string, Design]),
  ['Cama', buildBed(bed, testCatalog).design],
  ...tied,
]

const moved = (box: Box, [dx, dy, dz]: [number, number, number]): Box => ({ x0: box.x0 + dx, x1: box.x1 + dx, y0: box.y0 + dy, y1: box.y1 + dy, z0: box.z0 + dz, z1: box.z1 + dz })
const center = (b: Box) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2]

function exploded(design: Design): { boxes: Map<string, Box>; e: Explosion; at: (id: string) => Box } {
  const boxes = boxesOf(design)
  const e = explode(design, boxes)
  return { boxes, e, at: (id) => moved(boxes.get(id)!, e.offsets.get(id)!) }
}

describe('explode', () => {
  it.each(designs)('%s: the same design comes apart the same way, and nothing ends below the floor', (_, design) => {
    const { e, at } = exploded(design)
    expect(explode(design, boxesOf(design))).toEqual(e)
    expect(e.offsets.size).toBe(design.pieces.length)
    expect(Math.min(...design.pieces.map((p) => at(p.id).y0))).toBeGreaterThanOrEqual(0)
    expect(e.bounds.y0).toBeGreaterThanOrEqual(0)
  })

  it.each(designs)('%s: no two pieces overlap once apart, unless they already did', (_, design) => {
    const { boxes, at } = exploded(design)
    const overlap = (a: Box, b: Box) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 1
    const ids = design.pieces.map((p) => p.id)
    const clashes = ids.flatMap((a, i) => ids.slice(i + 1).filter((b) => overlap(at(a), at(b)) && !overlap(boxes.get(a)!, boxes.get(b)!)).map((b) => `${a} × ${b}`))
    expect(clashes).toEqual([])
  })

  it('moves every part of a drawer by the same offset, out through its front', () => {
    for (const [, design] of designs) {
      const { e, boxes } = exploded(design)
      const groups = [...new Set(design.pieces.filter((p) => p.role === 'drawer-front').map((p) => p.group!))]
      for (const g of groups) {
        const parts = design.pieces.filter((p) => p.group === g)
        expect(new Set(parts.map((p) => JSON.stringify(e.offsets.get(p.id))))).toHaveProperty('size', 1)
        const front = parts.find((p) => p.role === 'drawer-front')!
        const side = parts.find((p) => p.role === 'drawer-side')!
        const [dx, , dz] = e.offsets.get(front.id)!
        const outward = Math.sign(center(boxes.get(front.id)!)[2] - center(boxes.get(side.id)!)[2])
        expect(Math.sign(dz)).toBe(outward)
        expect(dx).toBe(0)
      }
    }
  })

  it('keeps a drawer front and a door in line with the opening they close, and brings them forward', () => {
    const design = exampleDesign(exampleSideboard, testCatalog).design
    const { e, boxes } = exploded(design)
    const door = design.pieces.find((p) => p.role === 'door')!
    const shelfBehind = design.pieces.find((p) => p.role === 'shelf' && p.id.startsWith(door.id.split('-door')[0]))!
    const [dx, , dz] = e.offsets.get(door.id)!
    expect(dx).toBe(0)
    expect(dz).toBeGreaterThan(0)
    // Past the shelf it closes over, which slides out less.
    expect(boxes.get(door.id)!.z0 + dz).toBeGreaterThan(boxes.get(shelfBehind.id)!.z1 + e.offsets.get(shelfBehind.id)![2])
    // Inset doors and drawer fronts end up in one plane, as they were.
    const faces = design.pieces.filter((p) => p.role === 'door' || p.role === 'drawer-front').map((p) => Math.round(boxes.get(p.id)!.z1 + e.offsets.get(p.id)![2]))
    expect(new Set(faces).size).toBe(1)
  })

  it('opens the carcass: sides out along their thickness, the top up, the back backward', () => {
    const design = exampleBookcase
    const { e } = exploded(design)
    const lift = e.offsets.get('bottom')![1]
    expect(e.offsets.get('side-left')![0]).toBeLessThan(0)
    expect(e.offsets.get('side-right')![0]).toBeGreaterThan(0)
    expect(e.offsets.get('top')![1]).toBeGreaterThan(lift)
    expect(e.offsets.get('back')![2]).toBeLessThan(0)
    expect(e.offsets.get('shelf-1')![2]).toBeGreaterThan(0)
    // The kick stays on the floor and the carcass lifts off it.
    expect(e.offsets.get('kick')).toEqual([0, 0, 0])
    expect(lift).toBeGreaterThan(0)
  })

  it('keeps the legs and rails of a desk with their frame, while the dividers of a carcass slide forward', () => {
    const desk = exampleDesign(desksWithPedestal[1], testCatalog).design
    const { e } = exploded(desk)
    const forward = (id: string) => e.offsets.get(id)![2]
    expect(forward('rail-1')).toBe(0)
    expect(forward('leg-front-left-1')).toBe(0)
    expect(forward('apron-front')).toBeGreaterThan(0)
    expect(forward('ped-div')).toBeGreaterThan(0)
    const sideboard = exampleDesign(exampleSideboard, testCatalog).design
    expect(exploded(sideboard).e.offsets.get('div-1')![2]).toBeGreaterThan(0)
  })

  it('keeps a low stretcher on the legs it is screwed to, and slides the long one of an H out from between them', () => {
    expect(tied.map(([name]) => name)).toEqual(expect.arrayContaining(['comedor con patas, con travesaños en H', 'comedor con patas cónicas, con travesaños en H', 'comedor con patas abiertas, con travesaños en H', 'escritorio con 2 cajones a la izquierda con patas cónicas, con travesaño', 'escritorio con patas abiertas, con travesaños']))
    const wrong = tied.flatMap(([name, design]) => {
      const { e } = exploded(design)
      const same = (a: string, b: string) => JSON.stringify(e.offsets.get(a)) === JSON.stringify(e.offsets.get(b))
      const ends = design.pieces.filter((p) => /^stretcher-(left|right)$/.test(p.id)).filter((p) => !same(p.id, `leg-front-${p.id.split('-')[1]}-2`))
      const [dx, , dz] = e.offsets.get('stretcher-long') ?? [0, 0, 1]
      return [...ends.map((p) => `${name}: ${p.id}`), ...(dx !== 0 || dz === 0 ? [`${name}: stretcher-long`] : [])]
    })
    expect(wrong).toEqual([])
  })

  it('separates a bed into its parts first: the headboard back from the base, the platform up off the drawer bank', () => {
    const design = buildBed(bed, testCatalog).design
    const { e, boxes, at } = exploded(design)
    const headboard = design.pieces.filter((p) => p.group === 'headboard')
    const base = design.pieces.filter((p) => p.group !== 'headboard')
    const headboardX1 = Math.max(...headboard.map((p) => at(p.id).x1))
    expect(headboardX1).toBeLessThan(Math.min(...base.map((p) => at(p.id).x0)))
    // Inside the headboard its pieces still come apart: the top rises over its sides.
    expect(e.offsets.get('head-top')![1]).toBeGreaterThan(e.offsets.get('head-side-left')![1])
    const platform = at('platform')
    const bank = design.pieces.filter((p) => p.group !== 'headboard' && p.id !== 'platform')
    expect(platform.y0).toBeGreaterThan(Math.max(...bank.map((p) => at(p.id).y1)))
    expect(e.offsets.get('spine')).toEqual([0, 0, 0])
    expect(boxes.get('platform')!.y0).toBeLessThan(platform.y0)
  })
})
