import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import type { Design } from '../../design/schema'
import { testCatalog } from '../../furniture/fixtures/catalog.test-util'
import { buildCabinet, DEFAULT_CONSTRUCTION } from '../../furniture/modules/cabinet'
import type { RuleContext } from '../structure/finding'
import { checked, evaluateConstraints, measured } from './constraint'
import { CATEGORY_CONSTRAINTS } from './constraints'
import { typologyRule, useOf } from './typology'
import { REFERENCED, sourceProblem } from '../../sources.test-util'


const contextOf = (design: Design): RuleContext => {
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return { design, geo: a.geo, catalog: testCatalog, contacts: a.contacts }
}
const bookcase = buildCabinet(
  { kind: 'cabinet', name: 'Librero', dimensions: { width: 600, height: 1800, depth: 200 }, material: 'T18', base: 'floor', wallMounted: true, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [{ height: 1, content: 'open', shelves: null, doors: null }] }] },
  testCatalog,
).design

describe('category constraints', () => {
  const referenced = CATEGORY_CONSTRAINTS.filter((c) => !c.source.startsWith('no reference: '))

  it('every entry points to docs/carpinteria, or says why there is no reference', () => {
    expect(CATEGORY_CONSTRAINTS.filter((c) => !REFERENCED.test(c.source) && !/^no reference: .{10,}/.test(c.source)).map((c) => c.check)).toEqual([])
  })

  it.each(referenced.map((c) => [c.check, c.source] as const))('%s: its section and row are in the document', (_, source) => {
    expect(sourceProblem(source)).toBeNull()
  })

  it('a check id is used once per kind of furniture', () => {
    const pairs = CATEGORY_CONSTRAINTS.flatMap((c) => c.appliesTo.map((kind) => `${kind}:${c.check}`))
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it('R10 is the list evaluated for the kind of the design', () => {
    const ctx = contextOf(bookcase)
    expect(typologyRule(ctx)).toEqual(evaluateConstraints(CATEGORY_CONSTRAINTS, ctx, useOf(bookcase)))
    expect(typologyRule(ctx).map((f) => f.check)).toEqual(['bookcase.depth'])
  })

  it('a new entry is evaluated with no other change: a measure, and a check with its own function', () => {
    const narrow = measured({
      check: 'bookcase.width',
      appliesTo: ['bookcase'],
      metric: 'width',
      limits: { min: 800 },
      severity: 'detail',
      source: 'no reference: a test entry',
      message: (width, { min }) => `Mide ${width} de ancho; lo usual es desde ${min}.`,
      data: (width) => ({ width }),
    })
    const shelves = checked({
      check: 'bookcase.shelves',
      appliesTo: ['bookcase'],
      limits: { shelves: 3 },
      source: 'no reference: a test entry',
      find: ({ design }, { shelves }, report) => (design.pieces.filter((p) => p.role === 'shelf').length < shelves ? [report('recommendation', [], `Menos de ${shelves} entrepaños.`)] : []),
    })
    const ctx = contextOf(bookcase)
    const found = evaluateConstraints([...CATEGORY_CONSTRAINTS, narrow, shelves], ctx, 'bookcase')
    expect(found.filter((f) => f.check !== 'bookcase.depth')).toEqual([
      { code: 'R10_USE', severity: 'detail', pieces: [], check: 'bookcase.width', message: 'Mide 600 de ancho; lo usual es desde 800.', data: { width: 600 }, alternatives: [] },
      { code: 'R10_USE', severity: 'recommendation', pieces: [], check: 'bookcase.shelves', message: 'Menos de 3 entrepaños.', data: {}, alternatives: [] },
    ])
    expect(evaluateConstraints([narrow, shelves], ctx, 'wardrobe')).toEqual([])
    expect(evaluateConstraints([narrow, shelves], ctx, null)).toEqual([])
  })

  it('an entry that does not apply when anchored is skipped for anchored furniture', () => {
    const tall = measured({ check: 'test.tall', appliesTo: ['bookcase'], metric: 'height', limits: { max: 1000 }, unlessAnchored: true, severity: 'critical', source: 'no reference: a test entry', message: (h) => `${h}` })
    expect(evaluateConstraints([tall], contextOf(bookcase), 'bookcase')).toEqual([])
    expect(evaluateConstraints([tall], contextOf({ ...bookcase, wallAnchored: false }), 'bookcase')).toHaveLength(1)
  })
})
