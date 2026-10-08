import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { testCatalog } from '../fixtures/catalog.test-util'
import { cutList } from '../../estimate/cutList'
import { LEG_HEIGHT_RANGE } from './common'
import { estimatePurchase } from '../../estimate/purchase'
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
    expect(design.pieces.filter((p) => p.id.startsWith('head-shelf-')).map((p) => p.name)).toEqual(['Repisa 1 de la cabecera, tramo 1', 'Repisa 1 de la cabecera, tramo 2', 'Repisa 2 de la cabecera, tramo 1', 'Repisa 2 de la cabecera, tramo 2'])
    expect(design.dimensions).toEqual({ width: 250 + 1900 + 20 + 18, height: 1200, depth: 1000 + 20 })
  })

  it('splits a deep headboard’s shelves into bays no shelf sags in, with a divider between them that leaves the compartment whole', () => {
    const shelved = (mattress: BedPlan['mattress'], style: 'bookcase' | 'storage', shelves = 1) => {
      const { design } = buildBed(bed({ mattress, headboard: { style, height: 1100, depth: 250, shelves } }), testCatalog)
      const a = analyze(design, testCatalog)
      if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
      return { a, dividers: design.pieces.filter((p) => p.id.startsWith('head-div-')), shelves: design.pieces.filter((p) => p.id.startsWith('head-shelf-')), box: (id: string) => a.geo.boxes.get(id)! }
    }
    expect((['individual', 'matrimonial', 'queen', 'king'] as const).map((m) => shelved(m, 'bookcase').dividers.length)).toEqual([1, 2, 2, 3])
    for (const mattress of ['individual', 'king'] as const)
      for (const style of ['bookcase', 'storage'] as const) {
        const { a, shelves, box } = shelved(mattress, style, 2)
        expect(a.findings).toEqual([])
        expect(a.warnings).toEqual([])
        for (const shelf of shelves) expect(box(shelf.id).z1 - box(shelf.id).z0).toBeLessThan(620)
      }
    const storage = shelved('king', 'storage')
    expect(storage.box('head-div-1').y0).toBe(storage.box('head-sep').y1)
    expect(storage.box('head-sep').z1 - storage.box('head-sep').z0).toBe(2020 - 36)
    expect(shelved('king', 'bookcase', 0).dividers).toEqual([])
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

  it('stands on a third row of legs under its spine from the matrimonial up, one beside each leg of a side', () => {
    const legsOf = (mattress: BedPlan['mattress'], p: Partial<BedPlan> = {}) => {
      const { design, a } = analyzed(raised(150, { mattress, ...p }))
      if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
      const row = (where: string) => new Set(design.pieces.filter((x) => x.id.startsWith('leg-') && x.id.includes(where)).map((x) => x.id.replace(/-\d$/, ''))).size
      return { a, spine: row('-spine'), left: row('-left'), box: (id: string) => a.geo.boxes.get(id)! }
    }
    expect(legsOf('individual').spine).toBe(0)
    for (const mattress of ['matrimonial', 'queen', 'king'] as const) {
      const { a, spine, left, box } = legsOf(mattress)
      expect(spine).toBe(left)
      expect(spine).toBeGreaterThanOrEqual(3)
      expect(a.findings).toEqual([])
      expect(a.warnings).toEqual([])
      expect(box('leg-foot-spine-1').z0).toBe(box('spine').z1)
      expect([box('leg-foot-spine-1').y0, box('leg-foot-spine-1').y1]).toEqual([box('leg-foot-left-1').y0, box('leg-foot-left-1').y1])
    }
    expect(legsOf('king', { platform: 'slats' }).a.findings).toEqual([])
    expect(legsOf('queen', { legStyle: 'tapered' }).a.findings).toEqual([])
  })

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

  it('rejects a bookcase or storage headboard too low for what it holds over the base, and builds the lowest it takes', () => {
    const deep = (style: 'bookcase' | 'storage', height: number, shelves: number, cap = false) => bed({ headboard: { style, height, depth: 250, shelves, cap } })
    expect(FurniturePlan.safeParse(deep('storage', 550, 2)).error?.issues[0]).toMatchObject({ path: ['headboard', 'height'], message: expect.stringMatching(/^No cupo/) })
    for (const [style, shelves, cap] of [['storage', 0, false], ['storage', 4, false], ['storage', 2, true], ['bookcase', 0, false], ['bookcase', 4, true]] as const) {
      const least = 400 + (style === 'storage' ? 280 : 0) + (2 + (cap ? 1 : 0) + 2 * shelves) * 18
      expect(FurniturePlan.safeParse(deep(style, least - 1, shelves, cap)).success).toBe(false)
      expect(FurniturePlan.safeParse(deep(style, least, shelves, cap)).success).toBe(true)
      expect(analyze(buildBed(deep(style, least, shelves, cap), testCatalog).design, testCatalog).valid).toBe(true)
    }
    expect(FurniturePlan.safeParse(bed({ headboard: { style: 'plain', height: 300, depth: 0, shelves: 0 } })).success).toBe(true)
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

  it('has bench variants on legs from 100 to 250, the tallest that keep the base at 450, all clean', () => {
    const variants = bedModule.benchVariants().filter(([, p]) => p.legs === 'legs')
    expect(variants.map(([, p]) => p.legHeight)).toEqual(expect.arrayContaining([100, 150, 250]))
    const problems = variants.flatMap(([name, plan]) => {
      const { design, notes } = buildBed(plan, testCatalog)
      const a = analyze(design, testCatalog)
      return [...(FurniturePlan.safeParse(plan).success ? [] : ['rejected']), ...notes.filter((n) => !/^Patas cónicas|^Base de \d+ tablillas/.test(n)), ...(a.valid ? a.findings.map((f) => f.message) : ['invalid'])].map((m) => `${name}: ${m}`)
    })
    expect(problems).toEqual([])
  })
})

describe('what a bed is checked for, besides its spans', () => {
  const checks = (plan: BedPlan) => {
    const a = analyze(buildBed(plan, testCatalog).design, testCatalog)
    if (!a.valid) throw new Error(a.errors[0].message)
    return a.findings.filter((f) => f.code === 'R10_USE').map((f) => `${f.check} ${f.severity}`)
  }

  it('a king is wider than it is long, and still fits its base: both are compared short side to short side', () => {
    const { design } = buildBed(bed({ mattress: 'king', lip: true }), testCatalog)
    expect([design.dimensions.depth > design.dimensions.width, checks(bed({ mattress: 'king', lip: true }))]).toEqual([true, []])
  })

  it('a platform thinner than 18 is said, and under 15 it is critical; slats answer to their own check', () => {
    expect(checks(bed({ material: 'T15' }))).toEqual(['bed.board recommendation'])
    expect(checks(bed({ material: 'T12' }))).toContain('bed.board critical')
    expect(checks(bed({ material: 'T15', platform: 'slats' }))).toEqual(['bed.slats recommendation'])
  })

  it('a base outside 250–450 is said, panel or slats: the mattress ends up too high or too low to sit on and get up from', () => {
    for (const platform of ['panel', 'slats'] as const) expect([250, 450, 240, 500].map((height) => checks(bed({ height, platform })))).toEqual([[], [], ['bed.height recommendation'], ['bed.height recommendation']])
    expect(checks(bed({ height: 500, legs: 'legs', legHeight: 300 }))).toEqual(['bed.height recommendation'])
  })

  it('a daybed whose backrest rises under 30 cm over a 26 cm mattress says so in its form', () => {
    const daybed = (height: number) => bed({ headboard: { style: 'daybed', height, depth: 0, shelves: 0 } })
    const note = bedModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).find((f) => f.type === 'note' && f.text.includes('no alcanza para recargarse'))!
    expect([800, 959, 960].map((height) => note.visibleWhen!(daybed(height)))).toEqual([true, true, false])
    expect(note.visibleWhen!(bed({ headboard: { style: 'plain', height: 800, depth: 0, shelves: 0 } }))).toBe(false)
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
    expect(box('platform').z1 - box('platform').z0).toBe(1000 + 20)
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

describe('the trim and the drawer fronts', () => {
  const built = (plan: BedPlan) => {
    const { design, notes } = buildBed(plan, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors[0].message)
    return { design, notes, a, box: (id: string) => a.geo.boxes.get(id)! }
  }
  const drawn = (drawers: Partial<BedPlan['drawers']>, p: Partial<BedPlan> = {}) => bed({ drawers: { side: 'left', count: 3, position: 'center', ...drawers }, headboard: { style: 'plain', height: 1100, depth: 0, shelves: 0 }, ...p })

  it('builds every new bench variant valid, with nothing to warn about and nothing to say', () => {
    const problems = bedModule.benchVariants().flatMap(([name, plan]) => {
      const { design, notes } = buildBed(plan, testCatalog)
      const a = analyze(design, testCatalog)
      return [...(FurniturePlan.safeParse(plan).success ? [] : ['rejected']), ...notes.filter((n) => !/^Muesca|^Esquinas de dedos|^Brazos con el frente|^Patas cónicas|^Base de \d+ tablillas/.test(n)), ...(a.valid ? [...a.findings, ...a.warnings].map((f) => f.message) : [a.errors[0].message])].map((m) => `${name}: ${m}`)
    })
    expect(problems).toEqual([])
  })

  it('keeps the mattress its room inside the lips: the bed grows by each lip, and the lips stand on the platform', () => {
    const { design, box } = built(bed({ lip: true, headboard: { style: 'none', height: 1100, depth: 0, shelves: 0 } }))
    expect(design.dimensions).toEqual({ width: 1900 + 20 + 3 * 18, depth: 1000 + 20 + 2 * 18, height: 400 + 40 })
    expect(box('lip-right').z1 > box('lip-left').z0).toBe(false)
    expect(box('lip-left').z0 - box('lip-right').z1).toBe(1000 + 20)
    const without = built(bed({ headboard: { style: 'none', height: 1100, depth: 0, shelves: 0 } })).box('platform')
    expect(box('lip-foot').x0 - box('lip-head').x1).toBe(without.x1 - without.x0)
    for (const id of ['lip-left', 'lip-right', 'lip-head', 'lip-foot']) expect([box(id).y0, box(id).y1]).toEqual([400, 440])
    expect(bedModule.parts.ofPiece(design.pieces.find((p) => p.id === 'lip-foot')!)).toBe('mattress')
  })

  it('puts a lip only on the open front of a daybed, and gives its backrest back the room it took', () => {
    const { design, box } = built(drawn({}, { lip: true, headboard: { style: 'daybed', height: 830, depth: 0, shelves: 0 } }))
    expect(design.pieces.filter((p) => p.id.startsWith('lip-')).map((p) => p.id)).toEqual(['lip-left'])
    expect(box('lip-left').z0 - box('side-right-1').z1).toBe(1000 + 20)
    expect([box('lip-left').x0, box('lip-left').x1]).toEqual([box('headboard').x1, box('foot-arm').x0])
  })

  it('caps a plain headboard and a daybed whole, reaching toward the mattress and flush outside', () => {
    const plain = built(drawn({}, { headboard: { style: 'plain', height: 1100, depth: 0, shelves: 0, cap: true } }))
    expect(plain.box('headboard').y1).toBe(1100 - 18)
    expect(plain.box('head-cap')).toMatchObject({ x0: 0, x1: 18 + 20, y0: 1100 - 18, y1: 1100, z0: 0, z1: plain.design.dimensions.depth })
    const day = built(drawn({}, { headboard: { style: 'daybed', height: 830, depth: 0, shelves: 0, cap: true } }))
    for (const id of ['headboard', 'foot-arm', 'side-right-1']) expect(day.box(id).y1).toBe(830 - 18)
    expect(day.box('foot-cap').x0).toBe(day.box('foot-arm').x0 - 20)
    expect(day.box('back-cap')).toMatchObject({ x0: day.box('head-cap').x1, x1: day.box('foot-cap').x0, z0: 0, z1: 18 + 20 })
    expect(['head-cap', 'foot-cap', 'back-cap'].map((id) => bedModule.parts.ofPiece(day.design.pieces.find((p) => p.id === id)!))).toEqual(['headboard', 'headboard', 'headboard'])
  })

  it('leaves the cap out, and says so, when the headboard is too low to clear the lips', () => {
    const { design, notes } = buildBed(drawn({}, { lip: true, height: 400, headboard: { style: 'plain', height: 450, depth: 0, shelves: 0, cap: true } }), testCatalog)
    expect(design.pieces.some((p) => p.id === 'head-cap')).toBe(false)
    expect(notes).toEqual([expect.stringMatching(/muy baja para el copete/)])
  })

  it('lays overlay fronts over the dividers they share, with a 2 mm seam, over dividers and kicks set back a board', () => {
    const { box, design } = built(drawn({ count: 2, mount: 'overlay' }))
    const [one, two] = [1, 2].map((k) => box(`drawer-left-${k}-front`))
    expect(two.x0 - one.x1).toBeCloseTo(2, 5)
    expect((one.x1 + two.x0) / 2).toBeCloseTo((box('div-left-1').x0 + box('div-left-1').x1) / 2, 5)
    const face = design.dimensions.depth
    expect([one.z1, box('div-left-1').z1, box('kick-left-1').z1]).toEqual([face, face - 18, face - 18])
    expect([box('side-left-1').x1, box('side-left-2').x0]).toEqual([box('div-left-0').x1, box('div-left-2').x0])
    expect([one.x0 - box('div-left-0').x1, box('div-left-2').x0 - two.x1]).toEqual([2, 2])
  })

  it('cuts notches and grooves into the fronts, says the notch, and buys a handle for each front', () => {
    const notched = built(drawn({ style: 'grooved', pulls: 'notch' }))
    const fronts = notched.design.pieces.filter((p) => p.role === 'drawer-front')
    expect(fronts.every((p) => (p.cuts ?? []).length > 1)).toBe(true)
    expect(notched.notes).toEqual([expect.stringMatching(/^Muesca para abrir en el canto de 3 frentes/)])
    expect(built(drawn({ pulls: 'handle' })).design.pulls).toBe('handle')
    expect(built(drawn({})).design.pulls).toBeUndefined()
  })

  it('joins the drawer boxes with finger corners when asked, and an old plan builds as before', () => {
    const fingered = built(drawn({ corners: 'fingers', fingers: 7 }))
    expect(fingered.design.joints.filter((u) => u.type === 'finger')).toHaveLength(3 * 4)
    expect(fingered.notes).toEqual([expect.stringMatching(/^Esquinas de dedos en 3 cajones, 7 por esquina/)])
    const old = BedPlan.parse({ ...drawn({}), lip: undefined })
    expect(buildBed(old, testCatalog).design).toEqual(buildBed(drawn({ mount: 'inset', style: 'flat', pulls: 'none', corners: 'screwed' }), testCatalog).design)
  })

  it('shows the front choices only with drawers, and the fingers only with finger corners', () => {
    const fields = bedModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f]))
    const shown = (key: string, plan: BedPlan) => fields.filter((f) => 'key' in f && f.key === key).every((f) => !f.visibleWhen || f.visibleWhen(plan))
    expect(['drawers.mount', 'drawers.pulls', 'drawers.style', 'drawers.corners'].map((k) => shown(k, bed()))).toEqual([false, false, false, false])
    expect(['drawers.mount', 'drawers.pulls', 'drawers.style', 'drawers.corners'].map((k) => shown(k, drawn({})))).toEqual([true, true, true, true])
    expect([shown('drawers.fingers', drawn({})), shown('drawers.fingers', drawn({ corners: 'fingers' }))]).toEqual([false, true])
    expect(shown('headboard.cap', bed())).toBe(false)
  })
})

describe('the sloped arms of a daybed', () => {
  const daybed = (headboard: Partial<BedPlan['headboard']> = {}, p: Partial<BedPlan> = {}) =>
    bed({ lip: true, drawers: { side: 'left', count: 3, position: 'center' }, headboard: { style: 'daybed', height: 800, depth: 0, shelves: 0, cap: true, arms: 'sloped', ...headboard }, ...p })
  const built = (plan: BedPlan) => {
    const { design, notes } = buildBed(plan, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors[0].message)
    return { design, notes, a, box: (id: string) => a.geo.boxes.get(id)!, slants: (id: string) => design.pieces.find((p) => p.id === id)!.slants }
  }
  const plainly = (design: ReturnType<typeof built>['design']) => design.pieces.map((piece) => ({ ...piece, slants: undefined }))

  it('saws the top front corner off each arm, on the side away from the backrest, and says how', () => {
    const { slants, notes } = built(daybed())
    const corner = [{ x: null, y: { from: 'end', length: 120 }, z: { from: 'end', length: 240 } }]
    expect([slants('headboard'), slants('foot-arm')]).toEqual([corner, corner])
    expect(notes.filter((n) => n.startsWith('Brazos'))).toEqual(['Brazos con el frente en diagonal: a cada brazo se le corta la esquina de arriba al frente, 240 mm a lo largo y 120 mm hacia abajo, con sierra circular y guía. La maderería entrega el rectángulo, y el copete del brazo llega hasta donde empieza el corte.'])
    const mirrored = built(daybed({}, { drawers: { side: 'right', count: 3, position: 'center' } }))
    expect(mirrored.slants('headboard')![0].z).toEqual({ from: 'start', length: 240 })
  })

  it('stops the cap of each arm where the slope starts, and nothing else moves: the same boards to buy and the same findings', () => {
    const [sloped, square] = [built(daybed()), built(daybed({ arms: 'square' }))]
    expect(square.box('head-cap').z1 - sloped.box('head-cap').z1).toBe(240)
    expect(square.box('foot-cap').z1 - sloped.box('foot-cap').z1).toBe(240)
    const others = (design: typeof sloped.design) => plainly(design).filter((p) => !['head-cap', 'foot-cap'].includes(p.id))
    expect(others(sloped.design)).toEqual(others(square.design))
    expect(sloped.a.findings).toEqual(square.a.findings)
    expect(cutList(sloped.design, sloped.a.geo).filter((row) => !/Copete del brazo/.test(row.name))).toEqual(cutList(square.design, square.a.geo).filter((row) => !/Copete del brazo/.test(row.name)))
  })

  it('never comes down to the lip: on low arms the cut is shallower, and on arms too low there is none and it says so', () => {
    expect(built(daybed({ height: 600 })).slants('headboard')![0].y).toEqual({ from: 'end', length: 600 - 18 - 400 - 40 - 60 })
    const low = built(daybed({ height: 510 }))
    expect(low.slants('headboard')).toBeUndefined()
    expect(low.notes).toContain('Los brazos son muy bajos para cortarles el frente en diagonal: quedan rectos. Sube el respaldo.')
  })

  it('is asked only of a daybed, and a plan that does not say has square arms', () => {
    const field = bedModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).find((f) => 'key' in f && f.key === 'headboard.arms')!
    const shown = (plan: BedPlan) => !field.visibleWhen || field.visibleWhen(plan)
    expect([shown(daybed()), shown(bed({ headboard: { style: 'plain', height: 1100, depth: 0, shelves: 0 } }))]).toEqual([true, false])
    expect(built(daybed({ arms: undefined })).slants('headboard')).toBeUndefined()
    expect(bedModule.describeChanges(daybed({ arms: undefined }), daybed())).toEqual(['brazos con el frente en diagonal'])
  })
})

describe('tapered legs on a bed', () => {
  const onLegs = (p: Partial<BedPlan> = {}) => bed({ mattress: 'matrimonial', legs: 'legs', legHeight: 150, drawers: { side: 'none', count: 0, position: 'head' }, headboard: { style: 'plain', height: 1100, depth: 0, shelves: 0 }, ...p })
  const built = (plan: BedPlan) => {
    const { design, notes } = buildBed(plan, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors[0].message)
    return { design, notes, a }
  }

  it('narrows only what shows under the frame, on the side that faces the middle of the bed', () => {
    const { design, notes } = built(onLegs({ legStyle: 'tapered' }))
    const legs = design.pieces.filter((p) => p.id.startsWith('leg-'))
    expect(legs.every((p) => p.slants?.length === 1)).toBe(true)
    const slant = (id: string) => design.pieces.find((p) => p.id === id)!.slants![0]
    expect(slant('leg-head-left-1')).toEqual({ x: null, y: { from: 'start', leave: 400 - 18 - 150 }, z: { from: 'start', length: 36 } })
    expect(slant('leg-head-right-1').z).toEqual({ from: 'end', length: 36 })
    expect(notes).toEqual([expect.stringMatching(/^Patas cónicas en \d+ patas: cada una se adelgaza por dentro, de 72 mm bajo el marco a 36 mm en el piso\./)])
  })

  it('changes nothing else: the same boards, joints, cut list and findings as straight legs', () => {
    const [tapered, straight] = [built(onLegs({ legStyle: 'tapered' })), built(onLegs())]
    expect(tapered.design.pieces.map((p) => ({ ...p, slants: undefined }))).toEqual(straight.design.pieces.map((p) => ({ ...p, slants: undefined })))
    expect(tapered.design.joints).toEqual(straight.design.joints)
    expect(cutList(tapered.design, tapered.a.geo)).toEqual(cutList(straight.design, straight.a.geo))
    expect(tapered.a.findings).toEqual(straight.a.findings)
  })

  it('is asked only with legs, and a plan that does not say has straight ones', () => {
    const field = bedModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).find((f) => 'key' in f && f.key === 'legStyle')!
    expect([field.visibleWhen!(onLegs()), field.visibleWhen!(bed())]).toEqual([true, false])
    expect(built(onLegs()).design.pieces.some((p) => p.slants)).toBe(false)
    expect(bedModule.describeChanges(onLegs(), onLegs({ legStyle: 'tapered' }))).toEqual(['patas cónicas'])
  })
})

