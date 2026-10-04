import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { testCatalog } from '../fixtures/catalog.test-util'
import { cutList } from '../../materials/cutList'
import { LEG_HEIGHT_RANGE } from './common'
import { bedModule, BedPlan, buildBed } from './bed'
import { FurniturePlan } from './plan'

const bed = (p: Partial<BedPlan> = {}): BedPlan => ({
  kind: 'bed',
  name: 'Cama',
  mattress: 'individual',
  material: 'T18',
  height: 400,
  legs: 'none',
  legHeight: 150,
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

describe('a bed on legs', () => {
  const raised = (legHeight: number, p: Partial<BedPlan> = {}) => bed({ legs: 'legs', legHeight, height: 450, headboard: { style: 'plain', height: 1100, depth: 0, shelves: 0 }, ...p })
  const analyzed = (plan: BedPlan) => {
    const { design } = buildBed(plan, testCatalog)
    return { design, a: analyze(design, testCatalog) }
  }

  it.each([LEG_HEIGHT_RANGE.min, 220, LEG_HEIGHT_RANGE.max])('raises the frame by %i mm and keeps the mattress where it was', (legHeight) => {
    const { design, a } = analyzed(raised(legHeight))
    const box = (id: string) => a.geo!.boxes.get(id)!
    expect(box('foot-panel').y0).toBe(legHeight)
    expect(box('foot-panel').y1).toBe(450 - 18)
    expect(box('platform').y1).toBe(450)
    expect(box('leg-foot-left-1').y0).toBe(0)
    expect(box('leg-foot-left-1').y1).toBe(450 - 18)
    expect(design.dimensions.height).toBe(1100)
    expect(a.valid && a.findings.map((f) => f.code)).toEqual(expect.not.arrayContaining(['unsupported']))
  })

  it('stands on four corner legs of 36 × 72 and adds more along a long side', () => {
    const short = analyzed(raised(150, { mattress: 'individual' })).design.pieces.filter((p) => p.id.startsWith('leg-'))
    const names = short.map((p) => p.id)
    expect(names).toEqual(expect.arrayContaining(['leg-head-left-1', 'leg-head-right-2', 'leg-foot-left-1', 'leg-foot-right-2']))
    const { design, a } = analyzed(raised(150, { mattress: 'individual' }))
    expect(a.geo!.boxes.get('leg-foot-left-1')!.z1 - a.geo!.boxes.get('leg-foot-left-1')!.z0).toBe(72)
    const widthOf = (id: string) => a.geo!.boxes.get(id)!.x1 - a.geo!.boxes.get(id)!.x0
    expect(widthOf('leg-foot-left-1') + widthOf('leg-foot-left-2')).toBe(36)
    expect(design.pieces.filter((p) => p.id.startsWith('leg-middle-left'))).toHaveLength(4)
  })

  it('screws every leg to the faces it stands against, so nothing is left to warn about', () => {
    const { design, a } = analyzed(raised(150, { mattress: 'individual' }))
    const joined = (x: string, y: string, from = design.joints) => from.some((u) => (u.a === x && u.b === y) || (u.a === y && u.b === x))
    for (const side of ['left', 'right']) {
      for (const [leg, panel] of [['leg-foot', 'foot-panel'], ['leg-head', 'headboard']]) {
        expect(joined(`${leg}-${side}-1`, panel)).toBe(true)
        expect(joined(`${leg}-${side}-1`, `side-${side}-1`)).toBe(true)
      }
      const middle = design.pieces.filter((p) => new RegExp(`^leg-middle-${side}-\\d+-1$`).test(p.id))
      expect(middle.length).toBeGreaterThan(0)
      for (const m of middle) {
        expect(joined(m.id, `side-${side}-1`)).toBe(true)
        expect(design.joints.some((u) => [u.a, u.b].includes(m.id) && [u.a, u.b].some((id) => id.startsWith(`rail-${side}`)))).toBe(true)
      }
    }
    expect(a.valid && a.warnings).toEqual([])
  })

  it('cuts the legs up to the platform and the sides at what is left', () => {
    const line = (legHeight: number) => {
      const { design, a } = analyzed(raised(legHeight))
      const list = cutList(design, a.geo!)
      return { leg: list.find((l) => l.ids.includes('leg-foot-left-1'))!, side: list.find((l) => l.ids.includes('side-left-1'))! }
    }
    expect([line(100).leg.length, line(300).leg.length]).toEqual([450 - 18, 450 - 18])
    expect([line(100).side.width, line(300).side.width]).toEqual([450 - 100 - 18, 450 - 300 - 18])
  })

  it('builds an old plan, saved without legs, exactly as before', () => {
    const old = { ...bed(), legs: undefined, legHeight: undefined }
    const parsed = BedPlan.parse(old)
    expect(parsed).toMatchObject({ legs: 'none', legHeight: 150 })
    const { design } = buildBed(parsed, testCatalog)
    expect(design.pieces.some((p) => p.id.startsWith('leg-'))).toBe(false)
    expect(analyze(design, testCatalog).geo!.boxes.get('foot-panel')!.y0).toBe(0)
  })

  it('rejects legs that leave less than 200 mm of frame, and legs with drawers', () => {
    expect(FurniturePlan.safeParse(raised(300, { height: 499 })).error?.issues[0]).toMatchObject({ path: ['legHeight'], message: expect.stringMatching(/^No cupo/) })
    expect(FurniturePlan.safeParse(raised(300, { height: 500 })).success).toBe(true)
    const both = FurniturePlan.safeParse(raised(150, { drawers: { side: 'left', count: 2, position: 'head' } }))
    expect(both.error?.issues[0]).toMatchObject({ path: ['legs'], message: expect.stringMatching(/^No cupo/) })
    expect(BedPlan.safeParse(raised(99)).success).toBe(false)
    expect(BedPlan.safeParse(raised(301)).success).toBe(false)
  })

  it('shows the legs on the form only without drawers, says why otherwise, and drops them when drawers are chosen', () => {
    const fields = bedModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f]))
    const shown = (key: string, plan: BedPlan) => fields.filter((f) => f.type === 'numbers' ? f.fields.some((n) => n.key === key) : 'key' in f && f.key === key).every((f) => !f.visibleWhen || f.visibleWhen(plan))
    expect(shown('legs', bed())).toBe(true)
    expect(shown('legs', bed({ drawers: { side: 'left', count: 2, position: 'head' } }))).toBe(false)
    expect(shown('legHeight', bed())).toBe(false)
    expect(shown('legHeight', raised(150, { drawers: { side: 'left', count: 2, position: 'head' } }))).toBe(false)
    expect(shown('legHeight', raised(150))).toBe(true)
    expect(fields.some((f) => f.type === 'note' && f.text.startsWith('Con cajones') && f.visibleWhen?.(bed({ drawers: { side: 'left', count: 2, position: 'head' } })))).toBe(true)
    const side = fields.find((f) => f.type === 'choice' && f.key === 'drawers.side')
    expect(side && side.type === 'choice' && side.set(raised(150), 'left')).toMatchObject({ legs: 'none', drawers: { side: 'left' } })
  })

  it('has bench variants on legs at 100 and 300, all clean', () => {
    const variants = bedModule.benchVariants().filter(([, p]) => p.legs === 'legs')
    expect(variants.map(([, p]) => p.legHeight)).toEqual(expect.arrayContaining([100, 150, 300]))
    const problems = variants.flatMap(([name, plan]) => {
      const { design, notes } = buildBed(plan, testCatalog)
      const a = analyze(design, testCatalog)
      return [...(FurniturePlan.safeParse(plan).success ? [] : ['rejected']), ...notes, ...(a.valid ? a.findings.map((f) => f.message) : ['invalid'])].map((m) => `${name}: ${m}`)
    })
    expect(problems).toEqual([])
  })
})

