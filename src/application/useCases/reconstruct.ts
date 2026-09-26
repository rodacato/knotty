import { analyze } from '../../domain/checks/analysis'
import type { Design, Dimensions } from '../../domain/design/schema'
import { normalize } from '../../domain/design/normalize'
import { completeJoints } from '../../domain/design/joints'
import { exampleDesign, type Example } from '../../domain/furniture/examples'
import { buildPlan, MODULE_OF_KIND, moduleOf, type FurniturePlan } from '../../domain/furniture/modules/plan'
import { angleLabel, mergeReadings, photoKey, type PhotoReading } from '../../domain/furniture/reading/reading'
import { repairDesign, type Repair } from '../../domain/editing/repair/repair'
import { currentDesign, type DesignState, type Thumbnail } from '../../domain/session/state'
import { appendTrace, describeProblems, traceErrors, type TraceEntry } from '../../domain/session/trace/trace'
import { kindFromWords } from '../../domain/checks/typology/typology'
import { KIND_NOUN, type DesignKind } from '../../domain/design/kind'
import { knownKind, planForKind, startingKind, withKind } from '../../domain/furniture/kind'
import { isPersonNote } from '../../domain/checks/requirements/requirements'
import type { DesignError } from '../../domain/design/validation/errors'
import { expertPlans, type ExpertResponse, type Photo, type ReconstructionResponse } from '../../ports/LLMProvider'
import { CANCELLED, EXPERT_FAILED, estimatedMeasures, initialRequest, leftUnresolved, reconstructFailed, redoRequest, redone, repairedOnMyOwn } from './copy'
import { ExpertError, expertCall, traceEntry } from './expertCall'
import { ATTEMPTS, type Kit, type OnProgress } from './kit'

/** `kind`: what the person said the furniture is, if they chose it. */
type Input = { measures: Dimensions | null; photos: Photo[]; thumbnails: Thumbnail[]; notes: string; kind?: DesignKind | null }

/** A design the expert made, before it becomes a session or a version. `problems`: validation errors left unresolved. */
type Designed = { design: Design; r: ReconstructionResponse; response: ExpertResponse<ReconstructionResponse>; problems: DesignError[]; repairs: Repair[]; plan: FurniturePlan | null }

