import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { resolveGeometry } from '../../design/resolve'
import { estimatePurchase } from '../../estimate/purchase'
import { testCatalog } from '../fixtures/catalog.test-util'
import { testReferences } from '../fixtures/references.test-util'
import { isVisible } from './fields'
import { detectKind } from '../../checks/typology/typology'
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
    const { design, boxes: b } = boxes(rack({ dimensions: { width: 700, height: 900, depth: 330 } }))
    const shelves = design.pieces.filter((p) => p.role === 'shelf')
    expect(shelves).toHaveLength(3)
    expect(shelves.every((p) => p.support !== 'movable' && p.load === 'light')).toBe(true)
    const tops = [b.get('bottom')!.y1, ...shelves.map((p) => b.get(p.id)!.y1)].sort((x, y) => x - y)
    const bottoms = [...shelves.map((p) => b.get(p.id)!.y0), b.get('top')!.y0].sort((x, y) => x - y)
    for (const [i, y] of tops.entries()) expect(bottoms[i] - y).toBeGreaterThanOrEqual(150)
  })

  it('splits into columns where the sag rule would flag a shelf, judged with the real thickness', () => {
    const within = built(rack({ dimensions: { width: 700, height: 900, depth: 330 } })).design
    const past = built(rack({ dimensions: { width: 800, height: 900, depth: 330 } })).design
    expect(within.pieces.filter((p) => p.role === 'shelf')).toHaveLength(3)
    expect(past.pieces.filter((p) => p.role === 'shelf')).toHaveLength(6)
    expect(findingsOf(within).filter((f) => f.code === 'R1_SAG')).toEqual([])
    expect(findingsOf(past).filter((f) => f.code === 'R1_SAG')).toEqual([])
  })

  it('with doors, closes its front; wide, with two leaves', () => {
    expect(built(rack({ front: 'doors' })).design.pieces.filter((p) => p.role === 'door')).toHaveLength(2)
    expect(built(rack({ front: 'doors', dimensions: { width: 500, height: 900, depth: 330 } })).design.pieces.filter((p) => p.role === 'door')).toHaveLength(1)
  })

  it('its doors go over the front, so a plan that says no pull leaves them plain: no notch, no note and nothing said in the design', () => {
    const { design, notes } = built(rack({ front: 'doors' }))
    expect(design.pieces.filter((p) => p.cuts?.length)).toEqual([])
    expect([design.pulls, design.pullsOf, notes]).toEqual([undefined, undefined, []])
  })

  it('splits the door by the width of the leaf, not of the opening: a 630 mm rack takes two', () => {
    const { design } = built(rack({ front: 'doors', wallMounted: true, dimensions: { width: 630, height: 1000, depth: 380 } }))
    expect(design.pieces.filter((p) => p.role === 'door')).toHaveLength(2)
    expect(findingsOf(design).filter((f) => f.code === 'R6_DOORS')).toEqual([])
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

  it('says when the seat is too high or too low to sit on, and nothing at a seat height', () => {
    const bench = (height: number) => built(rack({ dimensions: { width: 900, height, depth: 330 }, levels: 2, seat: true })).notes
    expect(bench(600)).toEqual(['El asiento queda a 600 mm del piso; para sentarse a calzarse va de 420 a 480.'])
    expect(bench(350).join(' ')).toMatch(/350 mm del piso/)
    expect(bench(450)).toEqual([])
    expect(built(rack({ dimensions: { width: 900, height: 600, depth: 330 }, levels: 2 })).notes).toEqual([])
  })

  it('describes each change in words, and every choice has its words', () => {
    const base = rack()
    expect(shoeRackModule.describeChanges(base, { ...base, front: 'doors', levels: 5, seat: true })).toEqual(['5 niveles', 'con puertas', 'con asiento arriba'])
    expect(Object.keys(SHOE_RACK_LABELS.front)).toEqual(['open', 'doors'])
    const doors = rack({ front: 'doors' })
    expect(shoeRackModule.describeChanges(doors, { ...doors, pulls: 'notch' })).toEqual(['muesca para abrir'])
    expect(shoeRackModule.describeChanges({ ...doors, pulls: 'handle' }, doors)).toEqual(['puertas sin jaladeras'])
    // Without doors there is nothing to pull: the field says nothing, and saying none is no change.
    expect(shoeRackModule.describeChanges(base, { ...base, pulls: 'handle' })).toEqual([])
    expect(shoeRackModule.describeChanges(doors, { ...doors, pulls: 'none' })).toEqual([])
  })
})

describe('how the doors of a shoe rack open', () => {
  const shipped = testReferences.latest('GN-OTR-01')?.plan
  if (shipped?.kind !== 'shoeRack') throw new Error('the shoe rack reference (GN-OTR-01) is missing')
  const doorsOf = (plan: ShoeRackPlan) => built(plan).design.pieces.filter((p) => p.role === 'door')
  const handles = (plan: ShoeRackPlan) => {
    const { design } = built(plan)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    return estimatePurchase(design, a.geo, testCatalog).hardware.find((h) => h.hardware.role === 'handle')?.count ?? 0
  }

  it('GN-OTR-01 says nothing and builds as it did: no notch, no handle, and the same as saying none', () => {
    expect(shipped.pulls).toBeUndefined()
    expect(doorsOf(shipped)).toHaveLength(2)
    expect(doorsOf(shipped).filter((p) => p.cuts?.length)).toEqual([])
    expect(handles(shipped)).toBe(0)
    expect(built(shipped).design.pulls).toBeUndefined()
    expect(built({ ...shipped, pulls: 'none' })).toEqual(built(shipped))
  })

  it('with notch, each door has its notch and nothing is bought for it', () => {
    const plan: ShoeRackPlan = { ...shipped, pulls: 'notch' }
    expect(doorsOf(plan).map((p) => p.cuts?.length)).toEqual([1, 1])
    expect(built(plan).notes).toContainEqual(expect.stringMatching(/^Muesca para abrir en el canto de 2 frentes/))
    expect(handles(plan)).toBe(0)
    expect(findingsOf(built(plan).design)).toEqual(findingsOf(built(shipped).design))
  })

  it('with handle, the purchase lists one per door and nothing is cut', () => {
    const plan: ShoeRackPlan = { ...shipped, pulls: 'handle' }
    expect(handles(plan)).toBe(2)
    expect(doorsOf(plan).filter((p) => p.cuts?.length)).toEqual([])
  })

  it('an open rack has no fronts to pull, whatever its plan says', () => {
    const open = rack({ pulls: 'handle' })
    expect(built(open)).toEqual(built(rack()))
    expect(handles(open)).toBe(0)
  })

  it('its doors are overlay, so the check on fronts with no way to open says nothing with or without a pull', () => {
    for (const pulls of [undefined, 'none', 'notch', 'handle'] as const) expect(findingsOf(built({ ...shipped, pulls }).design).filter((f) => f.check === 'front.pull')).toEqual([])
  })

  it('the form offers the pulls only with doors', () => {
    const field = shoeRackModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).find((f) => 'key' in f && f.key === 'pulls')!
    expect([isVisible(field, rack()), isVisible(field, rack({ front: 'doors' }))]).toEqual([false, true])
  })
})
