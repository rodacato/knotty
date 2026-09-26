import { fixForAlternative } from '../../domain/editing/fixes/fixes'
import { updateDecisions, type Decision } from '../../domain/session/history/history'
import { currentDesign, markAnswered, questionAnswerKey, type DesignState } from '../../domain/session/state'
import { newCriticals } from '../../domain/checks/structure/review'
import { currentPlan, layered } from './currentPlan'
import type { Kit } from './kit'

/** What the person does with the expert's pending proposal: apply it, answer it with a fix Knotty builds, or drop it. */
export function createProposals(kit: Kit) {
  const { catalog, message, save, addVersion, noted, findingsOf } = kit

  /** The pending proposal as a new version, unsaved; `ending` closes the note, which depends on what comes after. */
  function withProposal(state: DesignState, ending: string): DesignState {
    const p = state.proposal!
    const base = { ...state, requirements: p.requirements, decisions: updateDecisions(state.decisions, p.decisions as Decision[]) }
    const withChange = addVersion(base, p.design, { summary: p.summary, reason: p.reason, operations: p.operations, origin: p.origin, plan: p.plan, extras: p.extras })
    return {
      ...withChange,
      chat: [...state.chat.map((m) => (m.proposal === 'pending' ? { ...m, proposal: 'applied' as const, answered: true } : m)), message('expert', `Listo, apliqué "${p.summary}"${ending}`, { version: withChange.current })],
    }
  }

  function applyProposal(state: DesignState): DesignState {
    if (!state.proposal) return state
    return save(withProposal(state, ' como lo pediste. Los puntos críticos siguen marcados en la revisión.'))
  }

  /** A rules option Knotty can build: the proposal, then the solution, each its own version, no expert. Null sends the option to the expert. */
  function answerWithFix(state: DesignState, messageId: string, question: number, option: string): DesignState | null {
    const m = state.chat.find((x) => x.id === messageId)
    const link = m?.solutions.find((s) => s.question === question && s.option === option)
    const p = state.proposal
    if (!m || !link || m.proposal !== 'pending' || !p) return null
    const criticals = newCriticals(findingsOf(currentDesign(state), state.requirements), findingsOf(p.design, p.requirements))
    const fix = fixForAlternative(p.design, catalog, criticals, link.alternative)
    if (!fix || fix.label !== option) return null
    const accepted = withProposal({ ...state, chat: markAnswered(state.chat, `${messageId}#${questionAnswerKey(question)}`) }, '.')
    const withFix = addVersion(accepted, fix.design, { summary: fix.label.slice(0, 90), reason: `Solución: ${fix.label}`, operations: fix.operations, origin: null, ...layered(currentPlan(accepted), fix.operations) })
    return save(noted(withFix, 'user', `Resolví: ${fix.label}.`))
  }

  function discardProposal(state: DesignState): DesignState {
    return save({ ...state, proposal: null, chat: state.chat.map((m) => (m.proposal === 'pending' ? { ...m, proposal: 'discarded' as const, answered: true } : m)) })
  }

  return { applyProposal, answerWithFix, discardProposal }
}