/** Starting a design: from photos and a description through the expert, or from a ready example. */
export function createReconstruct(kit: Kit) {
  const { catalog, now, message, save, addVersion } = kit

  // Readings of this session's photos: a retry or a second design does not look at the same photo twice.
  const readings = new Map<string, PhotoReading>()

  /** Reads every photo at once; one that fails is retried alone. Null if none could be read. */
  async function readPhotos(photos: Photo[], context: string, signal: AbortSignal, onProgress: OnProgress, trace: TraceEntry[]) {
    if (!photos.length) return null
    const llm = kit.llm()
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

  /** What the new design is: the person's choice, else what the plan, the photos or the words say. */
  const kinded = (input: Input, reading: PhotoReading | null, design: Design) =>
    withKind(design, startingKind({ person: input.kind ?? null, built: knownKind(design), photo: reading?.kind ?? null, words: input.notes }))

  /** The skeleton path: if the expert says it is a cabinet, Knotty builds it. Null means: design it whole. */
  async function designFromPlan(input: Input, photos: Photo[], reading: PhotoReading | null, signal: AbortSignal, onProgress: OnProgress, trace: TraceEntry[]): Promise<Designed | null> {
    const llm = kit.llm()
    // A kind with no module (a bench) goes straight to piece by piece: asking for a plan would be a wasted call.
    const hint = input.kind ?? kindFromWords(reading?.kind ?? '') ?? kindFromWords(input.notes)
    if (!llm.planDesign || (hint && !MODULE_OF_KIND[hint])) return null
    onProgress('designing', 0)
    const call = await expertCall(() => llm.planDesign!({ measures: input.measures, photos: photos, notes: input.notes, reading: reading, catalog: catalog, correction: null, kind: input.kind ?? null }, signal), {
      step: 'plan',
      attempt: 0,
      signal,
      trace,
      onFailure: 'skip',
      code: 'E_PLAN',
    })
    if (!call.ok) return null
    const { response: plan, started } = call
    // The person said what it is: only that module's plan counts.
    const chosen = input.kind ? MODULE_OF_KIND[input.kind] : null
    const plans = expertPlans(plan.value)
    const found = chosen ? plans[chosen] : Object.values(plans).find((p) => p !== null)
    if (!found) {
      trace.push(traceEntry('plan', 0, started, plan, 'ok', [], [], chosen && Object.values(plans).some((p) => p !== null) ? 'La ficha no es del tipo que elegiste: se diseña pieza por pieza' : 'No tiene ficha: se diseña pieza por pieza'))
      return null
    }
    onProgress('checking', 0)
    const offered = input.kind ? planForKind(found, input.kind) : found
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
    return { design: kinded(input, reading, design), r, response: { ...plan, value: r }, problems: [], repairs, plan: furniture }
  }

  /** The skeleton first, and piece by piece if it has no plan; throws when not even a design with problems came out. */
  async function designIt(input: Input, signal: AbortSignal, onProgress: OnProgress, trace: TraceEntry[]): Promise<Designed> {
    const llm = kit.llm()
    let correction: { previousResponse: unknown; errors: DesignError[] } | null = null
    const reading = await readPhotos(input.photos, input.notes, signal, onProgress, trace)
    // With a reading the photos are not sent again; if none could be read, the design looks at them itself.
    const photosForDesign = reading ? [] : input.photos
    const fromPlan = await designFromPlan(input, photosForDesign, reading, signal, onProgress, trace)
    if (fromPlan) return fromPlan
    // A design that resolves but did not pass validation: shown with its problems instead of thrown away.
    let lastCandidate: Designed | null = null
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      // Not a cabinet (or its plan failed): the expert writes every piece, which takes minutes, and the wait says so.
      onProgress(attempt ? 'correcting' : 'designing-pieces', attempt)
      const call = await expertCall(() => llm.reconstruct({ measures: input.measures, photos: photosForDesign, notes: input.notes, reading: reading, catalog: catalog, correction: correction, kind: input.kind ?? null }, signal), {
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
        if (analysis.geo) lastCandidate = { design: kinded(input, reading, design), r, response, problems: analysis.errors, repairs, plan: null }
        correction = { previousResponse: r, errors: analysis.errors }
        continue
      }
      trace.push(traceEntry('reconstruct', attempt, started, response, 'ok', [], repairs))
      onProgress('structure', attempt)
      return { design: kinded(input, reading, design), r, response, problems: [], repairs, plan: null }
    }
    if (lastCandidate) return lastCandidate
    throw new ExpertError(reconstructFailed(input.photos.length > 0, describeProblems(trace.at(-1)?.errors ?? []), ATTEMPTS), trace)
  }

  async function reconstruct(input: Input, signal: AbortSignal, onProgress: OnProgress = () => {}): Promise<DesignState> {
    const trace: TraceEntry[] = []
    return save(initialState(input, await designIt(input, signal, onProgress, trace), trace))
  }

  /**
   * The furniture becomes another module's (a bookcase into a bed): its plan cannot be converted, so it is designed again from the first request, as a new version.
   * The old measures go only as a reference; the requirements the expert wrote go, the person's notes stay.
   */
  async function redoAs(state: DesignState, kind: DesignKind, signal: AbortSignal, onProgress: OnProgress = () => {}): Promise<DesignState> {
    const before = currentDesign(state)
    const first = state.chat.find((m) => m.author === 'user')?.text ?? before.name
    const asked: DesignState = { ...state, chat: [...state.chat, message('user', `Rehazlo como ${KIND_NOUN[kind]}.`)] }
    save(asked)
    const trace: TraceEntry[] = []
    const input: Input = { measures: null, photos: [], thumbnails: [], notes: redoRequest(first, before, kind), kind }
    try {
      const d = await designIt(input, signal, onProgress, trace)
      const withVersion = addVersion(asked, d.design, { summary: `Rehecho como ${KIND_NOUN[kind]}`, reason: `Rehazlo como ${KIND_NOUN[kind]}`, operations: [], origin: d.response.origin, plan: d.plan, extras: [] })
      const problems = d.problems.length ? [leftUnresolved(describeProblems(traceErrors(d.problems)))] : []
      return save({
        ...withVersion,
        measures: d.design.dimensions,
        requirements: [...state.requirements.filter(isPersonNote), ...d.r.requirements],
        trace: appendTrace(state.trace, trace),
        chat: [
          ...withVersion.chat,
          message('expert', [redone(KIND_NOUN[kind]), d.r.explanation, ...problems].join('\n\n'), { questions: d.r.questions.slice(0, 3), suggestions: d.r.suggestions.slice(0, 4), version: withVersion.current }),
        ],
      })
    } catch (e) {
      const text = signal.aborted ? CANCELLED : e instanceof Error ? e.message : EXPERT_FAILED
      return save({ ...asked, trace: appendTrace(state.trace, e instanceof ExpertError ? e.trace : trace), chat: [...asked.chat, message('expert', text, { error: true })] })
    }
  }

  /** The first version of a design, from what the expert answered; `problems` are validation errors left unresolved. */
  function initialState(input: Input, { design, r, response, problems, repairs, plan }: Designed, trace: TraceEntry[]): DesignState {
    const fromPlan = plan && moduleOf(plan).measuresNote(plan, design.dimensions)
    const estimated = fromPlan ? [fromPlan] : input.measures ? [] : [estimatedMeasures(design.dimensions)]
    const repaired = repairs.length ? [repairedOnMyOwn(repairs)] : []
    const pendingItems = problems.length ? [leftUnresolved(describeProblems(traceErrors(problems)))] : []
    return {
      format: 8,
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

  /** Starts from a ready design (the examples), without spending a call to the model; with its plan, the plan sheet and the local requests work from the first version. */
  function fromExample(design: Design, plan: FurniturePlan | null = null): DesignState {
    return save({
      format: 8,
      measures: design.dimensions,
      versions: [{ n: 1, design: design.kind ? { ...design, kindSource: 'example' } : design, summary: `Ejemplo: ${design.name}`, reason: 'Ejemplo', operations: [], date: now(), origin: null, decisions: [], plan, extras: [] }],
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

  /** One of the home screen's examples: a plan example is built here, with the session's catalog. */
  function openExample(example: Example): DesignState {
    const { design, plan } = exampleDesign(example, catalog)
    return fromExample(design, plan)
  }

  return { reconstruct, redoAs, fromExample, openExample }
}
