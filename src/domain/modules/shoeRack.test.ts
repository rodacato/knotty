import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { resolveGeometry } from '../design/resolve'
import { testCatalog } from '../fixtures/catalog.test-util'
import { detectKind } from '../typology/typology'
import { MODULE_OF_KIND } from './plan'
import { BOOT_LEVEL_HEIGHT, buildShoeRack, SHOE_RACK_LABELS, shoeRackModule, type ShoeRackPlan } from './shoeRack'

const rack = (extra: Partial<ShoeRackPlan> = {}): ShoeRackPlan => ({ kind: 'shoeRack', name: 'Zapatera', dimensions: { width: 800, height: 900, depth: 330 }, material: 'T18', levels: 4, bootLevel: false, front: 'open', base: 'kick', seat: false, wallMounted: false, ...extra })
const built = (plan: ShoeRackPlan) => buildShoeRack(plan, testCatalog)
const findingsOf = (design: ReturnType<typeof built>['design']) => {
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
  return a.findings
}
const boxes = (plan: ShoeRackPlan) => {
  const { design } = built(plan)
  const geo = resolveGeometry(design, testCatalog)
  if (!geo.ok) throw new Error('does not resolve')
  return { design, boxes: geo.value.boxes }
}

describe('the shoe rack', () => {
  it('is its own kind: the shoe-rack checks apply to it, whatever its name', () => {
    expect(MODULE_OF_KIND.shoeRack).toBe('shoeRack')
    const { design } = built(rack({ name: 'Mueble de la entrada', dimensions: { width: 800, height: 900, depth: 250 } }))
    expect(detectKind(design)).toBe('shoeRack')
    expect(findingsOf(design).map((f) => f.check)).toContain('shoe-rack.depth')
  })

  it('has as many shoe levels as its plan, split by fixed shelves, each tall enough for a low shoe', () => {
    const { design, boxes: b } = boxes(rack())
    const shelves = design.pieces.filter((p) => p.role === 'shelf')
    expect(shelves).toHaveLength(3)
    expect(shelves.every((p) => p.support !== 'movable' && p.load === 'light')).toBe(true)
    const tops = [b.get('bottom')!.y1, ...shelves.map((p) => b.get(p.id)!.y1)].sort((x, y) => x - y)
    const bottoms = [...shelves.map((p) => b.get(p.id)!.y0), b.get('top')!.y0].sort((x, y) => x - y)
    for (const [i, y] of tops.entries()) expect(bottoms[i] - y).toBeGreaterThanOrEqual(150)
  })

  it('with doors, closes its front; wide, with two leaves', () => {
    expect(built(rack({ front: 'doors' })).design.pieces.filter((p) => p.role === 'door')).toHaveLength(2)
    expect(built(rack({ front: 'doors', dimensions: { width: 500, height: 900, depth: 330 } })).design.pieces.filter((p) => p.role === 'door')).toHaveLength(1)
  })

  it('keeps the bottom level for boots at its clear height', () => {
    const { design, boxes: b } = boxes(rack({ levels: 5, bootLevel: true, dimensions: { width: 800, height: 1500, depth: 380 } }))
    const floor = b.get('bottom')!.y1
    const lowest = Math.min(...design.pieces.filter((p) => p.role === 'shelf').map((p) => b.get(p.id)!.y0))
    expect(lowest - floor).toBeCloseTo(BOOT_LEVEL_HEIGHT, 0)
    expect(built(rack({ levels: 4, bootLevel: true })).notes.join(' ')).toMatch(/botas/)
  })

  it('a seat is marked to carry a person, and gets a divider so it holds one', () => {
    const { design } = built(rack({ seat: true, levels: 2, dimensions: { width: 900, height: 450, depth: 330 } }))
    expect(design.pieces.find((p) => p.id === 'top')).toMatchObject({ name: 'Asiento', load: 'heavy' })
    expect(design.pieces.some((p) => p.role === 'divider')).toBe(true)
    expect(findingsOf(design)).toEqual([])
  })

  it('says so when its levels come out too short for a shoe', () => {
    expect(built(rack({ levels: 8 })).notes.join(' ')).toMatch(/necesita 150/)
    expect(built(rack()).notes).toEqual([])
  })

  it('describes each change in words, and every choice has its words', () => {
    const base = rack()
    expect(shoeRackModule.describeChanges(base, { ...base, front: 'doors', levels: 5, seat: true })).toEqual(['5 niveles', 'con puertas', 'con asiento arriba'])
    expect(Object.keys(SHOE_RACK_LABELS.front)).toEqual(['open', 'doors'])
  })
})
