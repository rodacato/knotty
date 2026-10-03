import { describe, expect, it } from 'vitest'
import type { Requirement } from '../../checks/requirements/requirements'
import { selectKnowledge, type KnowledgeInput, type KnowledgeStage } from './select'

const tool = (text: string): Requirement => ({ id: 'tools', text, type: 'tool', axis: null, min: null, max: null })
const base: Omit<KnowledgeInput, 'stage'> = { use: 'bookcase', module: 'cabinet', materials: [], toolLevel: 3, requirements: [] }

describe('selectKnowledge', () => {
  it.each<[KnowledgeStage, string, 'full' | 'short']>([
    ['photo', 'photo', 'short'],
    ['review', 'short', 'short'],
    ['piece', 'short', 'short'],
    ['plan-adjust', 'short', 'full'],
    ['skeleton', 'full', 'full'],
    ['reconstruct', 'full', 'full'],
  ])('%s gets core %s and a %s guide', (stage, core, guideSize) => {
    expect(selectKnowledge({ ...base, stage })).toMatchObject({ core, guideSize })
  })

  it.each<[KnowledgeStage, string[]]>([
    ['photo', []],
    ['skeleton', ['plan']],
    ['reconstruct', ['plan']],
    ['piece', ['plan']],
    ['plan-adjust', ['adjust', 'chat']],
    ['review', ['review']],
  ])('%s asks the registry for %j', (stage, operations) => {
    expect(selectKnowledge({ ...base, stage }).advice.operations).toEqual(operations)
  })

  it('asks for the kind even when the module has no guide for it', () => {
    expect(selectKnowledge({ ...base, use: 'bookcase', module: 'bed', stage: 'skeleton' })).toMatchObject({ guide: null, advice: { use: 'bookcase' } })
  })

  it('a photo has no guide and no tools, whatever the design is', () => {
    expect(selectKnowledge({ ...base, stage: 'photo', requirements: [tool('solo taladro')] })).toEqual({ core: 'photo', guide: null, guideSize: 'short', tools: null, advice: { use: null, operations: [] } })
  })

  it.each([
    ['bookcase', 'cabinet', 'bookcase'],
    ['bookcase', 'bed', null],
    ['bookcase', null, 'bookcase'],
    [null, 'cabinet', null],
    ['bench', null, null],
    ['desk', 'table', 'desk'],
    ['desk', 'cabinet', null],
  ] as const)('use %s in module %s picks guide %s', (use, module, guide) => {
    expect(selectKnowledge({ ...base, use, module, stage: 'piece' }).guide).toBe(guide)
  })

  it.each([
    ['no requirements', [], 3, 3],
    ['solo taladro', [tool('Solo tengo taladro')], 3, 1],
    ['only drill', [tool('I only have a drill')], 2, 1],
    ['drill + jigsaw', [tool('Tengo taladro y caladora')], 3, 1],
    ['drill and jigsaw', [tool('A drill and jigsaw')], 3, 1],
    ['no router', [tool('No tengo ruteadora')], 3, 2],
    ['sin sierra de mesa', [tool('Sin sierra de mesa')], 3, 2],
    ['no table saw', [tool('no table saw')], 3, 2],
    ['both caps take the lowest', [tool('Sin router'), tool('Solo taladro')], 3, 1],
    ['a cap never raises', [tool('No tengo router')], 1, 1],
    ['a positive mention selects nothing', [tool('Tengo router y sierra de mesa')], 2, 2],
    ['ambiguity selects nothing', [tool('No tengo sierra')], 3, 3],
    ['only tool requirements count', [{ ...tool('solo taladro'), type: 'style' as const }], 3, 3],
  ])('tools: %s', (_, requirements, toolLevel, expected) => {
    expect(selectKnowledge({ ...base, stage: 'skeleton', requirements, toolLevel: toolLevel as 1 | 2 | 3 }).tools).toBe(expected)
  })
})
