import { describe, expect, it } from 'vitest'
import { createExpert } from '../../src/adapters/llm/common/expert'
import { createSimulated } from '../../src/adapters/llm/simulated/simulated'
import { testCatalog } from '../../src/domain/furniture/fixtures/catalog.test-util'
import type { TablePlan } from '../../src/domain/furniture/modules/table'
import { ask, meantPlan } from './ask'
import { variantOf } from './autonomy'
import { set, type Group } from './corpus'

const dining = variantOf('table', 'comedor') as TablePlan
const taller = { ...dining, dimensions: { ...dining.dimensions, height: 780 } }

/** An expert that answers every request with the same thing. */
const answering = (response: object) => {
  const expert = createExpert({ provider: 'ask', model: 'fixed-answer', completeJSON: async () => ({ json: response, usage: {} }) }, 'Ask')
  return { ...createSimulated(0), adjustPlan: expert.adjustPlan }
}
const reply = (plan: TablePlan | null, action = 'plan') => ({ explanation: 'Listo.', summary: 'Cambiar la ficha', action, table: plan, questions: [], suggestions: ['Cambiar el material', 'Agregar una repisa'], requirements: { add: [], remove: [] }, decisions: [] })

const unread: Group[] = [{ on: 'comedor', cases: [['Súbela tantito, como a 78', set('dimensions.height', 780)]] }]
const answers = async (response: object, groups = unread) => (await ask('table', groups, testCatalog, answering(response))).map(({ answer, detail }) => ({ answer, detail }))

describe('ask', () => {
  it('says the expert did what was meant when its plan is the one the request means', async () => {
    expect(await answers(reply(taller))).toEqual([{ answer: 'as meant', detail: [] }])
  })

  it('names what the expert changed besides, or instead', async () => {
    expect(await answers(reply({ ...taller, overhang: 0 }))).toEqual([{ answer: 'otherwise', detail: ['plan.overhang: 0 (meant 50)'] }])
  })

  it('tells an answer that changed nothing from a change', async () => {
    expect(await answers(reply(null, 'answer'))).toEqual([{ answer: 'no change', detail: [] }])
  })

  it('asks only about what Knotty does not read and the form can set', async () => {
    const groups: Group[] = [{ on: 'comedor', cases: [['Hazla de 1.80 de largo', set('dimensions.width', 1800)], ['Hazla redonda', 'expert'], ['¿En cuánto me sale?', { question: 'cost' }], ['Que tenga rueditas, de 78', set('casters', 'yes')]] }]
    expect(await answers(reply(taller), groups)).toEqual([])
  })
})

describe('meantPlan', () => {
  it('sets each edit on the form, in order', () => {
    expect(meantPlan(dining, [{ field: 'dimensions.height', value: 780 }, { field: 'legs', value: 'legs' }])).toEqual({ ...taller, legs: 'legs' })
  })

  it('is null for a field the form does not have', () => {
    expect(meantPlan(dining, [{ field: 'casters', value: 'yes' }])).toBeNull()
  })
})
