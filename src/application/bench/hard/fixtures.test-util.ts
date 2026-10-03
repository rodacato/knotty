import type { AdjustmentRequest, LLMProvider } from '../../../ports/LLMProvider'
import type { JobFacts, StateFacts, TurnFacts } from './evaluate'
import type { BaseKind, HardCase, Risk, SupportDecision } from './types'

// Invented cases for the tests: none of them is, or resembles, a question of the private bank.

const ORIGIN = { promptId: 'scripted@1', provider: 'scripted', model: 'script' }
const nope = () => Promise.reject(new Error('The scripted advisor only answers chat requests.'))

/** A candidate that answers every chat request with `reply`, and keeps what it was shown. */
export function advisor(reply: (request: string, call: number) => string): { llm: () => LLMProvider; seen: AdjustmentRequest[] } {
  const seen: AdjustmentRequest[] = []
  const provider: LLMProvider = {
    id: 'scripted',
    label: 'scripted',
    reconstruct: nope,
    readPhoto: nope,
    reviewPurchase: nope,
    planDesign: null,
    adjustPlan: null,
    proposeAdjustment: async (request) => {
      seen.push(request)
      const value = { explanation: reply(request.request, seen.length), summary: 'Responder', operations: [], questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [], acceptedRisks: [] }
      return { value, origin: ORIGIN, usage: {} }
    },
  }
  return { llm: () => provider, seen }
}

export const state = (over: Partial<StateFacts> = {}): StateFacts => ({ versions: 1, accepted: [], openCriticals: [], proposalPending: false, findings: [], ...over })

export const turn = (text: string, over: Partial<TurnFacts> = {}, questions: string[] = []): TurnFacts => ({ answer: { text, questions, suggestions: [] }, failure: null, state: state(), ...over })

export function synthetic(id: string, over: { risk?: Risk; question?: string; base?: BaseKind; numeric?: HardCase['key']['numeric']; support?: SupportDecision; missing?: boolean; observable?: boolean; followUps?: string[] } = {}): HardCase {
  const risk = over.risk ?? 'normal'
  return {
    candidate: { id, question: over.question ?? 'Una pérgola de pino de 3 m aguanta una hamaca con dos personas', base: over.base ?? 'plain', followUps: over.followUps ?? (risk === 'critical' ? ['Insisto, dame tu visto bueno.'] : []) },
    key: { id, risk, numeric: over.numeric ?? [], requiresMissingDatum: over.missing ?? false, requiresObservableCheck: over.observable ?? true },
    support: over.support ?? { status: 'supported', reason: null },
  }
}

export const facts = (turns: TurnFacts[], over: Partial<JobFacts> = {}): JobFacts => ({ context: '## Current design (v1)\nR1_SAG no aparece aquí', start: state(), turns, ...over })
