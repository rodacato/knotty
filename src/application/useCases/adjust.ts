import { kindOf } from '../../domain/furniture/kind'
import { byPerson, keepPersonKind } from '../../domain/furniture/kind'
import { analyze } from '../../domain/checks/analysis'
import type { Design } from '../../domain/design/schema'
import { error } from '../../domain/design/validation/errors'
import { fixForAlternative } from '../../domain/editing/fixes/fixes'
import { updateDecisions, type Decision, type Origin } from '../../domain/session/history/history'
import type { Catalog } from '../../domain/materials/catalog'
import { answerQuestion } from '../../domain/furniture/intent/answers'
import { parseIntent } from '../../domain/furniture/intent/intent'
import { describePlanChanges, FurniturePlan } from '../../domain/furniture/modules/plan'
import { rebuildFromPlan } from '../../domain/furniture/modules/rebuild'
import type { Operation } from '../../domain/editing/operations/schema'
import type { Repair } from '../../domain/editing/repair/repair'
import { requirementChanges, updateRequirements, type Requirement } from '../../domain/checks/requirements/requirements'
import { currentDesign, markAnswered, type DesignState, type Message } from '../../domain/session/state'
import type { Finding } from '../../domain/checks/structure/finding'
import { appendTrace, BY_KNOTTY, describeProblems, traceErrors, type TraceEntry } from '../../domain/session/trace/trace'
import { named, withCandidate } from '../named'
import { expertCanWrite, expertPlans, PlanAdjustment, type PlanAdjustRequest } from '../../ports/LLMProvider'
import { knowledgeFor } from '../knowledge'
import { buildContext, buildPlanContext } from '../context'
import { knownErrors, tryCandidate, type Accepted, type Candidate } from './candidate'
import { adjustFailed, alsoRepaired, CANCELLED, EXPERT_FAILED, localText, requirementsKept, stillPending } from './copy'
import { currentPlan, layered } from './currentPlan'
import { expertCall, traceEntry } from './expertCall'
import { criticalsCorrection, listErrors, notBuiltCorrection, planCorrection } from './forExpert'
import { judge, type Verdict } from './judge'
import { ATTEMPTS, type Kit, type OnProgress, type Stage } from './kit'

// The plan's answer and one correction with its errors; after that the request goes piece by piece.
const PLAN_ATTEMPTS = 2

/** Computed the first time it is asked for, and kept. */
function lazy<T>(make: () => T): () => T {
  let value: { v: T } | null = null
  return () => (value ??= { v: make() }).v
}

type Proposal = NonNullable<DesignState['proposal']>
type Pending = Extract<Verdict, { kind: 'pending' }>

/** What the expert proposed, kept aside until the person decides; its requirements and decisions apply only with it. */
function proposalFrom(p: {
  design: Design
  operations: Operation[]
  response: { summary: string; decisions: Decision[] }
  request: string
  critical: Finding[]
  requirements: Requirement[]
  origin: Origin | null
  plan: { plan: FurniturePlan | null; extras: Operation[] }
  holds: string[]
}): Proposal {
  return {
    design: p.design,
    operations: p.operations,
    summary: p.response.summary,
    reason: p.request,
    critical: p.critical.map((h) => ({ code: h.code, message: h.message, pieces: h.pieces })),
    requirements: p.requirements,
    decisions: p.response.decisions,
    origin: p.origin,
    plan: p.plan.plan,
    extras: p.plan.extras,
    holds: p.holds,
  }
}

/** What a change starts from: the session's requirements and decisions, and what a pending proposal already added, since the change completes it. */
function standing(state: DesignState): { requirements: Requirement[]; decisions: Decision[]; proposed: Decision[] } {
  const p = state.proposal
  if (!p) return { requirements: state.requirements, decisions: state.decisions, proposed: [] }
  const { added } = requirementChanges(state.requirements, { add: p.requirements, remove: [] })
  return { requirements: [...state.requirements, ...added], decisions: updateDecisions(state.decisions, p.decisions), proposed: p.decisions }
}

/**
 * The expert adds requirements; one the person already had is theirs to change.
 * `kept` leaves those as they were, `asked` is the list as the expert wants it, for a change that waits for the person.
 */
function requirementsWith(current: Requirement[], changes: { add: Requirement[]; remove: string[] }) {
  const { added, touched } = requirementChanges(current, changes)
  return { kept: updateRequirements(current, { add: added, remove: [] }), asked: updateRequirements(current, changes), touched: touched.map((r) => r.text) }
}

