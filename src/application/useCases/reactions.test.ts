import { describe, expect, it } from 'vitest'
import { createExpert } from '../../adapters/llm/common/expert'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import type { DesignState } from '../../domain/session/state'
import { preservation, type Kept } from '../bench/preservation'
import { createUseCases, currentPlan } from './index'
import { TABLE_REACTIONS, type Reaction } from './reactions.test-util'

const person = (state: DesignState): Kept => ({ plan: currentPlan(state).plan, requirements: state.requirements, decisions: state.decisions, extras: currentPlan(state).extras })
const waiting = (state: DesignState): Kept => {
  const proposal = state.proposal!
  return { plan: proposal.plan ?? currentPlan(state).plan, requirements: proposal.requirements, decisions: state.decisions, extras: proposal.extras }
}

async function react({ before, request, response, allowed }: Reaction) {
  let calls = 0
  const expert = createExpert({ provider: 'reaction', model: 'fixed-answer', completeJSON: async () => (calls++, { json: response, usage: {} }) }, 'Reaction')
  let id = 0
  const useCases = createUseCases({ llm: () => ({ ...createSimulated(0), adjustPlan: expert.adjustPlan }), catalog: testCatalog, repository: { load: () => null, save: () => {}, clear: () => {} }, now: () => '2026-10-05T18:00:00Z', newId: () => `reaction-${++id}` })
  const opened = useCases.openExample({ name: before.plan.name, plan: before.plan, notes: 'Escenario inventado.' })
  const initial = { ...opened, requirements: before.requirements ?? [] }
  const after = await useCases.adjust(initial, request, new AbortController().signal)

  const pending = !!after.proposal && after.proposal !== initial.proposal
  const outside = (kept: Kept) => preservation({ before: person(initial), after: kept, allowed }).unauthorized.map((c) => c.path)
  return {
    outcome: pending ? 'pending' : after.current !== initial.current ? 'applied' : 'answer',
    calls,
    versions: after.versions.length - initial.versions.length,
    state: outside(person(after)),
    ...(pending ? { proposal: outside(waiting(after)) } : {}),
  }
}

describe('what Knotty does with an answer of the expert, on tables and desks', () => {
  it.each(TABLE_REACTIONS.map((r) => [r.id, r] as const))('%s', async (_, reaction) => {
    expect(await react(reaction)).toMatchObject(reaction.expect)
  })
})
