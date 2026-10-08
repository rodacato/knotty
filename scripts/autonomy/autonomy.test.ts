import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Intent } from '../../src/domain/furniture/intent/intent'
import type { FurnitureKind, FurniturePlan } from '../../src/domain/furniture/modules/plan'
import { Catalog } from '../../src/domain/materials/catalog'
import { CORPUS, classify, measure } from './autonomy'
import { asks, both, set } from './corpus'

const plan = {} as FurniturePlan
const edit = (field: string, value: string | number): Intent => ({ kind: 'edit', field, value, plan })

describe('classify', () => {
  it('reads a request only when the field and the value are the ones meant', () => {
    expect(classify(set('dimensions.width', 1800), edit('dimensions.width', 1800))).toBe('read')
    expect(classify(set('dimensions.width', 1800), edit('dimensions.width', 180))).toBe('misread')
    expect(classify(set('dimensions.width', 1800), edit('dimensions.depth', 1800))).toBe('misread')
    expect(classify(set('dimensions.width', 1800), { kind: 'question', topic: 'measures' })).toBe('misread')
  })

  it('counts a request nothing was read in as unread, not as a mistake', () => {
    expect(classify(set('legs', 'legs'), null)).toBe('unread')
    expect(classify(asks('cost'), null)).toBe('unread')
  })

  it('takes one of two changes as a misreading: the other one is lost', () => {
    const two = both(['dimensions.width', 1800], ['legs', 'legs'])
    expect(classify(two, edit('dimensions.width', 1800))).toBe('misread')
    expect(classify(two, null)).toBe('unread')
  })

  it('tells one question from another', () => {
    expect(classify(asks('cost'), { kind: 'question', topic: 'cost' })).toBe('read')
    expect(classify(asks('cost'), { kind: 'question', topic: 'sheets' })).toBe('misread')
  })

  it('wants a question where the request reads two ways, and counts the question as unread where it reads one', () => {
    const unclear: Intent = { kind: 'unclear', options: [] }
    expect(classify('ask', unclear)).toBe('read')
    expect(classify('ask', edit('columns.shelves', 1))).toBe('misread')
    expect(classify('ask', null)).toBe('unread')
    expect(classify(set('columns.shelves', 1), unclear)).toBe('unread')
    expect(classify('expert', unclear)).toBe('misread')
  })

  it('leaves the expert its own, and reading anything into it is a mistake', () => {
    expect(classify('expert', null)).toBe('left')
    expect(classify('expert', edit('dimensions.height', 700))).toBe('misread')
  })
})

describe('the corpus', () => {
  const catalog = Catalog.parse(JSON.parse(readFileSync('public/catalog/catalog.json', 'utf8')))

  it.each(Object.keys(CORPUS) as FurnitureKind[])('has no request Knotty misreads: %s', (kind) => {
    expect(measure(kind, CORPUS[kind]!, catalog).filter((r) => r.outcome === 'misread')).toEqual([])
  })
})
