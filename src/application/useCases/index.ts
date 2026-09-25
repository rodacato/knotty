import { analyze } from '../../domain/analysis'
import { DIMENSION_OF_AXIS, DIMENSION_LABEL, type Position, type Dimensions, type Design, type Axis } from '../../domain/design/schema'
import { normalize } from '../../domain/design/normalize'
import { completeJoints } from '../../domain/design/joints'
import { findingKey, type Finding } from '../../domain/structure/finding'
import { newCriticals } from '../../domain/structure/review'
import { abbreviate, updateDecisions, pruneVersions, type Decision, type Origin } from '../../domain/history/history'
import { materialById, type Catalog } from '../../domain/materials/catalog'
import { estimatePurchase } from '../../domain/materials/purchase'
import { cutList, type CutLine } from '../../domain/materials/cutList'
import { applyOperations } from '../../domain/operations/apply'
import type { Operation } from '../../domain/operations/schema'
import { updateRequirements, checkRequirements, type Requirement } from '../../domain/requirements/requirements'
import { currentDesign, markAnswered, questionAnswerKey, type PurchaseReview, type DesignState, type Message, type Thumbnail, type Question } from '../../domain/session/state'
import { describeChange, restorePieces } from '../../domain/changes/changes'
import { fixForAlternative, type Fix } from '../../domain/fixes/fixes'
import { buildPlan, describePlanChanges, FurniturePlan, MODULE_OF_KIND, moduleOf } from '../../domain/modules/plan'
import { rebuildFromPlan } from '../../domain/modules/rebuild'
import { repairDesign, type Repair } from '../../domain/repair/repair'
import { kindFromWords } from '../../domain/typology/typology'
import { angleLabel, mergeReadings, photoKey, type PhotoReading } from '../../domain/reading/reading'
import { appendTrace, describeProblems, errorKey, traceErrors, type TraceEntry } from '../../domain/trace/trace'
import type { DesignError } from '../../domain/validation/errors'
import { worst, reviewViability, type Check } from '../../domain/viability/viability'
import { toggleInTray, trayRequest, type TrayItem } from '../../domain/tray/tray'
import type { DesignRepository } from '../../ports/DesignRepository'
import { expertPlans, type Photo, type LLMProvider, type ExpertResponse, type AdjustmentResponse, type ReconstructionResponse } from '../../ports/LLMProvider'
import { buildContext, describeAlternatives } from '../context'
import { ExpertError, expertCall, traceEntry } from './expertCall'

export { ExpertError }
import { named } from '../named'

export type Stage = 'reading-photos' | 'designing' | 'designing-pieces' | 'proposing' | 'checking' | 'structure' | 'correcting'
export type OnProgress = (stage: Stage, attempt: number, progress?: { done: number; total: number }) => void

interface Dependencies {
  llm: () => LLMProvider
  catalog: Catalog
  repository: DesignRepository
  now?: () => string
  newId?: () => string
}

export const ATTEMPTS = 3
const MAX_THUMBNAILS = 8

/** A photo the person sends in the middle of the conversation, almost always because the expert asked for it. */
export interface SentPhoto {
  angle: string
  base64: string
  thumbnail: string
}
const listErrors = (errors: DesignError[]) => errors.map((e) => `- ${e.code}: ${e.message}${e.data ? ` ${JSON.stringify(e.data)}` : ''}`).join('\n')

