import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import type { Design } from '../../design/schema'
import { exampleWallCabinet } from '../../furniture/fixtures/wallCabinet'
import { exampleNightstand } from '../../furniture/fixtures/nightstand'
import { testCatalog } from '../../furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../../furniture/fixtures/bookcase'
import { newCriticals } from './review'
import { maxSpan, deflection, sagThickness, deflectionSeverity } from './rules/deflection'
import { stiffness } from '../../materials/grades'
import { buildPlan, MODULES } from '../../furniture/modules/plan'
import { extent, ref } from '../../design/builders'

const findings = (d: Design) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(JSON.stringify(a.errors))
  return a.findings
}

describe('R1 shelf sag', () => {
  it('a bottom lying on the floor does not sag: the floor holds all of it', () => {
    const [, plan] = MODULES.cabinet.benchVariants().find(([, p]) => p.base === 'floor')!
    const wide = MODULES.cabinet.withMeasures(plan, { ...plan.dimensions, width: 1100 })
    const { design } = buildPlan(wide, testCatalog)
    const bottom = design.pieces.find((p) => p.role === 'bottom')!
    expect(findings(design).filter((h) => h.code === 'R1_SAG' && h.pieces.includes(bottom.id))).toEqual([])
  })

  // docs/carpinteria/valores-de-referencia.md §4: 18 mm radiata pine (E∥ 4500, E⊥ 2000), books (150 kg/m²), creep × 2, real thickness 17.5.
  it('reproduces the spans of the reference (18 mm nominal, books, final sag)', () => {
    expect(maxSpan(300, 18, 'heavy', 4500)).toBeCloseTo(530, -1)
    expect(maxSpan(300, 18, 'medium', 4500)).toBeCloseTo(600, -1)
    expect(maxSpan(300, 18, 'light', 4500)).toBeCloseTo(760, -1)
    expect(maxSpan(300, 18, 'heavy', 2000)).toBeCloseTo(400, -1)
    // The limit: at ≈ 810 mm the final sag reaches span / 100.
    expect(deflection(810, 300, 18, 'heavy', 4500)).toBeCloseTo(810 / 100, 0)
    expect(deflection(600, 300, 18, 'heavy', 4500)).toBeCloseTo(2.47, 1)
  })

  it('the real thickness is the nominal one less the allowance, except for thin boards', () => {
    expect(sagThickness(18)).toBe(17.5)
    expect(sagThickness(15)).toBe(14.5)
    expect(sagThickness(6)).toBe(6)
    expect(sagThickness(3)).toBe(3)
    const sag = (t: number) => deflection(600, 300, t, 'heavy', 4500)
    expect(sag(15) / sag(18)).toBeCloseTo((17.5 / 14.5) ** 3, 5)
    expect(sag(3) / sag(6)).toBeCloseTo(2 ** 3, 5)
  })

  it('a load that stays creeps × 2, one that passes does not', () => {
    expect(deflection(600, 300, 18, 'heavy', 4500, 'passing') * 2).toBeCloseTo(deflection(600, 300, 18, 'heavy', 4500), 5)
  })

  it('grades by span: up to span / 360 nothing, up to span / 100 a recommendation, past it critical', () => {
    expect(deflectionSeverity(1.49, 540)).toBeNull()
    expect(deflectionSeverity(2.27, 600)).toBe('recommendation')
    expect(deflectionSeverity(8.2, 830)).toBe('recommendation')
    expect(deflectionSeverity(11.5, 900)).toBe('critical')
  })

  it('the longest span leaves the sag right at the recommended limit', () => {
    const span = maxSpan(300, 18, 'heavy', 4500)
    expect(deflection(span, 300, 18, 'heavy', 4500)).toBeCloseTo(span / 360, 5)
  })

  it('the platform of a bed carries a person, who gets off: it does not creep; the same boards as shelves do', () => {
    const bed = buildPlan({ kind: 'bed', name: 'Cama', mattress: 'matrimonial', material: 'T18', height: 400, legs: 'none', legHeight: 150, drawers: { side: 'both', count: 3, position: 'head' }, headboard: { style: 'none', height: 1100, depth: 250, shelves: 0 } }, testCatalog).design
    const sag = (d: Design) => findings(d).filter((h) => h.code === 'R1_SAG')
    expect(sag(bed)).toEqual([])
    const shelves = sag({ ...bed, kind: undefined, mattress: undefined, name: 'Mueble' })
    expect(shelves.map((h) => h.pieces[0]).sort()).toEqual(['platform-left', 'platform-right'])
    expect(shelves.every((h) => h.message.includes('con libros'))).toBe(true)
  })

  it('a shelf held by the sides of a bed and not along the width is measured from one to the other, and offers no divider across the width', () => {
    const { design } = buildPlan({ kind: 'bed', name: 'Cama', mattress: 'individual', material: 'T18', height: 400, legs: 'none', legHeight: 150, drawers: { side: 'none', count: 0, position: 'center' }, headboard: { style: 'bookcase', height: 1100, depth: 250, shelves: 1 } }, testCatalog)
    const sag = (d: Design) => findings(d).filter((h) => h.code === 'R1_SAG')
    expect(sag(design)).toEqual([])
    const whole = design.pieces.find((p) => p.id === 'head-shelf-1-1')!
    const undivided: Design = {
      ...design,
      pieces: design.pieces.filter((p) => p.id !== 'head-div-1' && p.id !== 'head-shelf-1-2').map((p) => (p === whole ? { ...p, z: extent(ref('head-side-right.z1'), ref('head-side-left.z0')) } : p)),
      joints: design.joints.filter((u) => ![u.a, u.b].some((id) => id === 'head-div-1' || id === 'head-shelf-1-2')),
    }
    const [found, ...others] = sag(undivided)
    expect(others).toEqual([])
    expect(found).toMatchObject({ severity: 'critical', pieces: ['head-shelf-1-1'], data: { span: 984, depth: 232 } })
    expect(found.alternatives.map((a) => a.key)).toEqual([])
  })

  it('the bookcase widened to 90 cm is critical and proposes a center divider', () => {
    const wide = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 900 } }
    const r1 = findings(wide).filter((h) => h.code === 'R1_SAG')
    expect(r1.map((h) => h.pieces[0]).sort()).toEqual(['bottom', 'shelf-1', 'shelf-2', 'shelf-3', 'shelf-4'])
    expect(r1.every((h) => h.severity === 'critical')).toBe(true)
    const divider = r1[0].alternatives.find((a) => a.key === 'center-divider')!
    expect(divider.data.sag).toBeLessThan(1)
  })

  it('takes the lower modulus when the grain runs across', () => {
    const d = structuredClone(exampleBookcase)
    d.dimensions.width = 800
    const withGrain = findings(d).find((h) => h.pieces[0] === 'shelf-1')
    d.pieces.find((p) => p.id === 'shelf-1')!.grain = 'width'
    const againstGrain = findings(d).find((h) => h.pieces[0] === 'shelf-1')!
    expect(Number(againstGrain.data.sag)).toBeGreaterThan(Number(withGrain?.data.sag ?? 0))
  })

  it('reads the stiffness from the grade of the board, by the grain against the span', () => {
    const d = structuredClone(exampleBookcase)
    d.dimensions.width = 800
    const shelf = d.pieces.find((p) => p.id === 'shelf-1')!
    const expected = stiffness('pine-plywood', 18)
    expect(findings(d).find((h) => h.pieces[0] === 'shelf-1')?.data.modulus).toBe(expected.parallel)
    shelf.grain = 'width'
    expect(findings(d).find((h) => h.pieces[0] === 'shelf-1')?.data.modulus).toBe(expected.perpendicular)
  })
})

