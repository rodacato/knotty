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
        'KC-APA-01 v6 · sideboard',
        'Piece: cabinet, 1600 × 940 × 400 mm, T18, on splayed legs, wall-mounted.',
        'Construction: inset doors, inset drawer fronts, top between the sides, nailed back, movable shelves.',
        'Grid: 4 columns of equal width. Cells from the bottom up:',
        '  Column 1:    door with 1 shelf (0.75), drawer (0.25)',
        '  Columns 2–3: door with 1 shelf (0.75), open niche (0.25)',
        '  Column 4:    drawer (0.375), drawer (0.375), open niche (0.25)',
        'Support: adapted · difficulty 3',
        'Features: inset-doors, inset-drawers, legs, wall-anchor, open-niche, no-back, routed-fronts, notch-pulls, splayed-legs, asymmetric-arrangement',
        'Adaptations: none',
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
    expect(explain({ plan }).split('\n').slice(2)).toEqual([
      'Grid: 2 columns, widths 0.333 : 0.667. Cells from the bottom up:',
      '  Column 1: width 1, 2-leaf door with 2 shelves (1)',
      '  Column 2: width 2, open niche with 3 shelves (0.5), closed panel (0.5)',
    ])
  })

  it('does not pretend to know a module that has no grid: kind and plan only', () => {
    const bed = reference('GN-CAM-01')
    const text = explain(bed)
    expect(text.split('\n')[1]).toBe('Piece: bed.')
    expect(text).toMatch(/^Plan: \{"mattress":"matrimonial"/m)
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