/** What the person asked for at the start, as the first chat message. */
function initialRequest(input: { measures: Dimensions | null; photos: Photo[]; notes: string }) {
  const measures = input.measures ? `Mide ${input.measures.height} × ${input.measures.width} × ${input.measures.depth} mm (alto, ancho, fondo).` : 'No sé las medidas.'
  const photos = input.photos.length ? `Te mando ${input.photos.length === 1 ? 'una foto' : `${input.photos.length} fotos`} (${input.photos.map((f) => angleLabel(f.angle)).join(', ')}).` : ''
  const photoNotes = input.photos.filter((f) => f.note?.trim()).map((f) => `Sobre la foto ${angleLabel(f.angle)}: ${f.note!.trim()}`)
  return [input.notes.trim(), photos, ...photoNotes, measures].filter(Boolean).join('\n\n')
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

/** A short, stable fingerprint of a text (FNV-1a plus its length). */
function fingerprint(text: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0
  return `${hash.toString(16)}-${text.length}`
}

/**
 * What a purchase review was made with: if the design, the requirements or the cutting settings change, it has to be redone.
 * It keys on the design's content, not the version number, so going back to an identical version keeps the review.
 */
export const reviewSignature = (state: DesignState, effectiveCatalog: Catalog) =>
  JSON.stringify([fingerprint(JSON.stringify(currentDesign(state))), state.requirements.map((r) => r.id), state.accepted.map((a) => a.key), effectiveCatalog.layout, effectiveCatalog.materials.map((m) => [m.id, m.sheet])])

const CHECK_STATE = { ok: 'ok', warning: 'warning', fail: 'FAIL' }
function reviewText(cut: CutLine[], checks: Check[]) {
  return [
    '## Cut list (length × width × thickness, mm)',
    ...cut.map((r) => `- ${r.count} × ${r.name} (${r.material}): ${r.length} × ${r.width} × ${r.thickness}`),
    '',
    '## App checks',
    ...checks.map((c) => `- [${CHECK_STATE[c.status]}] ${c.title}: ${c.detail}`),
  ].join('\n')
}

/**
 * The plan behind the current design. `since` is the version it comes from; if later versions changed the design
 * freely, applying the plan again drops those changes.
 */
export function currentPlan(state: DesignState): { plan: FurniturePlan | null; extras: Operation[]; since: number | null; diverged: boolean } {
  const ordered = [...state.versions].sort((a, b) => b.n - a.n).filter((v) => v.n <= state.current)
  const source = ordered.find((v) => v.plan)
  return { plan: source?.plan ?? null, extras: source?.extras ?? [], since: source?.n ?? null, diverged: !!source && source.n !== state.current }
}

/** A free-form change on a design that has a plan keeps the plan and joins its extras. */
const layered = (current: ReturnType<typeof currentPlan>, operations: Operation[]) =>
  current.plan && !current.diverged ? { plan: current.plan, extras: [...current.extras, ...operations] } : { plan: null, extras: [] }

/** Pieces that hold the furniture up: the expert does not take them away unasked. */
const STRUCTURAL = new Set(['side', 'bottom', 'top', 'divider', 'back', 'kick', 'apron', 'brace'])
/** The request itself asks to take something away. */
const ASKS_REMOVAL = /\b(quit|elimin|sac|borr|remuev|remov|sin )/i

/** A cota tied to an outer face of the piece of furniture. */
const toOutside = (position: Position | null) => position?.type === 'ref' && position.ref.startsWith('furniture.')

export type PieceEdit = { kind: 'length'; axis: Axis; value: number } | { kind: 'thickness'; material: string } | { kind: 'move'; axis: Axis; delta: number }
export type PieceEditResult = { ok: true; state: DesignState } | { ok: false; message: string; alternatives: { label: string; axis: Axis; value: number }[] }

export function createUseCases(deps: Dependencies) {
  const { catalog, repository } = deps
  const now = deps.now ?? (() => new Date().toISOString())
  const newId = deps.newId ?? (() => crypto.randomUUID())

  const message = (author: Message['author'], text: string, extra: Partial<Message> = {}): Message => ({
    id: newId(),
    author,
    text: text,
    date: now(),
    questions: [],
    answered: false,
    version: null,
    proposal: null,
    error: false,
    requestedPhotos: [],
    thumbnail: null,
    answers: [],
    suggestions: [],
    solutions: [],
    ...extra,
  })

  const save = (state: DesignState) => {
    repository.save(state)
    return state
  }

  function addVersion(
    state: DesignState,
    design: Design,
    data: { summary: string; reason: string; operations: Operation[]; origin: Origin | null; plan?: FurniturePlan | null; extras?: Operation[] },
  ): DesignState {
    const n = Math.max(...state.versions.map((v) => v.n)) + 1
    const versions = pruneVersions([
      ...state.versions,
      { n, design: design, summary: data.summary, reason: data.reason, operations: data.operations.map(abbreviate), date: now(), origin: data.origin, decisions: state.decisions, plan: data.plan ?? null, extras: data.plan ? (data.extras ?? []) : [] },
    ])
    return { ...state, versions: versions, current: n, proposal: null, chat: state.chat.map((m) => (m.proposal === 'pending' ? { ...m, proposal: 'discarded' as const, answered: true } : m)) }
  }

  const findingsOf = (design: Design, requirements: Requirement[]): Finding[] => {
    const a = analyze(design, catalog, requirements)
    return a.valid ? a.findings : []
  }

  // Readings of this session's photos: a retry or a second design does not look at the same photo twice.
  const readings = new Map<string, PhotoReading>()

  /** Reads every photo at once; one that fails is retried alone. Null if none could be read. */
  async function readPhotos(photos: Photo[], context: string, signal: AbortSignal, onProgress: OnProgress, trace: TraceEntry[]) {
    if (!photos.length) return null
    const llm = deps.llm()
    let done = 0
    const advance = () => onProgress('reading-photos', 0, { done, total: photos.length })
    advance()
    const readOne = async (photo: Photo) => {
      const key = photoKey(photo.base64, photo.note ?? '')
      const subject = `Foto ${angleLabel(photo.angle)}`
      const cached = readings.get(key)
      for (let attempt = 0; !cached && attempt < 2; attempt++) {
        const call = await expertCall(() => llm.readPhoto({ photo: photo, context }, signal), { step: 'read', attempt, signal, trace, onFailure: 'skip', subject })
        if (!call.ok) continue
        trace.push(traceEntry('read', attempt, call.started, call.response, 'ok', [], [], subject))
        readings.set(key, call.response.value)
        break
      }
      done++
      advance()
      const reading = readings.get(key)
      return reading ? { angle: photo.angle, reading } : null
    }
    const read = await Promise.all(photos.map(readOne))
    return mergeReadings(read.filter((r): r is NonNullable<typeof r> => !!r))
  }

  /** The skeleton path: if the expert says it is a cabinet, Knotty builds it. Null means: design it whole. */
  async function designFromPlan(
    input: { measures: Dimensions | null; photos: Photo[]; thumbnails: Thumbnail[]; notes: string },
    photos: Photo[],
    reading: PhotoReading | null,
    signal: AbortSignal,
    onProgress: OnProgress,
    trace: TraceEntry[],
  ): Promise<DesignState | null> {
    const llm = deps.llm()
    // A kind with no module (a bench) goes straight to piece by piece: asking for a plan would be a wasted call.
    const hint = kindFromWords(`${input.notes} ${reading?.kind ?? ''}`)
    if (!llm.planDesign || (hint && !MODULE_OF_KIND[hint])) return null
    onProgress('designing', 0)
    const call = await expertCall(() => llm.planDesign!({ measures: input.measures, photos: photos, notes: input.notes, reading: reading, catalog: catalog, correction: null }, signal), {
      step: 'plan',
      attempt: 0,
      signal,
      trace,
      onFailure: 'skip',
      code: 'E_PLAN',
    })
    if (!call.ok) return null
    const { response: plan, started } = call
    const offered = Object.values(expertPlans(plan.value)).find((p) => p !== null)
    if (!offered) {
      trace.push(traceEntry('plan', 0, started, plan, 'ok', [], [], 'No tiene ficha: se diseña pieza por pieza'))
      return null
    }
    onProgress('checking', 0)
    const furniture = input.measures ? moduleOf(offered).withMeasures(offered, input.measures) : offered
    const { design: built, notes } = buildPlan(furniture, catalog)
    const { design, repairs } = repairDesign(built, catalog, plan.value.requirements)
    const analysis = analyze(design, catalog, plan.value.requirements)
    if (!analysis.valid) {
      trace.push(traceEntry('plan', 0, started, plan, 'invalid', traceErrors(analysis.errors), repairs))
      return null
    }
    trace.push(traceEntry('plan', 0, started, plan, 'ok', [], repairs, moduleOf(furniture).traceLabel(furniture)))
    onProgress('structure', 0)
    const { explanation, questions, requestedPhotos, requirements, suggestions } = plan.value
    const r: ReconstructionResponse = { explanation: [explanation, ...notes].join('\n\n'), design, questions, requestedPhotos, requirements, suggestions }
    return initialState(input, design, r, { ...plan, value: r }, [], repairs, trace, furniture)
  }

  async function reconstruct(
    input: { measures: Dimensions | null; photos: Photo[]; thumbnails: Thumbnail[]; notes: string },
    signal: AbortSignal,
    onProgress: OnProgress = () => {},
  ): Promise<DesignState> {
    const llm = deps.llm()
    let correction: { previousResponse: unknown; errors: DesignError[] } | null = null
    const trace: TraceEntry[] = []
    const reading = await readPhotos(input.photos, input.notes, signal, onProgress, trace)
    // With a reading the photos are not sent again; if none could be read, the design looks at them itself.
    const photosForDesign = reading ? [] : input.photos
    const fromPlan = await designFromPlan(input, photosForDesign, reading, signal, onProgress, trace)
    if (fromPlan) return save(fromPlan)
    // A design that resolves but did not pass validation: shown with its problems instead of thrown away.
    let lastCandidate: { design: Design; r: ReconstructionResponse; response: ExpertResponse<ReconstructionResponse>; errors: DesignError[]; repairs: Repair[] } | null = null
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      // Not a cabinet (or its plan failed): the expert writes every piece, which takes minutes, and the wait says so.
      onProgress(attempt ? 'correcting' : 'designing-pieces', attempt)
      const call = await expertCall(() => llm.reconstruct({ measures: input.measures, photos: photosForDesign, notes: input.notes, reading: reading, catalog: catalog, correction: correction }, signal), {
        step: 'reconstruct',
        attempt,
        signal,
        trace,
        onFailure: 'correct',
      })
      if (!call.ok) {
        const e = call.unreadable!
        correction = { previousResponse: e.response, errors: [{ code: 'E_SCHEMA', message: e.problems }] }
        continue
      }
      const { response, started } = call
      onProgress('checking', attempt)
      const r = response.value
      const proposed = completeJoints(normalize(input.measures ? { ...r.design, dimensions: input.measures } : r.design, catalog), catalog)
      // What has an obvious fix is fixed here; only the rest goes back to the model.
      const { design, repairs } = repairDesign(proposed, catalog, r.requirements)
      const analysis = analyze(design, catalog, r.requirements)
      if (!analysis.valid) {
        trace.push(traceEntry('reconstruct', attempt, started, response, 'invalid', traceErrors(analysis.errors), repairs))
        if (analysis.geo) lastCandidate = { design: design, r, response: response, errors: analysis.errors, repairs }
        correction = { previousResponse: r, errors: analysis.errors }
        continue
      }
      trace.push(traceEntry('reconstruct', attempt, started, response, 'ok', [], repairs))
      onProgress('structure', attempt)
      return save(initialState(input, design, r, response, [], repairs, trace))
    }
    if (lastCandidate) {
      const { design, r, response, errors, repairs } = lastCandidate
      return save(initialState(input, design, r, response, errors, repairs, trace))
    }
    const problems = describeProblems(trace.at(-1)?.errors ?? [])
    throw new ExpertError(
      `${input.photos.length ? 'No logré armar un modelo con estas fotos' : 'No logré armar un modelo con esa descripción'}${problems ? `: en ${ATTEMPTS} intentos quedaron ${problems}` : ''}. ${input.photos.length ? 'Prueba con otra toma de frente y una de 3/4 con buena luz.' : 'Prueba contando qué es, sus partes principales (repisas, puertas, cajones) y para qué lo vas a usar.'}`,
      trace,
    )
  }

  /** The first version of a design, from what the expert answered; `problems` are validation errors left unresolved. */
  function initialState(
    input: { measures: Dimensions | null; photos: Photo[]; thumbnails: Thumbnail[]; notes: string },
    design: Design,
    r: ReconstructionResponse,
    response: ExpertResponse<ReconstructionResponse>,
    problems: DesignError[],
    repairs: Repair[],
    trace: TraceEntry[],
    plan: FurniturePlan | null = null,
  ): DesignState {
    const { width, height, depth } = design.dimensions
    const fromPlan = plan && moduleOf(plan).measuresNote(plan, design.dimensions)
    const estimated = fromPlan
      ? [fromPlan]
      : input.measures
        ? []
        : [`Como no tenías las medidas, las estimé: ${height} × ${width} × ${depth} mm (alto, ancho, fondo). Dime las reales cuando las tengas y lo ajusto.`]
    const repaired = repairs.length ? [`Ajusté por mi cuenta ${repairs.length === 1 ? 'un detalle' : `${repairs.length} detalles`}: ${repairs.map((x) => x.message).join(' ')}`] : []
    const pendingItems = problems.length
      ? [`No logré que todo cerrara: quedaron ${describeProblems(traceErrors(problems))}. Te las marqué en el 3D y en los avisos; pídeme que las corrija y lo arreglo sin empezar de cero.`]
      : []
    return {
      format: 7,
      measures: design.dimensions,
      versions: [{ n: 1, design: design, summary: input.photos.length ? 'Reconstrucción desde fotos' : 'Diseño desde tu descripción', reason: input.notes || 'Fotos y medidas', operations: [], date: now(), origin: response.origin, decisions: [], plan, extras: [] }],
      current: 1,
      requirements: r.requirements,
      decisions: [],
      chat: [
        message('user', initialRequest(input), { thumbnail: input.thumbnails[0]?.dataUrl ?? null }),
        message('expert', [r.explanation, ...repaired, ...pendingItems, ...estimated, ...(response.warnings ?? [])].join('\n\n'), {
          questions: r.questions.slice(0, 3),
          requestedPhotos: r.requestedPhotos.slice(0, 2),
          suggestions: [...(problems.length ? ['Corrige las piezas marcadas'] : []), ...r.suggestions].slice(0, 4),
          version: 1,
        }),
      ],
      thumbnails: input.thumbnails,
      proposal: null,
      review: null,
      trace,
      accepted: [],
      tray: [],
    }
  }

  async function adjust(
    state: DesignState,
    request: string,
    signal: AbortSignal,
    onProgress: OnProgress = () => {},
    answering: string | null = null,
    photo: SentPhoto | null = null,
  ): Promise<DesignState> {
    const withRequest: DesignState = {
      ...state,
      thumbnails: photo ? [...state.thumbnails.filter((m) => m.angle !== photo.angle), { angle: photo.angle, dataUrl: photo.thumbnail }].slice(-MAX_THUMBNAILS) : state.thumbnails,
      chat: [...markAnswered(state.chat, answering), message('user', request, { thumbnail: photo?.thumbnail ?? null })],
    }
    save(withRequest)
    const llm = deps.llm()
    const design = currentDesign(withRequest)
    const before = findingsOf(design, withRequest.requirements)
    const currentPlanInfo = currentPlan(withRequest)
    // If the current design has unresolved problems, a change that fixes some and adds none is progress.
    const current = analyze(design, catalog, withRequest.requirements)
    const previousProblems = current.valid ? null : new Set(current.errors.map(errorKey))
    const context = buildContext(withRequest, catalog)
    const trace: TraceEntry[] = []
    const reply = (text: string, extra: Partial<Message> = {}, base: DesignState = withRequest) =>
      save({ ...base, trace: appendTrace(base.trace, trace), chat: [...base.chat, message('expert', text, extra)] })

    let correction: { previousResponse: unknown; errors: string } | null = null
    let criticalsReviewed = false
    let lastError = ''

    /** With a live plan the expert edits the plan; null means: go piece by piece. */
    const throughPlan = async (): Promise<DesignState | null> => {
      const plan = currentPlanInfo.plan
      if (!plan || currentPlanInfo.diverged || !llm.adjustPlan || photo) return null
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
      const rebuilt = rebuildFromPlan(next!, currentPlanInfo.extras, catalog, requirements)
      const analysis = analyze(rebuilt.design, catalog, requirements)
      if (!analysis.valid) {
        trace.push(traceEntry('adjust', 0, started, response, 'invalid', traceErrors(analysis.errors), rebuilt.repairs, 'Ficha'))
        return null
      }
      trace.push(traceEntry('adjust', 0, started, response, 'ok', [], rebuilt.repairs, 'Ficha'))
      onProgress('structure', 0)
      const extras = currentPlanInfo.extras.filter((e) => !rebuilt.dropped.includes(e))
      const criticals = newCriticals(before, analysis.findings)
      if (criticals.length) {
        const proposal = {
          design: rebuilt.design,
          operations: [],
          summary: r.summary,
          reason: request,
          critical: criticals.map((h) => ({ code: h.code, message: h.message, pieces: h.pieces })),
          requirements: requirements,
          decisions: r.decisions,
          origin: response.origin,
          plan: next!,
          extras,
          holds: [],
        }
        const pending = { ...base, requirements: withRequest.requirements, decisions: withRequest.decisions, proposal }
        return reply(r.explanation, { ...(r.questions.length ? { questions: r.questions } : questionFromAlternatives(criticals, rebuilt.design, catalog)), proposal: 'pending' }, pending)
      }
      const withChange = addVersion(base, rebuilt.design, { summary: r.summary, reason: request, operations: [], origin: response.origin, plan: next!, extras })
      return reply([r.explanation, ...rebuilt.notes].join('\n\n'), { questions: r.questions, suggestions: suggestions, version: withChange.current }, withChange)
    }

    try {
      const byPlan = await throughPlan()
      if (byPlan) return byPlan
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
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
          continue
        }
        const { response, started } = call
        const r = { ...response.value, explanation: [response.value.explanation, ...(response.warnings ?? [])].join('\n\n') }
        const requirements = updateRequirements(withRequest.requirements, r.requirements)
        const decisions = updateDecisions(withRequest.decisions, r.decisions)
        const base = { ...withRequest, requirements, decisions }
        const requestedPhotos = r.requestedPhotos.slice(0, 2)
        const suggestions = r.suggestions.slice(0, 4)
        if (!r.operations.length) {
          trace.push(traceEntry('adjust', attempt, started, response, 'ok', []))
          return reply(r.explanation, { questions: r.questions, requestedPhotos: requestedPhotos, suggestions: suggestions }, base)
        }

        onProgress('checking', attempt)
        const applied = applyOperations(design, r.operations, catalog)
        const appliedNormally = applied.ok ? completeJoints(normalize(applied.value.design, catalog), catalog, design) : null
        const repaired = appliedNormally ? repairDesign(appliedNormally, catalog, requirements) : null
        const next = repaired?.design ?? null
        const repairs = repaired?.repairs ?? []
        const analysis = next ? analyze(next, catalog, requirements) : null
        const noNewProblems = !!analysis && !analysis.valid && !!previousProblems && analysis.errors.every((e) => previousProblems.has(errorKey(e)))
        if (!applied.ok || !next || !analysis || (!analysis.valid && !noNewProblems)) {
          const errors = !applied.ok ? applied.errors : analysis && !analysis.valid ? analysis.errors : []
          trace.push(traceEntry('adjust', attempt, started, response, 'invalid', traceErrors(errors), repairs))
          correction = { previousResponse: r, errors: listErrors(errors) }
          lastError = errors[0]?.message ?? 'el cambio no se pudo aplicar'
          continue
        }
        trace.push(traceEntry('adjust', attempt, started, response, 'ok', analysis.valid ? [] : traceErrors(analysis.errors), repairs))
        const settings = repairs.length ? [`Además ajusté por mi cuenta: ${repairs.map((x) => x.message).join(' ')}`] : []
        const newFindings = analysis.valid ? analysis.findings : []
        const remaining = analysis.valid ? [] : [`Todavía quedan ${describeProblems(traceErrors(analysis.errors))}; pídeme que las corrija.`]

        onProgress('structure', attempt)
        // Nothing that holds the piece up goes away unasked, and changes wait for the answers to the expert's own questions.
        const unasked = describeChange(design, next, catalog).direct.filter((c) => c.kind === 'removed' && STRUCTURAL.has(design.pieces.find((p) => p.id === c.id)?.role ?? ''))
        const holds = [
          ...(unasked.length && !ASKS_REMOVAL.test(request) ? [`Quiere quitar ${unasked.map((c) => c.name).join(', ')}, que sostienen el mueble y no pediste quitar.`] : []),
          ...(r.questions.length ? ['Hizo preguntas: el cambio espera tus respuestas.'] : []),
        ]
        if (holds.length) {
          const proposal = {
            design: next,
            operations: r.operations,
            summary: r.summary,
            reason: request,
            critical: [],
            requirements: requirements,
            decisions: r.decisions,
            origin: response.origin,
            ...layered(currentPlanInfo, r.operations),
            holds,
          }
          const pending = { ...base, requirements: withRequest.requirements, decisions: withRequest.decisions, proposal }
          return reply(r.explanation, { questions: r.questions, proposal: 'pending', suggestions: suggestions }, pending)
        }
        const accepted = new Set(r.acceptedRisks.map((a) => a.code))
        const criticals = newCriticals(before, newFindings).filter((h) => !accepted.has(h.code))
        if (criticals.length && !criticalsReviewed && !r.questions.length) {
          criticalsReviewed = true
          attempt--
          correction = {
            previousResponse: r,
            errors: [
              'The change is valid but leaves these new critical structural problems:',
              ...criticals.map((h) => `- ${h.code} ${h.pieces.join(', ')}: ${h.message} Alternatives: ${describeAlternatives(h)}`),
              'If the fix is clear, include it in the operations. If there is a choice to make, keep the requested operations and offer the options in questions.',
            ].join('\n'),
          }
          continue
        }

        if (criticals.length) {
          const proposal = {
            design: next,
            operations: r.operations,
            summary: r.summary,
            reason: request,
            critical: criticals.map((h) => ({ code: h.code, message: h.message, pieces: h.pieces })),
            requirements: requirements,
            decisions: r.decisions,
            origin: response.origin,
            ...layered(currentPlanInfo, r.operations),
            holds: [],
          }
          const pending = { ...base, requirements: withRequest.requirements, decisions: withRequest.decisions, proposal }
          return reply(r.explanation, { ...(r.questions.length ? { questions: r.questions } : questionFromAlternatives(criticals, next, catalog)), proposal: 'pending' }, pending)
        }

        const withChange = addVersion(base, next, { summary: r.summary, reason: request, operations: r.operations, origin: response.origin, ...layered(currentPlanInfo, r.operations) })
        const warnings = applied.value.warnings.map((a) => a.message)
        return reply([r.explanation, ...settings, ...remaining, ...warnings].join('\n\n'), { questions: r.questions, requestedPhotos: requestedPhotos, suggestions: suggestions, version: withChange.current }, withChange)
      }
      const reason = lastError.trim().replace(/\.?$/, '.')
      return reply(`No logré hacer ese cambio sin romper el diseño, así que no apliqué nada. ${reason.charAt(0).toUpperCase()}${reason.slice(1)} ¿Lo intentamos de otra forma?`, { error: true })
    } catch (e) {
      if (signal.aborted) return reply('Cancelado.', { error: true })
      return reply(e instanceof Error ? e.message : 'Algo falló al consultar al experto.', { error: true })
    }
  }

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
    return save({ ...withFix, chat: [...withFix.chat, message('user', `Resolví: ${fix.label}.`, { version: withFix.current })] })
  }

  function discardProposal(state: DesignState): DesignState {
    return save({ ...state, proposal: null, chat: state.chat.map((m) => (m.proposal === 'pending' ? { ...m, proposal: 'discarded' as const, answered: true } : m)) })
  }

  function backToVersion(state: DesignState, n: number): DesignState {
    const target = state.versions.find((v) => v.n === n)
    if (!target || n === state.current) return state
    const withChange = addVersion({ ...state, decisions: target.decisions }, target.design, { summary: `Volver a v${n}`, reason: `Volver a v${n}: ${target.summary}`, operations: [], origin: null, plan: target.plan, extras: target.extras })
    return save({ ...withChange, chat: [...withChange.chat, message('expert', `Regresé al diseño de la v${n} (${target.summary}).`, { version: withChange.current })] })
  }

  /** The person confirms by hand a piece the expert left as a sketch. */
  function confirmPiece(state: DesignState, id: string): DesignState {
    const design = currentDesign(state)
    const piece = design.pieces.find((p) => p.id === id)
    if (!piece || piece.confidence === 'high') return state
    const operations: Operation[] = [{ op: 'changeProperties', id, name: null, role: null, grain: null, load: null, support: null, edges: null, confidence: 'high' }]
    const r = applyOperations(design, operations, catalog)
    if (!r.ok) return state
    const current = currentPlan(state)
    const withChange = addVersion(state, r.value.design, { summary: `Confirmar ${piece.name.toLowerCase()}`, reason: 'Confirmada a mano', operations: operations, origin: null, ...layered(current, operations) })
    return save({ ...withChange, chat: [...withChange.chat, message('expert', `Anoté ${piece.name.toLowerCase()} como confirmada.`, { version: withChange.current })] })
  }

  function addRequirement(state: DesignState, text: string): DesignState {
    const clean = text.trim()
    if (!clean) return state
    const id = `nota-${newId().slice(0, 8)}`
    return save({ ...state, requirements: [...state.requirements, { id, text: clean, type: 'other', axis: null, min: null, max: null }] })
  }

  const removeRequirement = (state: DesignState, id: string) => save({ ...state, requirements: state.requirements.filter((r) => r.id !== id) })
  const removeDecision = (state: DesignState, topic: string) => save({ ...state, decisions: state.decisions.filter((d) => d.topic !== topic) })

  /** Starts from a ready design (the examples), without spending a call to the model. */
  function fromExample(design: Design): DesignState {
    return save({
      format: 7,
      measures: design.dimensions,
      versions: [{ n: 1, design: design, summary: `Ejemplo: ${design.name}`, reason: 'Ejemplo', operations: [], date: now(), origin: null, decisions: [], plan: null, extras: [] }],
      current: 1,
      requirements: [],
      decisions: [],
      chat: [message('expert', `Aquí tienes un ${design.name.toLowerCase()} de ejemplo. ${design.notes} Pídeme cambios: el ancho, la carga, mover una repisa, reforzarlo…`, { version: 1 })],
      thumbnails: [],
      proposal: null,
      review: null,
      trace: [],
      accepted: [],
      tray: [],
    })
  }

  /** A change made on the plan itself: rebuilt at once, no expert involved. */
  function applyPlan(state: DesignState, plan: FurniturePlan): { ok: true; state: DesignState; notes: string[] } | { ok: false; message: string } {
    const parsed = FurniturePlan.safeParse(plan)
    if (!parsed.success) return { ok: false, message: 'Hay un valor que no tiene sentido en la ficha: revisa que las medidas y los altos sean mayores que cero.' }
    const current = currentPlan(state)
    const { design, notes, dropped } = rebuildFromPlan(parsed.data, current.diverged ? [] : current.extras, catalog, state.requirements)
    const analysis = analyze(design, catalog, state.requirements)
    if (!analysis.valid) {
      const first = named(design.pieces, analysis.errors[0]?.message ?? '')
      return { ok: false, message: `Así no se puede armar: quedarían ${describeProblems(traceErrors(analysis.errors))}. ${first}` }
    }
    const previous = current.plan
    const changes = previous ? describePlanChanges(previous, parsed.data) : []
    const summary = changes.length ? changes.join(', ') : 'sin cambios'
    const extras = (current.diverged ? [] : current.extras).filter((e) => !dropped.includes(e))
    const withVersion = addVersion(state, design, { summary: `Ficha: ${summary}`.slice(0, 90), reason: `Desde la ficha: ${summary}`, operations: [], origin: null, plan: parsed.data, extras })
    const chat = [...withVersion.chat, message('user', `Cambié desde la ficha: ${summary}.`, { version: withVersion.current })]
    return { ok: true, state: save({ ...withVersion, measures: design.dimensions, chat }), notes }
  }

  /** A hand edit on one piece, with no expert: the edit if it holds, or the ways it could. */
  function editPiece(state: DesignState, id: string, edit: PieceEdit): PieceEditResult {
    const design = currentDesign(state)
    const piece = design.pieces.find((p) => p.id === id)
    const analysis = analyze(design, catalog, state.requirements)
    const box = analysis.geo?.boxes.get(id)
    if (!piece || !box) return { ok: false, message: 'No encuentro esa pieza en el diseño.', alternatives: [] }
    const size = (axis: Axis) => box[`${axis}1`] - box[`${axis}0`]
    const operations: Operation[] =
      edit.kind === 'thickness'
        ? [{ op: 'changeMaterial', ids: [id], material: edit.material }]
        : edit.kind === 'move'
          ? [{ op: 'move', id, axis: edit.axis, at: { type: 'mm', mm: box[`${edit.axis}0`] + edit.delta } }]
          : [
              // The end tied to the outside of the piece stays; the other one moves.
              toOutside(piece[edit.axis].to) && !toOutside(piece[edit.axis].from)
                ? { op: 'resize', id, axis: edit.axis, end: 'from', at: { type: 'mm', mm: box[`${edit.axis}1`] - edit.value } }
                : { op: 'resize', id, axis: edit.axis, end: 'to', at: { type: 'mm', mm: box[`${edit.axis}0`] + edit.value } },
            ]
    const summary =
      edit.kind === 'thickness'
        ? `${piece.name} de ${materialById(catalog, edit.material)?.thickness ?? '?'} mm`
        : edit.kind === 'move'
          ? `Mover ${piece.name.toLowerCase()} ${Math.abs(edit.delta)} mm`
          : `${piece.name} de ${Math.round(size(edit.axis))} a ${Math.round(edit.value)} mm`
    const applied = applyOperations(design, operations, catalog)
    const candidate = applied.ok ? completeJoints(normalize(applied.value.design, catalog), catalog, design) : null
    const after = candidate ? analyze(candidate, catalog, state.requirements) : null
    // An edit may leave the problems a design already had, but it must not add new ones.
    const before = new Set(analysis.valid ? [] : analysis.errors.map(errorKey))
    const holds = !!after && (after.valid || after.errors.every((e) => before.has(errorKey(e))))
    if (candidate && holds) {
      const current = currentPlan(state)
      const withVersion = addVersion(state, candidate, { summary: summary.slice(0, 90), reason: `A mano: ${summary}`, operations: operations, origin: null, ...layered(current, operations) })
      return { ok: true, state: save({ ...withVersion, chat: [...withVersion.chat, message('user', `Cambié a mano: ${summary}.`, { version: withVersion.current })] }) }
    }
    const reason = !applied.ok ? applied.errors[0]?.message : after && !after.valid ? after.errors.find((e) => !before.has(errorKey(e)))?.message : undefined
    // Tied to the outside of the piece: what can change is the whole piece of furniture.
    const alternatives: { label: string; axis: Axis; value: number }[] =
      edit.kind === 'length'
        ? [{ label: `Cambiar el ${DIMENSION_LABEL[DIMENSION_OF_AXIS[edit.axis]]} del mueble en ${edit.value - Math.round(size(edit.axis)) > 0 ? '+' : ''}${Math.round(edit.value - size(edit.axis))} mm`, axis: edit.axis, value: Math.round(design.dimensions[DIMENSION_OF_AXIS[edit.axis]] + edit.value - size(edit.axis)) }]
        : []
    return { ok: false, message: `Así no queda: ${(named(design.pieces, reason) || 'la pieza está amarrada a otras').replace(/\.$/, '')}.`, alternatives }
  }

  /** The whole piece of furniture grows or shrinks along one axis; through the plan when there is one. */
  function resizeFurniture(state: DesignState, axis: Axis, value: number): PieceEditResult {
    const current = currentPlan(state)
    if (current.plan && !current.diverged) {
      const plan = current.plan
      const resized = moduleOf(plan).resize(plan, axis, value)
      if (!resized.ok) return { ok: false, message: resized.message, alternatives: [] }
      const r = applyPlan(state, resized.plan)
      return r.ok ? { ok: true, state: r.state } : { ok: false, message: r.message, alternatives: [] }
    }
    const operations: Operation[] = [{ op: 'resizeFurniture', axis: axis, value: value, rule: 'stretch' }]
    const design = currentDesign(state)
    const applied = applyOperations(design, operations, catalog)
    const candidate = applied.ok ? completeJoints(normalize(applied.value.design, catalog), catalog, design) : null
    const after = candidate && analyze(candidate, catalog, state.requirements)
    if (!candidate || !after?.valid) return { ok: false, message: 'Tampoco se puede cambiar la medida del mueble así.', alternatives: [] }
    const dimension = DIMENSION_OF_AXIS[axis]
    const summary = `${dimension.charAt(0).toUpperCase()}${dimension.slice(1)} del mueble a ${value} mm`
    const withVersion = addVersion(state, candidate, { summary: summary, reason: `A mano: ${summary}`, operations: operations, origin: null })
    return { ok: true, state: save({ ...withVersion, measures: candidate.dimensions, chat: [...withVersion.chat, message('user', `Cambié a mano: ${summary}.`, { version: withVersion.current })] }) }
  }

  /** The version a given one was made from: the one just before it in the timeline. */
  const previousOf = (state: DesignState, n: number) => {
    const ordered = [...state.versions].sort((a, b) => a.n - b.n)
    const i = ordered.findIndex((v) => v.n === n)
    return i > 0 ? ordered[i - 1] : null
  }

  /** Brings pieces back to how they were before version `n`, keeping everything that came after. */
  function restoreFromVersion(state: DesignState, n: number, ids: string[]): { ok: true; state: DesignState } | { ok: false; message: string } {
    const before = previousOf(state, n)
    if (!before || !ids.length) return { ok: false, message: 'No hay una versión anterior de dónde regresar.' }
    const current = currentDesign(state)
    const r = restorePieces(current, before.design, ids, catalog)
    const pieces = current.pieces.concat(before.design.pieces)
    if (!r.ok) return { ok: false, message: `No se puede regresar así: ${named(pieces, r.errors[0]?.message) || 'choca con lo que cambió después'}` }
    const previousErrors = analyze(current, catalog, state.requirements)
    const known = new Set(previousErrors.valid ? [] : previousErrors.errors.map(errorKey))
    const after = analyze(r.design, catalog, state.requirements)
    if (!after.valid && !after.errors.every((e) => known.has(errorKey(e)))) return { ok: false, message: `No se puede regresar así: ${named(pieces, after.errors.find((e) => !known.has(errorKey(e)))?.message)}` }
    const names = ids.map((id) => before.design.pieces.find((p) => p.id === id)?.name ?? current.pieces.find((p) => p.id === id)?.name ?? id)
    const summary = `Regresar ${names.join(', ')}`
    const operations: Operation[] = ids.flatMap((id): Operation[] => {
      const was = before.design.pieces.find((p) => p.id === id)
      const now = current.pieces.some((p) => p.id === id)
      if (!was) return [{ op: 'removePiece', id }]
      return [...(now ? [{ op: 'removePiece' as const, id }] : []), { op: 'addPiece' as const, piece: was }]
    })
    const withVersion = addVersion(state, r.design, { summary: summary.slice(0, 90), reason: `${summary} como ${names.length === 1 ? 'estaba' : 'estaban'} antes de la v${n}`, operations: operations, origin: null, ...layered(currentPlan(state), operations) })
    return { ok: true, state: save({ ...withVersion, chat: [...withVersion.chat, message('user', `Regresé ${names.join(', ')} como ${names.length === 1 ? 'estaba' : 'estaban'} antes de la v${n}.`, { version: withVersion.current })] }) }
  }

  /** Undoes one change: the last one exactly; an older one by bringing back what it touched. */
  function undoChange(state: DesignState, n: number): { ok: true; state: DesignState } | { ok: false; message: string } {
    const before = previousOf(state, n)
    if (!before) return { ok: false, message: 'Es la primera versión: no hay nada antes.' }
    if (n === state.current) return { ok: true, state: backToVersion(state, before.n) }
    const version = state.versions.find((v) => v.n === n)!
    const ids = describeChange(before.design, version.design, catalog).direct.map((c) => c.id)
    return restoreFromVersion(state, n, ids)
  }

  /** The person leaves a finding as it is: it stops counting as pending and the verdict mentions it. */
  function acceptNotice(state: DesignState, findings: Finding[], title: string): DesignState {
    const keys = new Set(state.accepted.map((a) => a.key))
    const added = findings.map(findingKey).filter((k) => !keys.has(k)).map((key) => ({ key, title, at: now() }))
    return save({ ...state, accepted: [...state.accepted, ...added] })
  }

  function reopenNotice(state: DesignState, findings: Finding[]): DesignState {
    const keys = new Set(findings.map(findingKey))
    return save({ ...state, accepted: state.accepted.filter((a) => !keys.has(a.key)) })
  }

  /** A solution Knotty built: applied as one version, with no expert. */
  function applyFix(state: DesignState, fix: Fix): DesignState {
    const withVersion = addVersion(state, fix.design, { summary: fix.label.slice(0, 90), reason: `Solución: ${fix.label}`, operations: fix.operations, origin: null, ...layered(currentPlan(state), fix.operations) })
    return save({ ...withVersion, chat: [...withVersion.chat, message('user', `Resolví: ${fix.label}.`, { version: withVersion.current })] })
  }

  function toggleTray(state: DesignState, item: TrayItem): DesignState {
    return save({ ...state, tray: toggleInTray(state.tray, item) })
  }

  /** Everything in the tray, plus what was typed, in one request; its questions are marked answered. */
  function sendTray(state: DesignState, typed: string, signal: AbortSignal, onProgress?: OnProgress): Promise<DesignState> {
    const { text, answers } = trayRequest(state.tray, typed)
    return adjust({ ...state, tray: [] }, text, signal, onProgress, answers)
  }

  /** A session made elsewhere (a bench run) becomes the one the person works on. */
  function adopt(state: DesignState): DesignState {
    return save(state)
  }

  function newDesign() {
    repository.clear()
  }

  /** The arithmetic first, then the carpenter; if it does not answer, the review stands on the arithmetic alone. */
  async function reviewPurchase(state: DesignState, effectiveCatalog: Catalog, signal: AbortSignal): Promise<PurchaseReview> {
    const design = currentDesign(state)
    const analysis = analyze(design, catalog)
    if (!analysis.valid) throw new ExpertError(`El diseño tiene errores y no se puede revisar la compra: ${analysis.errors[0].message}`)
    const purchase = estimatePurchase(design, analysis.geo, effectiveCatalog)
    const unmet = checkRequirements(design, state.requirements).map((e) => e.message)
    const accepted = new Map(state.accepted.map((a) => [a.key, a.title]))
    const viability = reviewViability({
      design: design,
      geo: analysis.geo,
      catalog: effectiveCatalog,
      purchase: purchase,
      findings: analysis.findings.filter((h) => !accepted.has(findingKey(h))),
      unmet: unmet,
      accepted: analysis.findings.flatMap((h) => accepted.get(findingKey(h)) ?? []),
    })
    const base = { signature: reviewSignature(state, effectiveCatalog), checks: viability.checks, date: now() }
    try {
      const r = await deps.llm().reviewPurchase(
        {
          context: buildContext(state, catalog),
          review: reviewText(cutList(design, analysis.geo), viability.checks),
          design: design,
          checks: viability.checks,
          catalog: effectiveCatalog,
        },
        signal,
      )
      return { ...base, verdict: worst(viability.verdict, r.value.verdict), carpenter: { ...r.value, origin: r.origin }, error: null }
    } catch (e) {
      if (signal.aborted) throw e
      return { ...base, verdict: viability.verdict, carpenter: null, error: e instanceof Error ? e.message : 'El carpintero no contestó.' }
    }
  }

  /** Saved over the current state: the design may have changed while the carpenter was reviewing. */
  const saveReview = (state: DesignState, review: PurchaseReview) => save({ ...state, review: review })

  const load = () => repository.load()

  const pendingQuestions = (state: DesignState): Question[] => state.chat.filter((m) => !m.answered).flatMap((m) => m.questions)

  return {
    reconstruct,
    adjust,
    applyProposal,
    answerWithFix,
    discardProposal,
    backToVersion,
    confirmPiece,
    addRequirement,
    removeRequirement,
    removeDecision,
    fromExample,
    newDesign,
    reviewPurchase,
    saveReview,
    applyPlan,
    restoreFromVersion,
    undoChange,
    acceptNotice,
    reopenNotice,
    applyFix,
    toggleTray,
    adopt,
    sendTray,
    editPiece,
    resizeFurniture,
    load,
    pendingQuestions,
  }
}

export type UseCases = ReturnType<typeof createUseCases>
export type { AdjustmentResponse as RespuestaAjuste }