describe('a box on legs', () => {
  const sideboard = MODULES.cabinet.benchVariants().find(([name]) => name === 'aparador con patas')![1]
  const without = (d: Design, drop: (id: string) => boolean): Design => ({ ...d, pieces: d.pieces.filter((p) => !drop(p.id)), joints: d.joints.filter((u) => !drop(u.a) && !drop(u.b)) })

  it('its bottom is not on the floor: the span between legs is checked for sag, and the rails keep it within', () => {
    const { design } = buildPlan(sideboard, testCatalog)
    expect(findings(design)).toEqual([])
    const sag = findings(without(design, (id) => id.startsWith('leg-rail-'))).filter((h) => h.code === 'R1_SAG' && h.pieces.includes('bottom'))
    expect(sag).toHaveLength(1)
    expect(sag[0].data.span).toBe(716)
  })

  it('legs too far apart need one in between (R7), past the reference’s width', () => {
    const { design } = buildPlan(sideboard, testCatalog)
    const base = findings(without(design, (id) => /^leg-(middle|rail)-/.test(id))).filter((h) => h.code === 'R7_BASE')
    expect(base).toMatchObject([{ check: 'base.legs', severity: 'recommendation', pieces: ['bottom'], data: { span: 1468, max: 1200 } }])
    expect(base[0].alternatives.map((x) => x.key)).toEqual(['center-support'])
  })

  it('legs only by the two sides of a wide bed are too far apart from front to back (R7), though a headboard reaches the floor across it', () => {
    const bed = (mattress: 'matrimonial' | 'king') => buildPlan({ kind: 'bed', name: 'Cama', mattress, material: 'T18', height: 450, legs: 'legs', legHeight: 150, drawers: { side: 'none', count: 0, position: 'center' }, headboard: { style: 'plain', height: 1100, depth: 0, shelves: 0 } }, testCatalog).design
    const base = (d: Design) => findings(d).filter((h) => h.code === 'R7_BASE')
    const sidesOnly = (d: Design) => without(d, (id) => /^leg-.*-spine-/.test(id))
    expect(base(bed('king'))).toEqual([])
    const [found, ...others] = base(sidesOnly(bed('king')))
    expect(others).toEqual([])
    expect(found).toMatchObject({ check: 'base.legs-across', severity: 'recommendation', data: { max: 1200 }, alternatives: [] })
    expect(found.data.span).toBeGreaterThan(1800)
    expect(base(sidesOnly(bed('matrimonial')))).toEqual([])
  })

  it('tips over by how deep its legs stand, not the box (R4)', () => {
    const open = { ...sideboard, name: 'Librero bajo', wallMounted: false, dimensions: { width: 600, height: 850, depth: 300 }, columns: [{ width: 1, cells: [{ height: 1, content: 'open' as const, shelves: 2, doors: null }] }] }
    expect(findings(buildPlan({ ...open, base: 'floor' }, testCatalog).design).filter((h) => h.code === 'R4_TIPPING')).toEqual([])
    const tipping = findings(buildPlan(open, testCatalog).design).filter((h) => h.code === 'R4_TIPPING')
    expect(tipping).toMatchObject([{ severity: 'recommendation', data: { height: 850, depth: 240 } }])
    expect(tipping[0].message).toContain('sus patas se apoyan en solo 240 mm de fondo')
    expect(tipping[0].alternatives.find((x) => x.key === 'deeper')?.data).toEqual({ depth: 350 })
  })
})