describe('a daybed', () => {
  const daybed = (drawers: BedPlan['drawers'], p: Partial<BedPlan> = {}) => bed({ drawers, headboard: { style: 'daybed', height: 830, depth: 0, shelves: 0 }, ...p })
  const built = (plan: BedPlan) => {
    const { design } = buildBed(plan, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors[0].message)
    return { design, a, box: (id: string) => a.geo.boxes.get(id)! }
  }

  it.each([
    ['left', 'side-right-1'],
    ['right', 'side-left-1'],
    ['none', 'side-right-1'],
  ] as const)('with drawers %s, the backrest is %s, full height, and the platform sits inside it and the arms', (side, backrest) => {
    const { design, a, box } = built(daybed({ side, count: side === 'none' ? 0 : 3, position: 'center' }))
    expect(a.findings).toEqual([])
    expect(a.warnings).toEqual([])
    expect(design.pieces.find((p) => p.id === backrest)).toMatchObject({ name: 'Respaldo', role: 'back' })
    for (const id of [backrest, 'headboard', 'foot-arm']) expect([box(id).y0, box(id).y1]).toEqual([0, 830])
    expect(box('platform').x1).toBe(box('foot-arm').x0)
    expect(backrest === 'side-right-1' ? box('platform').z0 === box(backrest).z1 : box('platform').z1 === box(backrest).z0).toBe(true)
  })

  it('takes neither legs nor drawers on both sides, and choosing it in the form settles both', () => {
    const issue = (p: BedPlan) => FurniturePlan.safeParse(p).error?.issues[0]
    expect(issue(daybed({ side: 'both', count: 2, position: 'head' }))).toMatchObject({ path: ['drawers', 'side'], message: expect.stringMatching(/^No cupo/) })
    expect(issue(daybed({ side: 'none', count: 0, position: 'head' }, { legs: 'legs' }))).toMatchObject({ path: ['legs'], message: expect.stringMatching(/^No cupo/) })
    const style = bedModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).find((f) => 'key' in f && f.key === 'headboard.style')
    if (!style || style.type !== 'choice') throw new Error('no headboard style field')
    const chosen = style.set(bed({ legs: 'legs', drawers: { side: 'both', count: 2, position: 'head' } }), 'daybed')
    expect(FurniturePlan.safeParse(chosen).success).toBe(true)
  })

  it('opens its headboard part from the backrest and both arms', () => {
    const { design } = built(daybed({ side: 'left', count: 3, position: 'center' }))
    expect(['headboard', 'foot-arm', 'side-right-1'].map((id) => bedModule.parts.ofPiece(design.pieces.find((p) => p.id === id)!))).toEqual(['headboard', 'headboard', 'headboard'])
  })
})
