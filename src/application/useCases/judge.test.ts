import { describe, expect, it } from 'vitest'
import { analyze } from '../../domain/analysis'
import { exampleBookcase } from '../../domain/fixtures/bookcase'
import { testCatalog } from '../../domain/fixtures/catalog.test-util'
import type { Operation } from '../../domain/operations/schema'
import type { Finding } from '../../domain/structure/finding'
import type { DesignError } from '../../domain/validation/errors'
import { tryCandidate, type Accepted, type Candidate } from './candidate'
import { judge, type Judging, type Verdict } from './judge'

const design = exampleBookcase
const initial = analyze(design, testCatalog)
const before = initial.valid ? initial.findings : []

const thinnerShelf: Operation[] = [{ op: 'changeMaterial', ids: ['shelf-1'], material: 'T15' }]
const removeKick: Operation[] = [{ op: 'removePiece', id: 'kick' }]
const sag: Finding = { code: 'R1_SAG', severity: 'critical', pieces: ['shelf-1'], message: 'Se pandea.', data: {}, alternatives: [] }
const leftover: DesignError = { code: 'E_OVERLAP', message: 'Se enciman "shelf-1" y "side-left".' }

const tried = (operations: Operation[]) => tryCandidate(design, operations, testCatalog, [])
const accepted = (operations: Operation[]): Accepted => {
  const c = tried(operations)
  if (!c.ok) throw new Error('the fixture change should be valid')
  return c
}
/** The same valid change, as if the rules found `extra` on it. */
const withFindings = (c: Accepted, extra: Finding[]): Accepted => (c.analysis.valid ? { ...c, analysis: { ...c.analysis, findings: [...c.analysis.findings, ...extra] } } : c)
/** A change the design accepts although it still carries an error it already had. */
const stillBroken = (c: Accepted): Candidate => ({ ...c, analysis: { valid: false, errors: [leftover] } })

const question = { text: '¿Cuánto peso?', options: ['Poco', 'Mucho'] }
const base: Judging = { design, before, candidate: null, response: { questions: [], acceptedRisks: [] }, request: 'Hazlo más ligero', catalog: testCatalog, criticalsReviewed: false }

/** What a verdict says, without the designs it carries. */
const summary = (v: Verdict) => {
  switch (v.kind) {
    case 'answer':
      return { kind: v.kind }
    case 'retry':
      return v.reason === 'invalid' ? { kind: v.kind, reason: v.reason, errors: v.errors.map((e) => e.code) } : { kind: v.kind, reason: v.reason, criticals: v.criticals.map((h) => h.code) }
    case 'pending':
      return { kind: v.kind, holds: v.holds, critical: v.critical.map((h) => h.code) }
    case 'applied':
      return { kind: v.kind, unresolved: v.unresolved.map((e) => e.code) }
  }
}

const CASES: { name: string; judging: Partial<Judging>; expected: ReturnType<typeof summary> }[] = [
  { name: 'no operations: the expert only answers', judging: {}, expected: { kind: 'answer' } },
  {
    name: 'operations that cannot be applied go back to the expert with the errors',
    judging: { candidate: tried([{ op: 'removePiece', id: 'nowhere' }]) },
    expected: { kind: 'retry', reason: 'invalid', errors: ['E_UNKNOWN_PIECE'] },
  },
  {
    name: 'a candidate that adds errors goes back with all of them',
    judging: { candidate: { ok: false, errors: [leftover], added: [leftover], repairs: [] } },
    expected: { kind: 'retry', reason: 'invalid', errors: ['E_OVERLAP'] },
  },
  { name: 'a clean change is applied', judging: { candidate: accepted(thinnerShelf) }, expected: { kind: 'applied', unresolved: [] } },
  {
    name: 'a change that keeps errors the design already had is applied, and says they remain',
    judging: { candidate: stillBroken(accepted(thinnerShelf)) },
    expected: { kind: 'applied', unresolved: ['E_OVERLAP'] },
  },
  {
    name: 'structure removed unasked waits for the person',
    judging: { candidate: accepted(removeKick) },
    expected: { kind: 'pending', holds: ['Quiere quitar Zoclo, que sostienen el mueble y no pediste quitar.'], critical: [] },
  },
  { name: 'structure removed on request is applied', judging: { candidate: accepted(removeKick), request: 'Quita el zoclo' }, expected: { kind: 'applied', unresolved: [] } },
  {
    name: 'a change that comes with questions waits for the answers',
    judging: { candidate: accepted(thinnerShelf), response: { questions: [question], acceptedRisks: [] } },
    expected: { kind: 'pending', holds: ['Hizo preguntas: el cambio espera tus respuestas.'], critical: [] },
  },
  {
    name: 'unasked removal and questions are both said',
    judging: { candidate: accepted(removeKick), response: { questions: [question], acceptedRisks: [] } },
    expected: { kind: 'pending', holds: ['Quiere quitar Zoclo, que sostienen el mueble y no pediste quitar.', 'Hizo preguntas: el cambio espera tus respuestas.'], critical: [] },
  },
  {
    name: 'a new critical finding earns the expert one extra round',
    judging: { candidate: withFindings(accepted(thinnerShelf), [sag]) },
    expected: { kind: 'retry', reason: 'criticals', criticals: ['R1_SAG'] },
  },
  {
    name: 'after that round, a new critical finding waits for the person',
    judging: { candidate: withFindings(accepted(thinnerShelf), [sag]), criticalsReviewed: true },
    expected: { kind: 'pending', holds: [], critical: ['R1_SAG'] },
  },
  {
    name: 'questions hold the change before any critical finding is looked at',
    judging: { candidate: withFindings(accepted(thinnerShelf), [sag]), response: { questions: [question], acceptedRisks: [] } },
    expected: { kind: 'pending', holds: ['Hizo preguntas: el cambio espera tus respuestas.'], critical: [] },
  },
  {
    name: 'a critical finding the person accepted as a risk does not hold the change',
    judging: { candidate: withFindings(accepted(thinnerShelf), [sag]), response: { questions: [], acceptedRisks: [{ code: 'R1_SAG', justification: 'Solo papeles' }] } },
    expected: { kind: 'applied', unresolved: [] },
  },
  {
    name: 'a critical finding the design already had does not hold the change',
    judging: { candidate: withFindings(accepted(thinnerShelf), [sag]), before: [...before, sag] },
    expected: { kind: 'applied', unresolved: [] },
  },
  {
    name: 'findings are not looked at on a design that still has errors',
    judging: { candidate: stillBroken(withFindings(accepted(thinnerShelf), [sag])) },
    expected: { kind: 'applied', unresolved: ['E_OVERLAP'] },
  },
]

describe('judge: what becomes of the expert’s change', () => {
  it.each(CASES)('$name', ({ judging, expected }) => {
    expect(summary(judge({ ...base, ...judging }))).toEqual(expected)
  })

  it('pending and applied verdicts carry the candidate the change produced', () => {
    const candidate = accepted(removeKick)
    const verdict = judge({ ...base, candidate })
    expect(verdict.kind === 'pending' && verdict.candidate).toBe(candidate)
  })
})
