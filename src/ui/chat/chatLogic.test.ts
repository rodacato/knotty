import { describe, expect, it } from 'vitest'
import type { DesignState, Message } from '../../domain/session/state'
import { DESIGN_KINDS } from '../../domain/design/kind'
import { answerGiven, applyLabel, openQuestions, recovery, startingIdeas, suggestionsFor } from './chatLogic'

const msg = (p: Partial<Message>): Message => ({ id: 'm', author: 'expert', text: '', date: '', questions: [], answered: false, version: null, proposal: null, error: false, failure: null, thumbnail: null, answers: [], dismissed: [], suggestions: [], solutions: [], alone: false, ...p })
const stateOf = (chat: Message[], p: Partial<DesignState> = {}) => ({ chat, tray: [], proposal: null, versions: [], ...p }) as unknown as DesignState

describe('recovery', () => {
  const user = msg({ author: 'user' })
  it('retries a connection failure and an older save without a cause', () => {
    expect(recovery(msg({ error: true, failure: 'connection' }), user)).toBe('retry')
    expect(recovery(msg({ error: true }), user)).toBe('retry')
  })
  it('puts the request back in the box after a rejection', () => {
    expect(recovery(msg({ error: true, failure: 'rejection' }), user)).toBe('edit')
  })
  it('offers nothing without an error or without a request before it', () => {
    expect(recovery(msg({}), user)).toBeNull()
    expect(recovery(msg({ error: true }), msg({}))).toBeNull()
  })
})

describe('suggestionsFor', () => {
  const reply = msg({ suggestions: ['Haz A', 'Haz B'] })
  it('offers the expert suggestions, minus what the person already asked', () => {
    expect(suggestionsFor(stateOf([msg({ author: 'user', text: 'haz a' }), reply]), false, 'bed')).toEqual(['Haz B'])
  })
  it('offers none while a proposal, the tray or the expert wait', () => {
    expect(suggestionsFor(stateOf([reply], { proposal: {} as DesignState['proposal'] }), false, 'bed')).toEqual([])
    expect(suggestionsFor(stateOf([reply], { tray: [{}] as DesignState['tray'] }), false, 'bed')).toEqual([])
    expect(suggestionsFor(stateOf([reply]), true, 'bed')).toEqual([])
  })
  it('falls back to the starting ideas of that kind of furniture, only on the first version', () => {
    expect(suggestionsFor(stateOf([msg({})]), false, 'bed')).toEqual(startingIdeas('bed'))
    expect(suggestionsFor(stateOf([msg({})]), false, 'bed')).not.toEqual(suggestionsFor(stateOf([msg({})]), false, 'bookcase'))
    expect(suggestionsFor(stateOf([msg({})], { versions: [{}, {}] as DesignState['versions'] }), false, 'bed')).toEqual([])
  })
  it('never asks a bed or a table for shelves of books', () => {
    const books = DESIGN_KINDS.filter((k) => startingIdeas(k).some((s) => /libros/.test(s)))
    expect(books).toEqual(['bookcase'])
  })
})

describe('questions', () => {
  const ask = msg({ id: 'q', questions: [{ text: '¿Dónde?', options: ['Al centro', 'A un lado'] }], answers: [] })
  it('counts only unanswered questions with options', () => {
    expect(openQuestions(stateOf([ask, msg({ questions: [{ text: 'x', options: null }] }), msg({ answered: true, questions: ask.questions })]))).toHaveLength(1)
  })
  it('reads the given answer from the next request', () => {
    expect(answerGiven(stateOf([ask, msg({ author: 'user', text: 'Al centro' })]), ask, 0)).toBe('Al centro')
    expect(answerGiven(stateOf([ask, msg({ author: 'user', text: 'Te mando todo junto:\n1. ¿Dónde? A un lado' })]), ask, 0)).toBe('A un lado')
    expect(answerGiven(stateOf([ask]), ask, 0)).toBeNull()
  })
})

describe('applyLabel', () => {
  it('says Aplicar for a clean proposal and Aplicar así when critical findings remain', () => {
    expect(applyLabel(0)).toBe('Aplicar')
    expect(applyLabel(2)).toBe('Aplicar así')
  })
})
