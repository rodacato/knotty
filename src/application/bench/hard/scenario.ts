import { analyze } from '../../../domain/checks/analysis'
import { isAccepted } from '../../../domain/checks/structure/accepted'
import { findingKey } from '../../../domain/checks/structure/finding'
import type { Design } from '../../../domain/design/schema'
import { exampleBookcase } from '../../../domain/furniture/fixtures/bookcase'
import type { Catalog } from '../../../domain/materials/catalog'
import { currentDesign, type DesignState } from '../../../domain/session/state'
import type { LLMProvider } from '../../../ports/LLMProvider'
import { buildContext } from '../../context'
import { createUseCases } from '../../useCases'
import { infrastructureCause } from '../classify'
import type { JobFacts, StateFacts, TurnFacts } from './evaluate'
import { assertCandidateSafe, type BaseKind, type CandidateQuestion } from './types'

// One hard case through the real contract: a session that starts from a base design, and the person's messages through the chat use case, each in a fresh session.

/** The base designs are the app's own bookcase: wide enough, one of them carries a sag finding the app measures by itself. */
function baseDesign(kind: BaseKind): Design {
  return kind === 'sagging' ? { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 850 } } : exampleBookcase
}

function stateFacts(state: DesignState, catalog: Catalog): StateFacts {
  const analysis = analyze(currentDesign(state), catalog, state.requirements)
  const findings = analysis.valid ? analysis.findings : []
  return {
    versions: Math.max(...state.versions.map((v) => v.n)),
    accepted: state.accepted.map((a) => a.key),
    openCriticals: findings.filter((f) => f.severity === 'critical' && !isAccepted(f, state.accepted)).map(findingKey),
    proposalPending: state.proposal !== null,
    findings: findings.map((f) => ({ code: f.code, severity: f.severity, data: f.data })),
  }
}

export interface Exchange {
  request: string
  answer: string
}

export interface Played {
  facts: JobFacts
  exchanges: Exchange[]
}

export interface ScenarioDeps {
  llm: () => LLMProvider
  catalog: Catalog
  now?: () => string
  newId?: () => string
}

/** Only a provider failure or a cancellation is infrastructure; any other error the app showed is the candidate's to answer for. */
const failureOf = (reply: DesignState['chat'][number]): TurnFacts['failure'] => {
  if (!reply.error) return null
  if (reply.failure === 'cancelled') return 'cancelled'
  return reply.failure !== 'rejection' && infrastructureCause(reply.text) ? 'connection' : 'rejection'
}

const inMemory = () => {
  let state: DesignState | null = null
  return { load: () => state, save: (x: DesignState) => void (state = x), clear: () => void (state = null) }
}

/** The pressure turn a trial uses: fixed by the case and the trial, so a replay asks the same thing. */
export const requestsFor = (c: CandidateQuestion, trial: number): string[] => [c.question, ...(c.followUps.length ? [c.followUps[trial % c.followUps.length]] : [])]

export async function playCase(candidate: CandidateQuestion, trial: number, deps: ScenarioDeps, signal: AbortSignal): Promise<Played> {
  assertCandidateSafe(candidate)
  const useCases = createUseCases({ llm: deps.llm, catalog: deps.catalog, repository: inMemory(), now: deps.now, newId: deps.newId })
  let state = useCases.fromExample(baseDesign(candidate.base))
  const context = buildContext(state, deps.catalog)
  const start = stateFacts(state, deps.catalog)
  const turns: TurnFacts[] = []
  const exchanges: Exchange[] = []

  for (const request of requestsFor(candidate, trial)) {
    state = await useCases.adjust(state, request, signal)
    const reply = state.chat.at(-1)!
    const answer = { text: reply.text, questions: reply.questions.map((q) => [q.text, ...(q.options ?? [])].join(' / ')), suggestions: reply.suggestions }
    turns.push({ answer, failure: failureOf(reply), state: stateFacts(state, deps.catalog) })
    exchanges.push({ request, answer: [reply.text, ...answer.questions.map((q) => `? ${q}`)].join('\n') })
  }
  return { facts: { context, start, turns }, exchanges }
}
