import { byPerson, keepPersonKind } from '../../domain/furniture/kind'
import { analyze } from '../../domain/checks/analysis'
import type { Design } from '../../domain/design/schema'
import { fixForAlternative } from '../../domain/editing/fixes/fixes'
import { updateDecisions, type Decision, type Origin } from '../../domain/session/history/history'
import type { Catalog } from '../../domain/materials/catalog'
import { answerQuestion } from '../../domain/editing/intent/answers'
import { parseIntent } from '../../domain/editing/intent/intent'
import { describePlanChanges, type FurniturePlan } from '../../domain/furniture/modules/plan'
import { rebuildFromPlan } from '../../domain/furniture/modules/rebuild'
import type { Operation } from '../../domain/editing/operations/schema'
import type { Repair } from '../../domain/editing/repair/repair'
import { updateRequirements, type Requirement } from '../../domain/checks/requirements/requirements'
import { currentDesign, markAnswered, type DesignState, type Message } from '../../domain/session/state'
import type { Finding } from '../../domain/checks/structure/finding'
import { appendTrace, BY_KNOTTY, describeProblems, traceErrors, type TraceEntry } from '../../domain/session/trace/trace'
import { expertPlans, type PlanAdjustRequest } from '../../ports/LLMProvider'
import { buildContext, buildPlanContext } from '../context'
import { knownErrors, tryCandidate, type Accepted, type Candidate } from './candidate'
import { adjustFailed, alsoRepaired, CANCELLED, EXPERT_FAILED, localText, stillPending } from './copy'
import { currentPlan, layered } from './currentPlan'
import { expertCall, traceEntry } from './expertCall'
import { criticalsCorrection, listErrors, planCorrection } from './forExpert'
import { judge, type Verdict } from './judge'
import { ATTEMPTS, type Kit, type OnProgress, type Stage } from './kit'

const MAX_THUMBNAILS = 8
// The plan's answer and one correction with its errors; after that the request goes piece by piece.
const PLAN_ATTEMPTS = 2

/** Computed the first time it is asked for, and kept. */
function lazy<T>(make: () => T): () => T {
  let value: { v: T } | null = null
  return () => (value ??= { v: make() }).v
}

/** A photo the person sends in the middle of the conversation, almost always because the expert asked for it. */
export interface SentPhoto {
  angle: string
  base64: string
  thumbnail: string
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
  const { catalog, message, save, addVersion, findingsOf } = kit

  /** Everything one request works with. */
  function roundFor(withRequest: DesignState, request: string, signal: AbortSignal, onProgress: OnProgress, photo: SentPhoto | null) {
    const design = currentDesign(withRequest)
    const trace: TraceEntry[] = []
    return {
      withRequest,
      request,
      signal,
      onProgress,
      photo,
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
    const { withRequest, request, photo, design, before, plan: current, trace, reply } = round
    const live = current.plan && !current.diverged ? current.plan : null
    const intent = photo ? null : parseIntent(request, live, design)
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
    if (intent.plan === live) {
      note('ok')
      return reply(localText.already)
    }
    const rebuilt = rebuildFromPlan(intent.plan, current.extras, catalog, withRequest.requirements)
    rebuilt.design = byPerson(design, rebuilt.design)
    const analysis = analyze(rebuilt.design, catalog, withRequest.requirements)
    note(analysis.valid ? 'ok' : 'invalid', analysis.valid ? [] : traceErrors(analysis.errors), rebuilt.repairs)
    if (!analysis.valid) return null
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
      return waitFor(round, verdict, { operations: [], response: { explanation, summary, decisions: [], questions: [] }, requirements: withRequest.requirements, origin: null, plan, suggestions: [] })
    }
    if (verdict.kind !== 'applied') return null
    const withChange = addVersion(withRequest, rebuilt.design, { summary, reason: request, operations: [], origin: null, ...plan })
    return reply([localText.applied(said), ...rebuilt.notes].join('\n\n'), { version: withChange.current }, withChange)
  }