/** An answer makes no proposal: what it tried to change of the person's requirements is left as it was, and said. */
const answerText = (explanation: string, touched: string[]) => (touched.length ? `${explanation}\n\n${requirementsKept(touched)}` : explanation)

/** If the expert offered no options for a critical finding, the rules' alternatives are offered, those Knotty can build first. */
function questionFromAlternatives(criticals: Finding[], design: Design, catalog: Catalog): Pick<Message, 'questions' | 'solutions'> {
  const alternatives = criticals.flatMap((h) => h.alternatives)
  const built = [...new Set(alternatives.map((a) => a.key))].flatMap((key) => fixForAlternative(design, catalog, criticals, key) ?? [])
  const options = [...new Set([...built.map((f) => f.label), ...alternatives.map((a) => a.description)])].slice(0, 3)
  if (!options.length) return { questions: [], solutions: [] }
  const solutions = built.filter((f) => options.includes(f.label)).map((f) => ({ question: 0, option: f.label, alternative: f.key }))
  return { questions: [{ text: '¿Cómo lo resolvemos?', options }], solutions }
}

/** The questions a pending critical change asks: the expert's own, or the rules' alternatives. */
const askAboutCriticals = (questions: Message['questions'], criticals: Finding[], design: Design, catalog: Catalog) =>
  questions.length ? { questions } : questionFromAlternatives(criticals, design, catalog)

