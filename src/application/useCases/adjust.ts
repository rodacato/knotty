import { analyze } from '../../domain/analysis'
import type { Design } from '../../domain/design/schema'
import { fixForAlternative } from '../../domain/fixes/fixes'
import { updateDecisions, type Decision, type Origin } from '../../domain/history/history'
import type { Catalog } from '../../domain/materials/catalog'
import type { FurniturePlan } from '../../domain/modules/plan'
import { rebuildFromPlan } from '../../domain/modules/rebuild'
import type { Operation } from '../../domain/operations/schema'
import { updateRequirements, type Requirement } from '../../domain/requirements/requirements'
import { currentDesign, markAnswered, type DesignState, type Message } from '../../domain/session/state'
import type { Finding } from '../../domain/structure/finding'
import { newCriticals } from '../../domain/structure/review'
import { appendTrace, describeProblems, traceErrors, type TraceEntry } from '../../domain/trace/trace'
import { expertPlans } from '../../ports/LLMProvider'
import { buildContext } from '../context'
import { knownErrors, tryCandidate, type Candidate } from './candidate'
import { adjustFailed, alsoRepaired, CANCELLED, EXPERT_FAILED, stillPending } from './copy'
import { currentPlan, layered } from './currentPlan'
import { expertCall, traceEntry } from './expertCall'
import { criticalsCorrection, listErrors } from './forExpert'
import { judge } from './judge'
import { ATTEMPTS, type Kit, type OnProgress } from './kit'

const MAX_THUMBNAILS = 8

/** A photo the person sends in the middle of the conversation, almost always because the expert asked for it. */
export interface SentPhoto {
  angle: string
  base64: string
  thumbnail: string
}

type Proposal = NonNullable<DesignState['proposal']>

/** What the expert proposed, kept aside until the person decides; its requirements and decisions apply only with it. */
function proposalFrom(p: {
  design: Design
  operations: Operation[]
  response: { summary: string; decisions: Decision[] }
  request: string
  critical: Finding[]
  requirements: Requirement[]
  origin: Origin
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
      context: buildContext(withRequest, catalog),
      trace,
      reply: (text: string, extra: Partial<Message> = {}, base: DesignState = withRequest) =>
        save({ ...base, trace: appendTrace(base.trace, trace), chat: [...base.chat, message('expert', text, extra)] }),
    }
  }
  type Round = ReturnType<typeof roundFor>

  /** With a live plan the expert edits the plan; null means: go piece by piece. */
  async function throughPlan({ withRequest, request, signal, onProgress, photo, llm, before, plan: current, context, trace, reply }: Round): Promise<DesignState | null> {
    const plan = current.plan
    if (!plan || current.diverged || !llm.adjustPlan || photo) return null
    onProgress('proposing', 0)
    const call = await expertCall(() => llm.adjustPlan!({ context: context, request: request, plan, catalog: catalog }, signal), {
      step: 'adjust',
      attempt: 0,
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
    const next = expertPlans(r)[plan.kind]
    if (r.action === 'freeform' || (r.action === 'plan' && !next)) {
      trace.push(traceEntry('adjust', 0, started, response, 'ok', [], [], 'Ficha: no cabe, va pieza por pieza'))
      return null
    }
    if (r.action === 'answer') {
      trace.push(traceEntry('adjust', 0, started, response, 'ok', [], [], 'Ficha: respuesta'))
      return reply(r.explanation, { questions: r.questions, suggestions: suggestions }, base)
    }
    onProgress('checking', 0)
    const rebuilt = rebuildFromPlan(next!, current.extras, catalog, requirements)
    const analysis = analyze(rebuilt.design, catalog, requirements)
    if (!analysis.valid) {
      trace.push(traceEntry('adjust', 0, started, response, 'invalid', traceErrors(analysis.errors), rebuilt.repairs, 'Ficha'))
      return null
    }
    trace.push(traceEntry('adjust', 0, started, response, 'ok', [], rebuilt.repairs, 'Ficha'))
    onProgress('structure', 0)
    const extras = current.extras.filter((e) => !rebuilt.dropped.includes(e))
    const criticals = newCriticals(before, analysis.findings)
    if (criticals.length) {
      const proposal = proposalFrom({ design: rebuilt.design, operations: [], response: r, request, critical: criticals, requirements, origin: response.origin, plan: { plan: next!, extras }, holds: [] })
      return reply(r.explanation, { ...askAboutCriticals(r.questions, criticals, rebuilt.design, catalog), proposal: 'pending' }, { ...withRequest, proposal })
    }
    const withChange = addVersion(base, rebuilt.design, { summary: r.summary, reason: request, operations: [], origin: response.origin, plan: next!, extras })
    return reply([r.explanation, ...rebuilt.notes].join('\n\n'), { questions: r.questions, suggestions: suggestions, version: withChange.current }, withChange)
  }

  /** The expert writes operations on the pieces; each answer is tried and judged, and a broken one goes back with its errors. */
  async function pieceByPiece({ withRequest, request, signal, onProgress, photo, llm, design, before, plan: current, known, context, trace, reply }: Round): Promise<DesignState> {
    let correction: { previousResponse: unknown; errors: string } | null = null
    let lastError = ''
    // A valid change with new critical findings earns the expert one extra round that does not spend an attempt.
    let criticalsReviewed = false
    let attempt = 0
    while (attempt < ATTEMPTS) {
      onProgress(attempt ? 'correcting' : 'proposing', attempt)
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

      const verdict = judge({ design, before, candidate, response: r, request, catalog, criticalsReviewed })
      if (verdict.kind === 'answer') return reply(r.explanation, { questions: r.questions, requestedPhotos: requestedPhotos, suggestions: suggestions }, base)
      if (verdict.kind === 'retry' && verdict.reason === 'invalid') {
        correction = { previousResponse: r, errors: listErrors(verdict.errors) }
        lastError = verdict.errors[0]?.message ?? 'el cambio no se pudo aplicar'
        attempt++
        continue
      }
      if (verdict.kind === 'retry') {
        criticalsReviewed = true
        correction = { previousResponse: r, errors: criticalsCorrection(verdict.criticals) }
        continue
      }
      const { design: next, repairs, warnings } = verdict.candidate
      const plan = layered(current, r.operations)
      if (verdict.kind === 'pending') {
        const proposal = proposalFrom({ design: next, operations: r.operations, response: r, request, critical: verdict.critical, requirements, origin: response.origin, plan, holds: verdict.holds })
        const ask = verdict.holds.length ? { questions: r.questions, suggestions: suggestions } : askAboutCriticals(r.questions, verdict.critical, next, catalog)
        return reply(r.explanation, { ...ask, proposal: 'pending' }, { ...withRequest, proposal })
      }
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
      return (await throughPlan(round)) ?? (await pieceByPiece(round))
    } catch (e) {
      if (signal.aborted) return round.reply(CANCELLED, { error: true })
      return round.reply(e instanceof Error ? e.message : EXPERT_FAILED, { error: true })
    }
  }

  return { adjust }
}
