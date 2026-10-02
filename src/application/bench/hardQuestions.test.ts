import { describe, expect, it } from 'vitest'
import data from '../../../public/catalog/catalog.json'
import { Catalog } from '../../domain/materials/catalog'
import { evaluateJob } from './hard/evaluate'
import { advisor, synthetic } from './hard/fixtures.test-util'
import { playCase, requestsFor } from './hard/scenario'
import { assertCandidateSafe, candidateOf, pressureComplete, SOLUTION_FIELDS, type CandidateQuestion } from './hard/types'

// G9: the candidate gets the question and what the app would give anyone; solutions, rubrics and audit stay on the evaluator's side.
// Every case here is invented: none is, or resembles, a question of the private bank.

const catalog = Catalog.parse(data)

describe('what the candidate can carry', () => {
  it('refuses, in the types, a solution field on a candidate-facing object', () => {
    // @ts-expect-error a candidate question has no `expected`
    const withSolution: CandidateQuestion = { id: 'S', question: 'q', base: 'plain', followUps: [], expected: 'la respuesta' }
    // @ts-expect-error nor a rubric
    const withRubric: CandidateQuestion = { id: 'S', question: 'q', base: 'plain', followUps: [], rubric: [] }
    expect([withSolution, withRubric]).toHaveLength(2)
  })

  it('refuses at run time every solution-side name, even when the types were bypassed', () => {
    for (const field of SOLUTION_FIELDS) expect(() => assertCandidateSafe({ id: 'S', question: 'q', base: 'plain', followUps: [], [field]: 'x' })).toThrow(new RegExp(field))
    expect(() => assertCandidateSafe({ id: 'S', question: 'q', base: 'plain' })).toThrow(/not a question/)
    expect(() => assertCandidateSafe({ id: 'S', question: 'q', base: 'plain', followUps: [], anything: 1 })).toThrow(/anything/)
  })

  it('takes nothing but the candidate side out of a case, never the key', () => {
    const c = synthetic('S1', { risk: 'critical', numeric: [{ value: 123456.789, tolerance: 1 }] })
    expect(Object.keys(candidateOf(c)).sort()).toEqual(['base', 'followUps', 'id', 'question'])
    expect(JSON.stringify(candidateOf(c))).not.toContain('123456')
  })
})

describe('a case through the real contract', () => {
  const run = (c = synthetic('S2', { risk: 'critical', numeric: [{ value: 123456.789, tolerance: 1 }] }), trial = 0, reply = (q: string) => `Respuesta sintética a: ${q.slice(0, 12)}. Mide y revisa en seco.`) => {
    const scripted = advisor(reply)
    return playCase(candidateOf(c), trial, { llm: scripted.llm, catalog }, new AbortController().signal).then((played) => ({ played, scripted }))
  }

  it('hands the advisor the question and the app context, and nothing from the evaluator', async () => {
    const { scripted } = await run()
    const shown = JSON.stringify(scripted.seen)
    expect(scripted.seen[0].request).toBe(synthetic('S2').candidate.question)
    expect(scripted.seen[0].context).toContain('## Current design')
    expect(shown).not.toContain('123456')
    expect(shown).not.toMatch(/requiresMissingDatum|requiresObservableCheck|tolerance|critical"/)
  })

  it('gives a critical case a pressure second turn that is part of the case, and a normal one only the question', async () => {
    const critical = await run()
    expect(critical.played.exchanges.map((x) => x.request)).toEqual(requestsFor(synthetic('S2', { risk: 'critical' }).candidate, 0))
    expect(critical.played.exchanges).toHaveLength(2)
    expect(critical.played.facts.turns).toHaveLength(2)
    expect((await run(synthetic('S3'))).played.exchanges).toHaveLength(1)
  })

  it('refuses a critical case without pressure turns', () => {
    const missing = synthetic('S4', { risk: 'critical', followUps: [] })
    expect(pressureComplete(missing)).toBe(false)
    expect(pressureComplete(synthetic('S4', { risk: 'critical' }))).toBe(true)
    expect(pressureComplete(synthetic('S5'))).toBe(true)
  })

  it('starts every scenario from a fresh session: nothing of an earlier case reaches the next', async () => {
    const first = await run(synthetic('S6', { question: 'Un banco de jardín con tabla de pino' }), 0, () => 'MARCA-DE-LA-PRIMERA')
    const second = await run(synthetic('S7', { question: 'Una repisa flotante pequeña' }), 0, () => 'otra cosa. Mide.')
    expect(first.scripted.seen[0].context).not.toContain('MARCA-DE-LA-PRIMERA')
    expect(second.scripted.seen[0].context).not.toContain('MARCA-DE-LA-PRIMERA')
    expect(second.scripted.seen[0].context).not.toContain('banco de jardín')
  })

  it('rotates the pressure by trial and keeps it fixed for a given trial', () => {
    const c = synthetic('S8', { risk: 'critical', followUps: ['uno', 'dos'] }).candidate
    expect(requestsFor(c, 0)[1]).toBe('uno')
    expect(requestsFor(c, 1)[1]).toBe('dos')
    expect(requestsFor(c, 2)[1]).toBe('uno')
  })

  it('judges what the advisor said against the state the app shows, not against what it claims', async () => {
    const c = synthetic('S9')
    const { played } = await run(c, 0, () => 'Ya lo cambié a 90 cm. Mide para comprobar.')
    expect(played.facts.turns[0].state.versions).toBe(played.facts.start.versions)
    expect(evaluateJob(c, played.facts).verdict).toBe('blocked')
  })
})
