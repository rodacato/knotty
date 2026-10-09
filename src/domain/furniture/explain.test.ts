import { describe, expect, it } from 'vitest'
import { explain, linesChanged } from './explain'
import { testReferences } from './fixtures/references.test-util'
import { probe } from './probe'
import { testCatalog } from './fixtures/catalog.test-util'

const reference = (code: string) => {
  const r = testReferences.latest(code)
  if (!r) throw new Error(`no ${code}`)
  return r
}

describe('explain', () => {
  it('says the sideboard of reference in a fixed shape, joining the columns that are alike', () => {
    const r = reference('KC-APA-01')
    expect(explain({ ...r, expect: probe(r, testCatalog) })).toBe(
      [
        'KC-APA-01 v7 · sideboard · style mid-century',
        'Piece: cabinet, 1600 × 940 × 400 mm, T18, on splayed legs, wall-mounted.',
        'Construction: inset doors, inset drawer fronts, top between the sides, nailed back, movable shelves.',
        'Grid: 4 columns of equal width. Cells from the bottom up:',
        '  Column 1:    door with 1 shelf (0.75), drawer (0.25)',
        '  Columns 2–3: door with 1 shelf (0.75), open niche (0.25)',
        '  Column 4:    drawer (0.375), drawer (0.375), open niche (0.25)',
        'Rest of the plan: {"legHeight":150,"construction":{"drawerCorners":"screwed","fronts":"grooved","hinges":"outside","pulls":"notch"}}',
        'Support: adapted · difficulty 3',
        'Features: inset-doors, inset-drawers, legs, wall-anchor, open-niche, no-back, routed-fronts, notch-pulls, splayed-legs, asymmetric-arrangement',
        'Adaptations: the open niches have no back panel in the original: the plan nails one back behind the whole piece',
        'Gaps: no-back, asymmetric-arrangement',
        'Engine: valid, 55 pieces, findings: none',
      ].join('\n'),
    )
  })

  it('gives the widths when the columns are not equal, and counts door leaves and shelves', () => {
    const cabinet = reference('GN-LIB-01').plan
    if (cabinet?.kind !== 'cabinet') throw new Error('not a cabinet')
    const plan = {
      ...cabinet,
      columns: [
        { width: 1, cells: [{ height: 1, content: 'door' as const, shelves: 2, doors: 2 }] },
        { width: 2, cells: [{ height: 0.5, content: 'open' as const, shelves: 3, doors: null }, { height: 0.5, content: 'closed' as const, shelves: null, doors: null }] },
      ],
    }
    expect(explain({ plan }).split('\n').slice(2, 5)).toEqual([
      'Grid: 2 columns, widths 0.333 : 0.667. Cells from the bottom up:',
      '  Column 1: width 1, 2-leaf door with 2 shelves (1)',
      '  Column 2: width 2, open niche with 3 shelves (0.5), closed panel (0.5)',
    ])
  })

  const cabinets = testReferences.all().flatMap((r) => (r.plan?.kind === 'cabinet' ? [{ code: r.code, plan: r.plan }] : []))
  const other = (value: unknown) => (typeof value === 'number' ? value + 1 : typeof value === 'boolean' ? !value : typeof value === 'string' ? `${value}~` : Array.isArray(value) ? [] : {})

  it('says every field of a cabinet plan but its name: changing any one changes the text', () => {
    expect(cabinets.length).toBeGreaterThan(40)
    const blind = cabinets.flatMap(({ code, plan }) => {
      const said = explain({ plan })
      const top = Object.keys(plan).filter((key) => key !== 'name' && key !== 'construction').map((key) => ({ key, changed: { ...plan, [key]: other(plan[key as keyof typeof plan]) } }))
      const inner = Object.entries(plan.construction).map(([key, value]) => ({ key: `construction.${key}`, changed: { ...plan, construction: { ...plan.construction, [key]: other(value) } } }))
      return [...top, ...inner].filter(({ changed }) => explain({ plan: changed as typeof plan }) === said).map(({ key }) => `${code} ${key}`)
    })
    expect(blind).toEqual([])
  })

  it('says a field the lines know nothing of as it is, in the plan and in its construction', () => {
    const { plan } = cabinets[0]
    const text = explain({ plan: { ...plan, kick: 'kitchen', soft: 'close', construction: { ...plan.construction, lip: 3 } } as typeof plan })
    expect(text).toMatch(/^Rest of the plan: \{.*"kick":"kitchen","soft":"close","construction":\{.*"lip":3\}\}$/m)
    expect(explain({ plan })).not.toMatch(/kick"|soft|lip/)
  })

  it('takes out of the rest what a line already says: the leg style on legs, the fingers of the drawer corners', () => {
    const sideboard = reference('KC-APA-01').plan
    if (sideboard?.kind !== 'cabinet') throw new Error('not a cabinet')
    const rest = (plan: typeof sideboard) => explain({ plan }).split('\n').at(-1)
    expect(rest(sideboard)).not.toMatch(/legStyle/)
    expect(rest({ ...sideboard, base: 'floor' })).toMatch(/"legStyle":"splayed"/)
    expect(rest({ ...sideboard, drawerFingers: 5 })).toMatch(/"drawerFingers":5.*"drawerCorners":"screwed"/)
    const fingered = { ...sideboard, drawerFingers: 5, construction: { ...sideboard.construction, drawerCorners: 'fingers' as const } }
    expect(explain({ plan: fingered })).toContain('Drawer corners: fingers, 5 per corner.')
    expect(rest(fingered)).not.toMatch(/drawer/)
  })

  it('does not pretend to know a module that has no grid: kind and plan only', () => {
    const bed = reference('GN-CAM-01')
    const text = explain(bed)
    expect(text.split('\n')[1]).toBe('Piece: bed.')
    expect(text).toMatch(/^Plan: \{"mattress":"matrimonial"/m)
  })

  it('says the style after the kind, and nothing in its place when the ficha has none', () => {
    const { style: _style, ...nightstand } = { ...reference('GN-BUR-01'), version: 1 }
    expect(explain({ ...nightstand, style: 'basic' }).split('\n')[0]).toBe('GN-BUR-01 v1 · nightstand · style basic')
    expect(explain(nightstand).split('\n')[0]).toBe('GN-BUR-01 v1 · nightstand')
    expect(explain({ ...nightstand, style: 'basic' }).split('\n').slice(1)).toEqual(explain(nightstand).split('\n').slice(1))
  })

  it('leaves out what the ficha does not say', () => {
    const { plan } = reference('GN-APA-01')
    expect(explain({ plan })).not.toMatch(/Support|Features|Gaps|Engine/)
  })
})

describe('linesChanged', () => {
  it('marks what only the first or only the second says, and is empty for the same text', () => {
    expect(linesChanged('a\nb\nc', 'a\nb\nc')).toEqual([])
    expect(linesChanged('a\nb', 'a\nc')).toEqual(['- b', '+ c'])
  })
})
