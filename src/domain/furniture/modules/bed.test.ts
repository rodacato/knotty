import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { testCatalog } from '../fixtures/catalog.test-util'
import { BedPlan, buildBed } from './bed'

const bed = (p: Partial<BedPlan> = {}): BedPlan => ({
  kind: 'bed',
  name: 'Cama',
  mattress: 'individual',
  material: 'T18',
  height: 400,
  drawers: { side: 'none', count: 3, position: 'head' },
  headboard: { style: 'none', height: 1100, depth: 250, shelves: 2 },
  ...p,
})

const STYLES = ['none', 'plain', 'bookcase', 'storage'] as const
const SIDES = ['none', 'left', 'right', 'both'] as const
const MATTRESSES = ['individual', 'matrimonial', 'queen', 'king'] as const

describe('buildBed', () => {
  it.each(MATTRESSES.flatMap((mattress) => STYLES.flatMap((style) => SIDES.map((side) => [mattress, style, side] as const))))('%s, headboard %s, drawers %s: valid, with nothing to warn about', (mattress, style, side) => {
    const { design, notes } = buildBed(bed({ mattress, drawers: { side, count: 3, position: 'head' }, headboard: { style, height: 1100, depth: 250, shelves: 2 } }), testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(JSON.stringify(a.errors.slice(0, 3)))
    expect(notes).toEqual([])
    expect(a.findings.map((h) => h.message)).toEqual([])
  })
  it('puts the drawers of the right side (seen from the foot) opening backward, and the left ones forward', () => {
    const { design } = buildBed(bed({ drawers: { side: 'both', count: 3, position: 'head' } }), testCatalog)
    const geo = analyze(design, testCatalog).geo!
    const fronts = design.pieces.filter((p) => p.role === 'drawer-front')
    expect(fronts).toHaveLength(6)
    expect(fronts.filter((p) => geo.boxes.get(p.id)!.z0 === 0).map((p) => p.group)).toEqual(['drawer-right-1', 'drawer-right-2', 'drawer-right-3'])
    expect(fronts.filter((p) => geo.boxes.get(p.id)!.z1 === design.dimensions.depth)).toHaveLength(3)
  })

  it('gathers fewer drawers toward the foot and closes the rest of the side, with cross members under the platform', () => {
    const { design } = buildBed(bed({ drawers: { side: 'left', count: 1, position: 'foot' } }), testCatalog)
    const geo = analyze(design, testCatalog).geo!
    const front = geo.boxes.get('drawer-left-1-front')!
    expect(geo.boxes.get('foot-panel')!.x0 - front.x1).toBeCloseTo(2, 5)
    expect(design.pieces.some((p) => p.id === 'side-left-1')).toBe(true)
    expect(design.pieces.filter((p) => p.id.startsWith('rail-left')).length).toBeGreaterThan(0)
  })

  it('makes a storage headboard with a closed compartment at pillow level and shelves above', () => {
    const { design } = buildBed(bed({ headboard: { style: 'storage', height: 1200, depth: 250, shelves: 2 } }), testCatalog)
    const geo = analyze(design, testCatalog).geo!
    const floor = geo.boxes.get('head-bottom')!
    expect(floor.y1).toBe(400)
    expect(geo.boxes.get('head-sep')!.y0).toBe(400 + 280)
    expect(design.pieces.filter((p) => p.id.startsWith('head-shelf-'))).toHaveLength(2)
    expect(design.dimensions).toEqual({ width: 250 + 1900 + 20 + 18, height: 1200, depth: 990 + 20 })
  })
  it('takes the ficha a real expert sends for a plain bed: no drawers as count 0, no depth for a plain headboard', () => {
    // Sent by Claude through SheLLM on 2026-09-25 for "Cama individual con cabecera"; it was rejected before and the bed went piece by piece.
    const sent = { kind: 'bed', name: 'Cama individual con cabecera', mattress: 'individual', material: 'T18', height: 400, drawers: { side: 'none', count: 0, position: 'center' }, headboard: { style: 'plain', height: 1000, depth: 0, shelves: 0 } }
    const plan = BedPlan.parse(sent)
    const a = analyze(buildBed(plan, testCatalog).design, testCatalog)
    expect(a.valid && a.findings).toEqual([])
    expect(buildBed({ ...plan, headboard: { style: 'bookcase', height: 1100, depth: 0, shelves: 2 } }, testCatalog).design.dimensions.width).toBe(250 + 1900 + 20 + 18)
  })
})