describe('R2 thickness per joint', () => {
  it('asks for at least 15 mm for a dowel and 15 mm to take an edge screw', () => {
    const d = structuredClone(exampleNightstand)
    for (const p of d.pieces) if (p.role === 'side') p.material = 'T12'
    const r2 = findings(d).filter((h) => h.code === 'R2_JOINT_THICKNESS')
    const byJoint = Object.fromEntries(r2.map((h) => [h.data.joint, h.severity]))
    expect(byJoint['j-shelf-left']).toBe('critical')
    expect(byJoint['j-top-left']).toBe('recommendation')
    expect(r2[0].alternatives[0].data.material).toBe('T15')
  })

  it('does not take screws in a 3 mm back', () => {
    const d = structuredClone(exampleNightstand)
    d.joints = d.joints.map((u) => (u.id === 'j-back-bottom' ? { ...u, type: 'butt-screw' } : u))
    expect(findings(d).some((h) => h.code === 'R2_JOINT_THICKNESS' && h.data.piece === 'back')).toBe(true)
  })

  it('names a groove or a rabbet that goes too deep as the person reads it, never by its id', () => {
    const deep = (type: 'dado' | 'rabbet') => {
      const d = structuredClone(exampleNightstand)
      d.joints = d.joints.map((u) => (u.id === 'j-back-bottom' ? { ...u, type, depth: 10 } : u))
      return findings(d).find((h) => h.check === 'joint.groove-depth')!
    }
    expect(deep('rabbet').message).toMatch(/^El rebaje de 10 mm debilita /)
    expect(deep('rabbet').alternatives[0].description).toBe('Hacer el rebaje de 6 mm')
    expect(deep('dado').message).toMatch(/^El canal de 10 mm debilita /)
    expect(deep('dado').alternatives[0].description).toBe('Hacer el canal de 6 mm')
  })
})