/** A chat request to change the design: through the plan when there is one, else piece by piece, judged before it is applied. */
export function createAdjust(kit: Kit) {
  const { catalog, promptCatalog, message, save, addVersion, findingsOf } = kit

  /** Everything one request works with. */
  function roundFor(withRequest: DesignState, request: string, signal: AbortSignal, onProgress: OnProgress) {
    const design = currentDesign(withRequest)
    const trace: TraceEntry[] = []
    return {
      withRequest,
      request,
      signal,
      onProgress,
      llm: kit.llm(),
      design,
      before: findingsOf(design, withRequest.requirements),
      plan: currentPlan(withRequest),
      // If the current design has unresolved problems, a change that fixes some and adds none is progress.
      known: knownErrors(analyze(design, catalog, withRequest.requirements)),
      /** The whole design for the piece path; built only when the request gets there. */
      context: lazy(() => buildContext(withRequest, catalog)),
      trace,
      reply: (text: string, extra: Partial<Message> = {}, base: DesignState = withRequest) =>
        save({ ...base, trace: appendTrace(base.trace, trace), chat: [...base.chat, message('expert', text, extra)] }),
    }
  }
  type Round = ReturnType<typeof roundFor>

  /** A change that waits for the person: held for what `holds` says, or asking how to resolve its critical findings. */
  function waitFor(
    { withRequest, request, reply }: Round,
    verdict: Pending,
    p: { operations: Operation[]; response: { explanation: string; summary: string; decisions: Decision[]; questions: Message['questions'] }; requirements: Requirement[]; origin: Origin | null; plan: { plan: FurniturePlan | null; extras: Operation[] }; suggestions: string[] },
  ): DesignState {
    const { design } = verdict.candidate
    const proposal = proposalFrom({ design, operations: p.operations, response: p.response, request, critical: verdict.critical, requirements: p.requirements, origin: p.origin, plan: p.plan, holds: verdict.holds })
    const ask = verdict.holds.length ? { questions: p.response.questions, suggestions: p.suggestions } : askAboutCriticals(p.response.questions, verdict.critical, design, catalog)
    return reply(p.response.explanation, { ...ask, proposal: 'pending' }, { ...withRequest, proposal })
  }

  /** A request Knotty reads alone: answered from its numbers, or a plan edit judged like the expert's; null sends it to the expert. */
  function locally(round: Round, answering: string | null): DesignState | null {
    const { withRequest, request, design, before, plan: current, trace } = round
    const reply: Round['reply'] = (text, extra = {}, base) => round.reply(text, { ...extra, alone: true }, base)
    const live = current.plan && !current.diverged ? current.plan : null
    const intent = parseIntent(request, live, design, catalog)
    if (!intent) return null
    const started = Date.now()
    const note = (outcome: TraceEntry['outcome'], errors: TraceEntry['errors'] = [], repairs: Repair[] = []) => trace.push(traceEntry('adjust', 0, started, null, outcome, errors, repairs, BY_KNOTTY))
    if (intent.kind === 'question') {
      const answer = answerQuestion(intent.topic, design, catalog, live)
      note(answer ? 'ok' : 'invalid', answer ? [] : [{ code: 'E_LOCAL', message: 'El diseño no se puede medir: va al experto' }])
      return answer ? reply(answer) : null
    }
    // An answer to the expert or to a pending proposal only makes sense with what the expert said: it reads it.
    if (!live || answering || withRequest.proposal) return null
    if (intent.kind === 'unclear') {
      note('ok')
      return reply(localText.unclear, { suggestions: intent.options })
    }
    if (intent.plan === live) {
      note('ok')
      return reply(localText.already)
    }
    const rebuilt = rebuildFromPlan(intent.plan, current.extras, catalog, withRequest.requirements)
    rebuilt.design = byPerson(design, rebuilt.design)
    const analysis = analyze(rebuilt.design, catalog, withRequest.requirements)
    const refused = analysis.valid ? (rebuilt.missing ? [error('E_PARTS', rebuilt.missing)] : []) : analysis.errors
    note(refused.length ? 'invalid' : 'ok', traceErrors(refused), rebuilt.repairs)
    if (refused.length) return null
    const extras = current.extras.filter((e) => !rebuilt.dropped.includes(e))
    const candidate: Accepted = { ok: true, design: rebuilt.design, analysis, repairs: rebuilt.repairs, warnings: [] }
    // The plan path's policy: no extra round, so new criticals wait for the person with the rules' options.
    const verdict = judge({ design, before, candidate, response: { questions: [], acceptedRisks: [] }, request, catalog, extraRound: false, criticalsReviewed: false })
    const changes = describePlanChanges(live, intent.plan)
    const said = changes.length ? changes : ['cambio en la ficha']
    const summary = `${said.join(', ').charAt(0).toUpperCase()}${said.join(', ').slice(1)}`.slice(0, 90)
    const plan = { plan: intent.plan, extras }
    if (verdict.kind === 'pending') {
      const explanation = localText.pending(said, verdict.critical.map((c) => c.message), verdict.holds.length > 0)
      return waitFor({ ...round, reply }, verdict, { operations: [], response: { explanation, summary, decisions: [], questions: [] }, requirements: withRequest.requirements, origin: null, plan, suggestions: [] })
    }
    if (verdict.kind !== 'applied') return null
    const withChange = addVersion(withRequest, rebuilt.design, { summary, reason: request, operations: [], origin: null, ...plan })
    return reply([localText.applied(said), ...rebuilt.notes].join('\n\n'), { version: withChange.current }, withChange)
  }

  /**
   * With a live plan the expert edits the plan, judged like any change but with no extra round for criticals.
   * A plan that does not build goes back once with its errors; null means: go piece by piece, as a plan the expert could not write back whole does from the start.
   */
  async function throughPlan(round: Round): Promise<DesignState | null> {
    const { withRequest, request, signal, onProgress, llm, design, before, plan: current, trace, reply } = round
    const plan = current.plan
    if (!plan || current.diverged || !llm.adjustPlan || !expertCanWrite(plan)) return null
    const context = buildPlanContext(withRequest, catalog, current.extras)
    const known = kindOf(design).kind
    const use = known === 'unknown' ? null : known
    let correction: PlanAdjustRequest['correction'] = null
    for (let attempt = 0; attempt < PLAN_ATTEMPTS; attempt++) {
      onProgress(correction ? 'correcting' : 'proposing', attempt)
      const call = await expertCall(() => llm.adjustPlan!({ context, request, plan, kind: use, catalog: promptCatalog(), knowledge: knowledgeFor(withRequest, kit.toolLevel(), 'plan-adjust'), correction }, signal), {
        step: 'adjust',
        attempt,
        signal,
        trace,
        onFailure: 'skip',
        code: 'E_PLAN_ADJUSTMENT',
        subject: 'Ficha',
      })
      if (!call.ok) return null
      const { response, started } = call
      const parsedResponse = PlanAdjustment.safeParse(response.value)
      if (!parsedResponse.success) {
        trace.push(traceEntry('adjust', attempt, started, response, 'invalid', [{ code: 'E_SCHEMA', message: parsedResponse.error.message }], [], 'Ficha'))
        return null
      }
      const r = parsedResponse.data
      const suggestions = r.suggestions.slice(0, 4)
      const offered = expertPlans(r)[plan.kind]
      const proposed = offered && keepPersonKind(offered, design)
      if (r.action === 'freeform') {
        trace.push(traceEntry('adjust', attempt, started, response, 'ok', [], [], 'Ficha: no cabe, va pieza por pieza'))
        return null
      }
      if (r.action === 'answer') {
        trace.push(traceEntry('adjust', attempt, started, response, 'ok', [], [], 'Ficha: respuesta'))
        const { kept, touched } = requirementsWith(withRequest.requirements, r.requirements)
        return reply(answerText(r.explanation, touched), { questions: r.questions, suggestions: suggestions }, { ...withRequest, requirements: kept, decisions: updateDecisions(withRequest.decisions, r.decisions) })
      }
      const parsedPlan = FurniturePlan.safeParse(proposed)
      if (!parsedPlan.success) {
        const errors = parsedPlan.error.issues.map((issue) => ({ code: 'E_SCHEMA' as const, message: issue.message, data: { path: issue.path } }))
        trace.push(traceEntry('adjust', attempt, started, response, 'invalid', traceErrors(errors), [], 'Ficha'))
        correction = { previousResponse: r, errors: `The plan has inconsistent fields:\n${listErrors(errors)}\nReturn a complete plan that satisfies these constraints.` }
        continue
      }
      const next = parsedPlan.data
      const previous = FurniturePlan.safeParse(plan)
      const unchanged = next.kind === 'table' && previous.success && describePlanChanges(previous.data, next).length === 0
      if (unchanged && !withRequest.proposal && !r.questions.length && !r.requirements.add.length && !r.requirements.remove.length && !r.decisions.length) {
        trace.push(traceEntry('adjust', attempt, started, response, 'ok', [], [], 'Ficha: sin cambios'))
        return reply(localText.already, { suggestions })
      }
      const from = standing(withRequest)
      const { asked: requirements, touched } = requirementsWith(from.requirements, r.requirements)
      const base = { ...withRequest, requirements, decisions: updateDecisions(from.decisions, r.decisions) }
      onProgress('checking', attempt)
      const rebuilt = rebuildFromPlan(next, current.extras, catalog, requirements)
      const analysis = analyze(rebuilt.design, catalog, requirements)
      if (!analysis.valid) {
        trace.push(traceEntry('adjust', attempt, started, response, 'invalid', traceErrors(analysis.errors), rebuilt.repairs, 'Ficha'))
        correction = { previousResponse: r, errors: planCorrection(analysis.errors) }
        continue
      }
      if (rebuilt.missing) {
        trace.push(traceEntry('adjust', attempt, started, response, 'invalid', traceErrors([error('E_PARTS', rebuilt.missing)]), rebuilt.repairs, 'Ficha'))
        correction = { previousResponse: r, errors: notBuiltCorrection(rebuilt.missing, rebuilt.notes) }
        continue
      }
      trace.push(traceEntry('adjust', attempt, started, response, 'ok', [], rebuilt.repairs, 'Ficha'))
      onProgress('structure', attempt)
      const extras = current.extras.filter((e) => !rebuilt.dropped.includes(e))
      const candidate: Accepted = { ok: true, design: rebuilt.design, analysis, repairs: rebuilt.repairs, warnings: [] }
      // The plan carries no accepted risks: a critical the person already accepted is in `before`, and is not new.
      const verdict = judge({ design, before, candidate, response: { questions: r.questions, acceptedRisks: [] }, changedRequirements: touched, request, catalog, extraRound: false, criticalsReviewed: false })
      if (verdict.kind === 'pending') return waitFor(round, verdict, { operations: [], response: { ...r, decisions: updateDecisions(from.proposed, r.decisions) }, requirements, origin: response.origin, plan: { plan: next, extras }, suggestions })
      // A valid candidate with no extra round is either pending or applied.
      if (verdict.kind !== 'applied') return null
      const withChange = addVersion(base, rebuilt.design, { summary: r.summary, reason: request, operations: [], origin: response.origin, plan: next, extras })
      return reply([r.explanation, ...rebuilt.notes].join('\n\n'), { questions: r.questions, suggestions: suggestions, version: withChange.current }, withChange)
    }
    return null
  }

  /** The expert writes operations on the pieces; each answer is tried and judged, and a broken one goes back with its errors. */
  async function pieceByPiece(round: Round): Promise<DesignState> {
    const { withRequest, request, signal, onProgress, llm, design, before, plan: current, known, trace, reply } = round
    const context = round.context()
    let correction: { previousResponse: unknown; errors: string } | null = null
    let lastError = ''
    // A valid change with new critical findings earns the expert one extra round that does not spend an attempt.
    let criticalsReviewed = false
    let attempt = 0
    let stage: Stage = 'proposing'
    while (attempt < ATTEMPTS) {
      onProgress(stage, attempt)
      const call = await expertCall(
        () =>
          llm.proposeAdjustment(
            { context: context, request: request, design: design, proposal: withRequest.proposal?.operations ?? null, catalog: promptCatalog(), knowledge: knowledgeFor(withRequest, kit.toolLevel(), 'piece'), correction: correction },
            signal,
          ),
        { step: 'adjust', attempt, signal, trace, onFailure: 'correct' },
      )
      if (!call.ok) {
        const e = call.unreadable!
        correction = { previousResponse: e.response, errors: e.problems }
        lastError = 'la respuesta no tenía el formato esperado'
        stage = 'correcting'
        attempt++
        continue
      }
      const { response, started } = call
      const r = { ...response.value, explanation: [response.value.explanation, ...(response.warnings ?? [])].join('\n\n') }
      const from = r.operations.length ? standing(withRequest) : { requirements: withRequest.requirements, decisions: withRequest.decisions, proposed: [] }
      const change = requirementsWith(from.requirements, r.requirements)
      const requirements = r.operations.length ? change.asked : change.kept
      const base = { ...withRequest, requirements, decisions: updateDecisions(from.decisions, r.decisions) }
      const suggestions = r.suggestions.slice(0, 4)
      let candidate: Candidate | null = null
      if (r.operations.length) {
        onProgress('checking', attempt)
        candidate = tryCandidate(design, r.operations, catalog, requirements, { known, repair: true })
      }
      if (!candidate) trace.push(traceEntry('adjust', attempt, started, response, 'ok', []))
      else if (!candidate.ok) trace.push(traceEntry('adjust', attempt, started, response, 'invalid', traceErrors(candidate.errors), candidate.repairs))
      else {
        trace.push(traceEntry('adjust', attempt, started, response, 'ok', candidate.analysis.valid ? [] : traceErrors(candidate.analysis.errors), candidate.repairs))
        onProgress('structure', attempt)
      }

      const verdict = judge({ design, before, candidate, response: r, changedRequirements: change.touched, request, catalog, extraRound: true, criticalsReviewed })
      if (verdict.kind === 'answer') return reply(answerText(r.explanation, change.touched), { questions: r.questions, suggestions: suggestions }, base)
      if (verdict.kind === 'retry' && verdict.reason === 'invalid') {
        correction = { previousResponse: r, errors: listErrors(verdict.errors) }
        lastError = named(withCandidate(design, candidate && !candidate.ok ? candidate.design : null), verdict.errors[0]?.message) || 'el cambio no se pudo aplicar'
        stage = 'correcting'
        attempt++
        continue
      }
      if (verdict.kind === 'retry') {
        criticalsReviewed = true
        stage = 'reviewing-criticals'
        correction = { previousResponse: r, errors: criticalsCorrection(verdict.criticals) }
        continue
      }
      const { design: next, repairs, warnings } = verdict.candidate
      const plan = layered(current, r.operations)
      if (verdict.kind === 'pending') return waitFor(round, verdict, { operations: r.operations, response: { ...r, decisions: updateDecisions(from.proposed, r.decisions) }, requirements, origin: response.origin, plan, suggestions })
      const settings = repairs.length ? [alsoRepaired(repairs)] : []
      const remaining = verdict.unresolved.length ? [stillPending(describeProblems(traceErrors(verdict.unresolved)))] : []
      const withChange = addVersion(base, next, { summary: r.summary, reason: request, operations: r.operations, origin: response.origin, ...plan })
      return reply([r.explanation, ...settings, ...remaining, ...warnings.map((a) => a.message)].join('\n\n'), { questions: r.questions, suggestions: suggestions, version: withChange.current }, withChange)
    }
    return reply(adjustFailed(lastError), { error: true, failure: 'rejection' })
  }

  async function adjust(state: DesignState, request: string, signal: AbortSignal, onProgress: OnProgress = () => {}, answering: string | null = null): Promise<DesignState> {
    const withRequest: DesignState = {
      ...state,
      chat: [...markAnswered(state.chat, answering), message('user', request)],
    }
    save(withRequest)
    const round = roundFor(withRequest, request, signal, onProgress)
    try {
      return locally(round, answering) ?? (await throughPlan(round)) ?? (await pieceByPiece(round))
    } catch (e) {
      if (signal.aborted) return round.reply(CANCELLED, { error: true, failure: 'cancelled' })
      return round.reply(e instanceof Error ? e.message : EXPERT_FAILED, { error: true, failure: 'connection' })
    }
  }

  return { adjust }
}