  /**
   * With a live plan the expert edits the plan, judged like any change but with no extra round for criticals.
   * A plan that does not build goes back once with its errors; null means: go piece by piece.
   */
  async function throughPlan(round: Round): Promise<DesignState | null> {
    const { withRequest, request, signal, onProgress, photo, llm, design, before, plan: current, trace, reply } = round
    const plan = current.plan
    if (!plan || current.diverged || !llm.adjustPlan || photo) return null
    const context = buildPlanContext(withRequest, catalog, current.extras)
    let correction: PlanAdjustRequest['correction'] = null
    for (let attempt = 0; attempt < PLAN_ATTEMPTS; attempt++) {
      onProgress(correction ? 'correcting' : 'proposing', attempt)
      const call = await expertCall(() => llm.adjustPlan!({ context, request, plan, catalog, correction }, signal), {
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
      const r = response.value
      const requirements = updateRequirements(withRequest.requirements, r.requirements)
      const base = { ...withRequest, requirements, decisions: updateDecisions(withRequest.decisions, r.decisions) }
      const suggestions = r.suggestions.slice(0, 4)
      const offered = expertPlans(r)[plan.kind]
      const next = offered && keepPersonKind(offered, design)
      if (r.action === 'freeform' || (r.action === 'plan' && !next)) {
        trace.push(traceEntry('adjust', attempt, started, response, 'ok', [], [], 'Ficha: no cabe, va pieza por pieza'))
        return null
      }
      if (r.action === 'answer') {
        trace.push(traceEntry('adjust', attempt, started, response, 'ok', [], [], 'Ficha: respuesta'))
        return reply(r.explanation, { questions: r.questions, suggestions: suggestions }, base)
      }
      onProgress('checking', attempt)
      const rebuilt = rebuildFromPlan(next!, current.extras, catalog, requirements)
      const analysis = analyze(rebuilt.design, catalog, requirements)
      if (!analysis.valid) {
        trace.push(traceEntry('adjust', attempt, started, response, 'invalid', traceErrors(analysis.errors), rebuilt.repairs, 'Ficha'))
        correction = { previousResponse: r, errors: planCorrection(analysis.errors) }
        continue
      }
      trace.push(traceEntry('adjust', attempt, started, response, 'ok', [], rebuilt.repairs, 'Ficha'))
      onProgress('structure', attempt)
      const extras = current.extras.filter((e) => !rebuilt.dropped.includes(e))
      const candidate: Accepted = { ok: true, design: rebuilt.design, analysis, repairs: rebuilt.repairs, warnings: [] }
      // The plan carries no accepted risks: a critical the person already accepted is in `before`, and is not new.
      const verdict = judge({ design, before, candidate, response: { questions: r.questions, acceptedRisks: [] }, request, catalog, extraRound: false, criticalsReviewed: false })
      if (verdict.kind === 'pending') return waitFor(round, verdict, { operations: [], response: r, requirements, origin: response.origin, plan: { plan: next!, extras }, suggestions })
      // A valid candidate with no extra round is either pending or applied.
      if (verdict.kind !== 'applied') return null
      const withChange = addVersion(base, rebuilt.design, { summary: r.summary, reason: request, operations: [], origin: response.origin, plan: next!, extras })
      return reply([r.explanation, ...rebuilt.notes].join('\n\n'), { questions: r.questions, suggestions: suggestions, version: withChange.current }, withChange)
    }
    return null
  }

  /** The expert writes operations on the pieces; each answer is tried and judged, and a broken one goes back with its errors. */
  async function pieceByPiece(round: Round): Promise<DesignState> {
    const { withRequest, request, signal, onProgress, photo, llm, design, before, plan: current, known, trace, reply } = round
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
            { context: context, request: request, design: design, proposal: withRequest.proposal?.operations ?? null, photos: photo ? [{ angle: photo.angle, base64: photo.base64 }] : [], catalog: catalog, correction: correction },
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
      const requirements = updateRequirements(withRequest.requirements, r.requirements)
      const base = { ...withRequest, requirements, decisions: updateDecisions(withRequest.decisions, r.decisions) }
      const requestedPhotos = r.requestedPhotos.slice(0, 2)
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

      const verdict = judge({ design, before, candidate, response: r, request, catalog, extraRound: true, criticalsReviewed })
      if (verdict.kind === 'answer') return reply(r.explanation, { questions: r.questions, requestedPhotos: requestedPhotos, suggestions: suggestions }, base)
      if (verdict.kind === 'retry' && verdict.reason === 'invalid') {
        correction = { previousResponse: r, errors: listErrors(verdict.errors) }
        lastError = verdict.errors[0]?.message ?? 'el cambio no se pudo aplicar'
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
      if (verdict.kind === 'pending') return waitFor(round, verdict, { operations: r.operations, response: r, requirements, origin: response.origin, plan, suggestions })
      const settings = repairs.length ? [alsoRepaired(repairs)] : []
      const remaining = verdict.unresolved.length ? [stillPending(describeProblems(traceErrors(verdict.unresolved)))] : []
      const withChange = addVersion(base, next, { summary: r.summary, reason: request, operations: r.operations, origin: response.origin, ...plan })
      return reply([r.explanation, ...settings, ...remaining, ...warnings.map((a) => a.message)].join('\n\n'), { questions: r.questions, requestedPhotos: requestedPhotos, suggestions: suggestions, version: withChange.current }, withChange)
    }
    return reply(adjustFailed(lastError), { error: true })
  }

  async function adjust(state: DesignState, request: string, signal: AbortSignal, onProgress: OnProgress = () => {}, answering: string | null = null, photo: SentPhoto | null = null): Promise<DesignState> {
    const withRequest: DesignState = {
      ...state,
      thumbnails: photo ? [...state.thumbnails.filter((m) => m.angle !== photo.angle), { angle: photo.angle, dataUrl: photo.thumbnail }].slice(-MAX_THUMBNAILS) : state.thumbnails,
      chat: [...markAnswered(state.chat, answering), message('user', request, { thumbnail: photo?.thumbnail ?? null })],
    }
    save(withRequest)
    const round = roundFor(withRequest, request, signal, onProgress, photo)
    try {
      return locally(round, answering) ?? (await throughPlan(round)) ?? (await pieceByPiece(round))
    } catch (e) {
      if (signal.aborted) return round.reply(CANCELLED, { error: true })
      return round.reply(e instanceof Error ? e.message : EXPERT_FAILED, { error: true })
    }
  }

  return { adjust }
}