describe('R5 racking', () => {
  it('the fixtures with a fixed 6 mm back are fine', () => {
    expect(findings(exampleBookcase)).toEqual([])
    expect(findings(exampleWallCabinet).filter((h) => h.code === 'R5_RACKING')).toEqual([])
  })

  it('the nightstand with a nailed 3 mm back is a recommendation because it is low', () => {
    expect(findings(exampleNightstand).map((h) => [h.code, h.severity])).toEqual([['R5_RACKING', 'recommendation']])
  })

  it('is critical in a tall piece that is not anchored', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.find((p) => p.id === 'back')!.material = 'TR3'
    d.wallAnchored = false
    expect(findings(d).find((h) => h.code === 'R5_RACKING')?.severity).toBe('critical')
  })

  it('anchored through its top, a tall piece without a rigid back is a recommendation that says where the anchor goes', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.find((p) => p.id === 'back')!.material = 'TR3'
    const found = findings(d).find((h) => h.code === 'R5_RACKING')
    expect(found).toMatchObject({ severity: 'recommendation', check: 'racking.anchored' })
    expect(found?.message).toContain('nunca por la trasera')
    expect(found?.alternatives.some((a) => a.key === 'anchor-to-wall')).toBe(false)
  })

  it('unanchored, it offers to anchor it, and with nothing to anchor on it is critical whatever the flag says', () => {
    const d = structuredClone(exampleBookcase)
    d.pieces.find((p) => p.id === 'back')!.material = 'TR3'
    d.wallAnchored = false
    expect(findings(d).find((h) => h.code === 'R5_RACKING')?.alternatives.map((a) => a.key)).toContain('anchor-to-wall')
    const open = structuredClone(d)
    open.wallAnchored = true
    open.pieces.find((p) => p.id === 'top')!.role = 'other'
    const found = findings(open).find((h) => h.code === 'R5_RACKING')
    expect(found?.severity).toBe('critical')
    expect(found?.check).toBeUndefined()
  })

  it('the line is 600 mm: at it a piece without a rigid back is a recommendation, past it critical', () => {
    const at = (height: number) => {
      const d = structuredClone(exampleBookcase)
      d.pieces.find((p) => p.id === 'back')!.material = 'TR3'
      d.wallAnchored = false
      d.dimensions.height = height
      return findings(d).find((h) => h.code === 'R5_RACKING')?.severity
    }
    expect(at(600)).toBe('recommendation')
    expect(at(601)).toBe('critical')
  })

  describe('a shelf fixed in a glued groove stiffens the carcass like an apron or a kick', () => {
    const sidesOf = (d: Design) => new Set(d.pieces.filter((p) => p.role === 'side').map((p) => p.id))
    const refit = (d: Design, id: string, type: Design['joints'][number]['type'], glue: boolean) => {
      for (const u of d.joints) if ((u.a === id && sidesOf(d).has(u.b)) || (u.b === id && sidesOf(d).has(u.a))) Object.assign(u, { type, glue, depth: type === 'dado' ? 6 : null })
    }
    const carcass = (shelf: 'dado' | 'pocket-screw', glue: boolean) => {
      const d = structuredClone(exampleBookcase)
      d.pieces.find((p) => p.id === 'back')!.material = 'TR3'
      d.wallAnchored = false
      const shelfId = d.pieces.find((p) => p.role === 'shelf')!.id
      d.pieces.find((p) => p.id === shelfId)!.support = 'fixed'
      refit(d, 'kick', 'butt-screw', true)
      for (const id of ['top', 'bottom']) refit(d, id, 'pocket-screw', false)
      refit(d, shelfId, shelf, glue)
      return findings(d).filter((h) => h.code === 'R5_RACKING')
    }

    it('with the shelf in a glued groove and two rigid rails there is no finding', () => {
      expect(carcass('dado', true)).toEqual([])
    })

    it('the same shelf in a groove without glue, or held by pocket screws, is not enough', () => {
      expect(carcass('dado', false).map((h) => h.severity)).toEqual(['critical'])
      expect(carcass('pocket-screw', false).map((h) => h.severity)).toEqual(['critical'])
    })
  })

  it('proposes the catalog back board: TR6, described by its thickness', () => {
    const back = findings(exampleNightstand)[0].alternatives.find((a) => a.key === 'back-6mm')
    expect(back).toEqual({ key: 'back-6mm', description: 'Trasera de 6 mm clavada y pegada a laterales, piso y techo', data: { material: 'TR6' } })
  })
})

describe('newCriticals', () => {
  it('counts only those that were not there before', () => {
    const before = findings({ ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 900 } })
    const after = findings({ ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 1000 } })
    expect(newCriticals(before, after)).toEqual([])
    expect(newCriticals([], after).length).toBe(5)
  })
})