describe('a base of slats', () => {
  const slatted = (p: Partial<BedPlan> = {}) => bed({ platform: 'slats', headboard: { style: 'plain', height: 1000, depth: 0, shelves: 0 }, ...p })
  const built = (p: BedPlan) => {
    const { design, notes } = buildBed(p, testCatalog)
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
    const slats = design.pieces.filter((x) => /^slat-\d+$/.test(x.id)).map((x) => a.geo.boxes.get(x.id)!)
    return { design, notes, a, slats, box: (id: string) => a.geo.boxes.get(id)!, has: (id: string) => design.pieces.some((x) => x.id === id) }
  }
  const SIZES = MATTRESSES.flatMap((mattress) => SIDES.map((side) => [mattress, side] as const))

  it.each(SIZES)('%s, drawers %s: valid, with nothing to warn about, and the drawers it was asked for', (mattress, side) => {
    const { a, design } = built(slatted({ mattress, drawers: { side, count: 3, position: 'center' } }))
    expect(a.findings.map((f) => f.message)).toEqual([])
    expect(design.pieces.filter((x) => x.role === 'drawer-front')).toHaveLength(side === 'none' ? 0 : side === 'both' ? 6 : 3)
  })

  it('takes the place of the panel: boards of 100 across the bed between its ends, never more than 75 apart', () => {
    const { slats, has, box } = built(slatted())
    expect([has('platform'), has('platform-left')]).toEqual([false, false])
    expect(slats.every((s) => Math.round(s.x1 - s.x0) === 100)).toBe(true)
    const gaps = slats.slice(1).map((s, i) => s.x0 - slats[i].x1)
    expect(Math.max(...gaps)).toBeLessThanOrEqual(75)
    expect(Math.min(...gaps)).toBeGreaterThan(50)
    expect([slats[0].x0, slats.at(-1)!.x1]).toEqual([box('headboard').x1, box('foot-panel').x0])
  })

  it('sit between the sides, not over them: 20 under their edge, where the mattress still rests on it, and 2 short of each', () => {
    const { slats, box } = built(slatted())
    const [left, right, foot] = ['side-left-1', 'side-right-1', 'foot-panel'].map(box)
    expect([left.y1, right.y1, foot.y1]).toEqual([400, 400, 400])
    expect([slats[0].y0, slats[0].y1]).toEqual([400 - 20, 400 - 2])
    expect([slats[0].z0 - right.z1, left.z0 - slats[0].z1]).toEqual([2, 2])
    expect(box('spine').y1).toBe(slats[0].y0)
  })

  it('rest on a ledger of two boards glued and screwed to the inside of each side, between its cross members', () => {
    const { design, box, a } = built(slatted())
    const [first, second, side, slat] = ['ledger-left-1-1-1', 'ledger-left-1-1-2', 'side-left-1', 'slat-1'].map(box)
    expect([first.z1, second.z1, first.y1, first.y1 - first.y0]).toEqual([side.z0, first.z0, slat.y0, 40])
    expect(slat.z1 - second.z0).toBe(2 * 18 - 2)
    expect(first.x1).toBe(box('rail-left-1-1').x0)
    const joined = (x: string, y: string) => design.joints.filter((u) => (u.a === x && u.b === y) || (u.a === y && u.b === x)).map((u) => [u.type, u.glue])
    expect([joined('ledger-left-1-1-1', 'side-left-1'), joined('ledger-left-1-1-2', 'ledger-left-1-1-1')]).toEqual([[['butt-screw', true]], [['butt-screw', true]]])
    expect(a.findings).toEqual([])
  })

  it('takes one screw at each end, into the ledger board it covers whole, 25 or more from its end; on the board next to the side it only rests', () => {
    const { design, box } = built(slatted())
    const seat = (board: string) => design.joints.find((u) => u.a === 'slat-3' && u.b === board)!
    expect([seat('ledger-left-1-1-1'), seat('ledger-left-1-1-2')].map((u) => [u.type, u.glue, u.hardware.map((h) => h.count)])).toEqual([['butt-screw', false, [0]], ['butt-screw', false, [1]]])
    const inner = box('ledger-left-1-1-2')
    expect(box('slat-3').z1 - (inner.z0 + inner.z1) / 2).toBeGreaterThanOrEqual(25)
  })

  it('a daybed that comes apart keeps the backrest\'s ledger glued and screwed to it, not nailed as a back is', () => {
    const { design } = built(slatted({ assembly: 'bolts', drawers: { side: 'left', count: 3, position: 'center' }, headboard: { style: 'daybed', height: 800, depth: 0, shelves: 0, cap: true } }))
    const held = design.joints.filter((u) => u.b === 'side-right-1' && u.a.startsWith('ledger-right-')).map((u) => [u.type, u.glue])
    expect(new Set(held.map((h) => h.join(' ')))).toEqual(new Set(['butt-screw true']))
    expect(held.length).toBeGreaterThan(1)
  })

  it('each slat is screwed down where it rests: on the ledgers and on the spine, and to no side', () => {
    const { design } = built(slatted())
    const held = design.joints.filter((u) => u.a === 'slat-3' || u.b === 'slat-3').map((u) => (u.a === 'slat-3' ? u.b : u.a))
    expect(held.filter((id) => id === 'spine' || id.startsWith('side-'))).toEqual(['spine'])
    expect(held.filter((id) => id.startsWith('ledger-')).map((id) => id.replace(/-\d-\d-\d$/, '')).sort()).toEqual(['ledger-left', 'ledger-left', 'ledger-right', 'ledger-right'])
  })

  it('a king is not split in two as its panel is: a slat runs the room between the sides in one piece, along the sheet', () => {
    const { slats, design } = built(slatted({ mattress: 'king' }))
    expect(slats[0].z1 - slats[0].z0).toBe(2000 + 20 - 2 * 18 - 2 * 2)
    expect(design.pieces.find((x) => x.id === 'slat-1')!.grain).toBe('length')
  })

  it('up to the matrimonial the spine is enough; from the queen up a rail halfway keeps every slat within 700 between supports', () => {
    const runners = (mattress: BedPlan['mattress']) => built(slatted({ mattress })).design.pieces.filter((x) => x.id.startsWith('slat-runner-')).length
    expect(MATTRESSES.map((m) => runners(m) > 0)).toEqual([false, false, true, true])
    const { box } = built(slatted({ mattress: 'king' }))
    const [spine, runner, side] = ['spine', 'slat-runner-left-1-1', 'side-left-1'].map(box)
    expect(Math.max(runner.z0 - spine.z1, side.z0 - runner.z1)).toBeLessThanOrEqual(700)
    expect(runner.y1).toBe(box('slat-1').y0)
  })

  it('over the drawers one rail runs from end to end, level with the sides, with its ledger; the drawers open under it and the dividers between them are screwed up into it', () => {
    const { box, has, design } = built(slatted({ drawers: { side: 'left', count: 3, position: 'head' } }))
    const [rail, front, slat, divider, side] = ['slat-rail-left', 'drawer-left-1-front', 'slat-1', 'div-left-1', 'side-right-1'].map(box)
    expect([rail.y1, rail.y0]).toEqual([side.y1, slat.y0 - 80])
    expect([rail.x0, rail.x1]).toEqual([box('headboard').x1, box('foot-panel').x0])
    expect([front.y1 < rail.y0, divider.y1]).toEqual([true, rail.y0])
    expect(box('ledger-left-1').z1).toBe(rail.z0)
    expect(design.joints.filter((u) => u.b === 'slat-rail-left' && u.a.startsWith('div-')).map((u) => [u.a, u.type])).toEqual([['div-left-1', 'pocket-screw'], ['div-left-2', 'pocket-screw']])
    expect(has('slat-rail-right')).toBe(false)
    const panel = buildBed(bed({ drawers: { side: 'left', count: 3, position: 'head' }, headboard: { style: 'plain', height: 1000, depth: 0, shelves: 0 } }), testCatalog)
    expect(panel.design.pieces.some((x) => /^(slat|ledger)-/.test(x.id))).toBe(false)
  })

  it('a closed stretch beside overlay drawers stands a board further out than their rail: its ledger takes one board more to reach the slats', () => {
    const { design, box } = built(slatted({ mattress: 'queen', drawers: { side: 'left', count: 2, position: 'head', mount: 'overlay' } }))
    const layers = design.pieces.filter((x) => x.id.startsWith('ledger-left-1-1-')).length
    expect(layers).toBe(3)
    expect(box('ledger-left-1-1-3').z0).toBe(box('ledger-left-2').z0)
  })

  it('on legs the ledger starts past each leg, which keeps the face of the side it is screwed to', () => {
    const { box, a } = built(slatted({ legs: 'legs', headboard: { style: 'none', height: 1000, depth: 0, shelves: 0 } }))
    expect(box('ledger-left-1-1-1').x0).toBe(box('leg-head-left-2').x1)
    expect(box('leg-head-left-1').y1).toBe(box('slat-1').y0)
    expect([a.findings, a.warnings]).toEqual([[], []])
  })

  it('the lip is the base itself: with slats there is no platform for a strip to stand on, so the boards around them rise 40 more and the bed still grows by each', () => {
    const { has, box, design, a } = built(slatted({ lip: true, drawers: { side: 'left', count: 3, position: 'head' } }))
    expect(['lip-left', 'lip-right', 'lip-foot'].map(has)).toEqual([false, false, false])
    expect(['slat-rail-left', 'side-right-1', 'foot-panel'].map((id) => box(id).y1)).toEqual([440, 440, 440])
    expect(design.dimensions).toMatchObject({ depth: 1000 + 20 + 2 * 18, height: 1000 })
    expect([a.findings, a.warnings]).toEqual([[], []])
  })

  it('a daybed keeps them inside its backrest and its arms, on a ledger along the backrest too', () => {
    const { slats, box, has } = built(slatted({ lip: true, drawers: { side: 'left', count: 3, position: 'center' }, headboard: { style: 'daybed', height: 800, depth: 0, shelves: 0, cap: true } }))
    expect([slats[0].x0, slats.at(-1)!.x1]).toEqual([box('headboard').x1, box('foot-arm').x0])
    expect(slats[0].z0 - box('side-right-1').z1).toBe(2)
    expect(box('ledger-right-1-1-1').z0).toBe(box('side-right-1').z1)
    expect([has('lip-left'), box('slat-rail-left').y1]).toEqual([false, 440])
  })

  it('says how they go: how many, how far apart, what they rest on and where they are screwed; and what drawers and a lip mean', () => {
    const plain = built(slatted()).notes
    expect(plain).toEqual([
      'Base de 12 tablillas de 100 mm de ancho, con 65 mm de hueco entre una y otra. Van embutidas entre los costados, 20 mm abajo de su canto, sobre un listón de 2 capas pegado y atornillado por dentro; cada una es 4 mm más corta que el hueco, que se mide con la base ya armada, y se atornilla a la espina, nunca va suelta. Se cortan con la veta a lo largo de la tablilla. Sin el colchón encima no te pares ni te hinques en una sola: el colchón es el que reparte el peso.',
    ])
    const wide = built(slatted({ mattress: 'queen', lip: true, drawers: { side: 'both', count: 3, position: 'center' } })).notes[0]
    expect(wide).toContain('llevan un larguero a media distancia de cada lado')
    expect(wide).toContain('Sobre los cajones el listón va en un larguero corrido, y entre las tablillas cae polvo a los cajones.')
    expect(wide).toContain('El tope del colchón son las mismas tablas de la base, que suben 40 mm más.')
  })

  it('uses no more plywood than the panel, and a sheet less under a king', () => {
    const sheets = (p: BedPlan) => {
      const { design, a } = built(p)
      return estimatePurchase(design, a.geo, testCatalog).sheets.find((s) => s.material.id === 'T18')!.sheets
    }
    for (const mattress of MATTRESSES) expect([mattress, sheets(slatted({ mattress })) <= sheets(slatted({ mattress, platform: 'panel' }))]).toEqual([mattress, true])
    expect(sheets(slatted({ mattress: 'king', platform: 'panel' })) - sheets(slatted({ mattress: 'king' }))).toBe(1)
  })

  describe('are checked as slats', () => {
    const without = (design: ReturnType<typeof built>['design'], ids: (id: string) => boolean) => ({ ...design, pieces: design.pieces.filter((x) => !ids(x.id)), joints: design.joints.filter((u) => !ids(u.a) && !ids(u.b)) })
    const found = (design: ReturnType<typeof built>['design']) => {
      const a = analyze(design, testCatalog)
      if (!a.valid) throw new Error(a.errors[0].message)
      return a.findings.map((f) => [f.check, f.severity, f.pieces.length])
    }

    it('one that runs more than 700 between supports is critical: a wide bed without its rails halfway', () => {
      const { design } = built(slatted({ mattress: 'king' }))
      const bare = found(without(design, (id) => id.startsWith('slat-runner-')))
      expect(new Set(bare.map(([check, severity]) => `${check} ${severity}`))).toEqual(new Set(['bed.span critical']))
      expect(bare).toHaveLength(12)
    })

    it('the mattress rests on the edges of the sides too: the base is as wide as with a panel, and the mattress fits', () => {
      for (const mattress of MATTRESSES) expect([mattress, built(slatted({ mattress, drawers: { side: 'left', count: 2, position: 'head', mount: 'overlay' } })).a.findings.map((f) => f.check)]).toEqual([mattress, []])
      expect(built(slatted({ mattress: 'king', headboard: { style: 'bookcase', height: 1100, depth: 250, shelves: 2 } })).a.findings.map((f) => f.check)).toEqual([])
    })

    it('two more than 75 apart are said once, with the widest gap', () => {
      const { design } = built(slatted())
      expect(found(without(design, (id) => id === 'slat-4' || id === 'slat-8'))).toEqual([['bed.slats', 'recommendation', 2]])
    })

    it('narrower than 100 they are said, since one may break under a knee', () => {
      const { design } = built(slatted())
      // Narrowed from one edge, a slat no longer reaches a cross member it lay over: that joint goes with it.
      const narrow = { ...design, pieces: design.pieces.map((x) => (/^slat-([2-9]|1[01])$/.test(x.id) ? { ...x, x: { ...x.x, length: 60 } } : x)), joints: design.joints.filter((u) => !(u.a.startsWith('slat-') && u.b.startsWith('rail-')) && !(u.b.startsWith('slat-') && u.a.startsWith('rail-'))) }
      expect(found(narrow).map(([check]) => check).sort()).toEqual(['bed.slats', 'bed.slats'])
    })

    it('their sag is not judged as a shelf\'s: under a mattress it does not show, and the span already limits it', () => {
      expect(built(slatted({ mattress: 'matrimonial' })).a.findings.filter((f) => f.code === 'R1_SAG')).toEqual([])
    })

    it('a panel is still judged along the bed, as before', () => {
      const { design } = built(slatted({ platform: 'panel' }))
      expect(found(without(design, (id) => id.startsWith('rail-'))).map(([check, severity]) => `${check} ${severity}`)).toContain('bed.span critical')
    })
  })

  it('is a choice of the plan: a plan without it is a panel, the form offers it for every bed and its change is said', () => {
    const saved = bed()
    expect(FurniturePlan.parse(saved)).toEqual(saved)
    expect(buildBed(saved, testCatalog).design.pieces.some((x) => x.id === 'platform')).toBe(true)
    const field = bedModule.fields.flatMap((f) => (f.type === 'section' ? f.fields : [f])).find((f) => f.type === 'choice' && f.key === 'platform')!
    expect(field.type === 'choice' && field.options.map(([, text]) => text)).toEqual(['Tablero', 'Tablillas'])
    expect(bedModule.describeChanges(saved, { ...saved, platform: 'slats' })).toEqual(['base de tablillas'])
    expect(bedModule.describeChanges({ ...saved, platform: 'slats' }, saved)).toEqual(['base de tablero'])
    expect(bedModule.parts.list.find((x) => x.id === 'mattress')!.fields).toContain('platform')
    expect(bedModule.parts.ofPiece(buildBed({ ...saved, platform: 'slats' }, testCatalog).design.pieces.find((x) => x.id === 'slat-2')!)).toBe('mattress')
  })
})
