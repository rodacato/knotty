import { analyze } from '../../domain/checks/analysis'
import type { Design, Dimensions } from '../../domain/design/schema'
import { normalize } from '../../domain/design/normalize'
import { completeJoints } from '../../domain/design/joints'
import { exampleDesign, type Example } from '../../domain/furniture/examples'
import { buildPlan, MODULE_OF_KIND, moduleOf, type FurniturePlan } from '../../domain/furniture/modules/plan'
import { mergeReadings, photoKey, viewLabel, type PhotoReading } from '../../domain/furniture/reading/reading'
import { spaceOverflow } from '../../domain/furniture/quick'
import { repairDesign, type Repair } from '../../domain/editing/repair/repair'
import { currentDesign, type DesignState, type Thumbnail } from '../../domain/session/state'
import { appendTrace, describeProblems, traceErrors, type TraceEntry } from '../../domain/session/trace/trace'
import { kindFromWords } from '../../domain/checks/typology/typology'
import { askedParts, describeMismatch, partsError, partsMismatch, type PartsMismatch } from '../../domain/editing/intent/counts'
import { KIND_NOUN, type DesignKind } from '../../domain/design/kind'
import { knownKind, planForKind, startingKind, withKind } from '../../domain/furniture/kind'
import { isPersonNote } from '../../domain/checks/requirements/requirements'
import { error, type DesignError } from '../../domain/design/validation/errors'
import { knowledgeForNew } from '../knowledge'
import { expertPlans, type ExpertResponse, type Photo, type ReconstructionRequest, type ReconstructionResponse } from '../../ports/LLMProvider'
import { CANCELLED, EXPERT_FAILED, doesNotFitSpace, estimatedMeasures, initialRequest, partsStillOff, leftUnresolved, reconstructFailed, redoRequest, redone, repairedOnMyOwn } from './copy'
import { ExpertError, expertCall, traceEntry } from './expertCall'
import { ATTEMPTS, type Kit, type OnProgress } from './kit'

/** `kind`: what the person said the furniture is, if they chose it. */
type Input = { measures: Dimensions | null; space?: Partial<Dimensions> | null; photos: Photo[]; thumbnails: Thumbnail[]; notes: string; kind?: DesignKind | null }

/** A design the expert made, before it becomes a session or a version. `problems`: validation errors left unresolved. */
type Designed = { design: Design; r: ReconstructionResponse; response: ExpertResponse<ReconstructionResponse>; problems: DesignError[]; repairs: Repair[]; plan: FurniturePlan | null }

/** Starting a design: from photos and a description through the expert, or from a ready example. */
export function createReconstruct(kit: Kit) {
  const { catalog, promptCatalog, now, message, save, addVersion } = kit

  // Readings by photo and note: Capture reads a photo when it is added, and designing reuses that read, even one still in flight.
  const readings = new Map<string, Promise<{ reading: PhotoReading | null; trace: TraceEntry[] }>>()

  /** Reads one photo once; a failed or cancelled read is tried again the next time it is asked for. */
  function readPhoto(photo: Photo, context: string, signal: AbortSignal) {
    const key = photoKey(photo.base64, photo.note ?? '')
    const known = readings.get(key)
    if (known) return known
    const read = (async () => {
      const llm = kit.llm()
      const trace: TraceEntry[] = []
      for (let attempt = 0; attempt < 2; attempt++) {
        const call = await expertCall(() => llm.readPhoto({ photo, context, knowledge: knowledgeForNew(null, kit.toolLevel(), 'photo') }, signal), { step: 'read', attempt, signal, trace, onFailure: 'skip', subject: 'Foto' })
        if (!call.ok) continue
        trace.push(traceEntry('read', attempt, call.started, call.response, 'ok', [], [], `Foto: ${viewLabel(call.response.value.view)}`))
        return { reading: call.response.value, trace }
      }
      readings.delete(key)
      return { reading: null, trace }
    })().catch((e: unknown) => {
      readings.delete(key)
      throw e
    })
    readings.set(key, read)
    return read
  }

  /** Reads every photo at once and merges them; the view the person chose wins over the model's. Null if none could be read. */
  async function readPhotos(photos: Photo[], context: string, signal: AbortSignal, onProgress: OnProgress, trace: TraceEntry[]) {
    if (!photos.length) return null
    let done = 0
    const advance = () => onProgress('reading-photos', 0, { done, total: photos.length })
    advance()
    const read = await Promise.all(
      photos.map(async (photo) => {
        const { reading, trace: calls } = await readPhoto(photo, context, signal)
        // The first design that uses a read reports its calls; a retry does not report them again.
        trace.push(...calls.splice(0))
        done++
        advance()
        return reading && photo.view ? { ...reading, view: photo.view } : reading
      }),
    )
    return mergeReadings(read.filter((r): r is PhotoReading => !!r))
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
    const asked = askedParts(input.notes)

    /** One skeleton call built and checked; `off` is what differs from the doors and drawers the request asked for. */
    let calls = 0
    const skeleton = (correction: ReconstructionRequest['correction']) =>
      expertCall(() => llm.planDesign!({ measures: input.measures, space: input.space, photos: photos, notes: input.notes, reading: reading, catalog: promptCatalog(), correction, kind: input.kind ?? null, routeKind: hint, knowledge: knowledgeForNew(hint, kit.toolLevel(), 'skeleton') }, signal), {
        step: 'plan',
        attempt: calls++,
        signal,
        trace,
        onFailure: 'skip',
        code: 'E_PLAN',
      })

    /** A skeleton call tried once more if the provider failed or answered something unreadable: giving up on the plan means minutes of piece by piece. */
    async function ask(correction: ReconstructionRequest['correction']) {
      const first = await skeleton(correction)
      if (first.ok) return first
      onProgress('correcting', calls)
      return skeleton(first.unreadable ? { previousResponse: first.unreadable.response, errors: [error('E_SCHEMA', first.unreadable.problems)] } : correction)
    }

    async function attempt(n: number, correction: ReconstructionRequest['correction']) {
      onProgress(n ? 'correcting' : 'designing', n)
      const call = await ask(correction)
      if (!call.ok) return null
      const answered = calls - 1
      const { response: plan, started } = call
      // The person said what it is: only that module's plan counts.
      const chosen = input.kind ? MODULE_OF_KIND[input.kind] : null
      const plans = expertPlans(plan.value)
      const found = chosen ? plans[chosen] : Object.values(plans).find((p) => p !== null)
      if (!found) {
        trace.push(traceEntry('plan', answered, started, plan, 'ok', [], [], chosen && Object.values(plans).some((p) => p !== null) ? 'La ficha no es del tipo que elegiste: se diseña pieza por pieza' : 'No tiene ficha: se diseña pieza por pieza'))
        return null
      }
      onProgress('checking', n)
      const offered = input.kind ? planForKind(found, input.kind) : found
      const furniture = input.measures ? moduleOf(offered).withMeasures(offered, input.measures) : offered
      const { design: built, notes } = buildPlan(furniture, catalog)
      const { design, repairs } = repairDesign(built, catalog, plan.value.requirements)
      const analysis = analyze(design, catalog, plan.value.requirements)
      if (!analysis.valid) {
        trace.push(traceEntry('plan', answered, started, plan, 'invalid', traceErrors(analysis.errors), repairs))
        return null
      }
      // Only a cabinet: its grid is where a count gets misread (two door openings of two leaves are four doors).
      const off = furniture.kind === 'cabinet' ? partsMismatch(asked, design) : []
      trace.push(traceEntry('plan', answered, started, plan, off.length ? 'invalid' : 'ok', off.length ? traceErrors([partsError(off)]) : [], repairs, moduleOf(furniture).traceLabel(furniture)))
      const { explanation, questions, requirements, suggestions } = plan.value
      const r: ReconstructionResponse = { explanation: [explanation, ...notes].join('\n\n'), design, questions, requirements, suggestions }
      const designed: Designed = { design: kinded(input, reading, design), r, response: { ...plan, value: r }, problems: [], repairs, plan: furniture }
      return { designed, off, answer: plan.value }
    }

    const first = await attempt(0, null)
    if (!first) return null
    // One round with the exact difference; then the closer of the two, and the person is told what still differs.
    const second = first.off.length ? await attempt(1, { previousResponse: first.answer, errors: [partsError(first.off)] }) : null
    const missed = (off: PartsMismatch) => off.reduce((n, m) => n + Math.abs(m.asked - m.found), 0)
    const best = second && missed(second.off) < missed(first.off) ? second : first
    onProgress('structure', 0)
    if (!best.off.length) return best.designed
    const r = { ...best.designed.r, explanation: [best.designed.r.explanation, partsStillOff(describeMismatch(best.off))].join('\n\n') }
    return { ...best.designed, r, response: { ...best.designed.response, value: r } }
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
      const call = await expertCall(() => llm.reconstruct({ measures: input.measures, space: input.space, photos: photosForDesign, notes: input.notes, reading: reading, catalog: promptCatalog(), correction: correction, kind: input.kind ?? null, knowledge: knowledgeForNew(input.kind ?? null, kit.toolLevel(), 'reconstruct') }, signal), {
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
      return save({ ...asked, trace: appendTrace(state.trace, e instanceof ExpertError ? e.trace : trace), chat: [...asked.chat, message('expert', text, { error: true, failure: signal.aborted ? 'cancelled' : 'connection' })] })
    }
  }

  /** The first version of a design, from what the expert answered; `problems` are validation errors left unresolved. */
  function initialState(input: Input, { design, r, response, problems, repairs, plan }: Designed, trace: TraceEntry[]): DesignState {
    const fromPlan = plan && moduleOf(plan).measuresNote(plan, design.dimensions)
    const estimated = fromPlan ? [fromPlan] : input.measures ? [] : [estimatedMeasures(design.dimensions)]
    const overSpace = input.space ? spaceOverflow(design.dimensions, input.space) : []
    const spaceNote = overSpace.length ? [doesNotFitSpace(overSpace)] : []
    const repaired = repairs.length ? [repairedOnMyOwn(repairs)] : []
    const pendingItems = problems.length ? [leftUnresolved(describeProblems(traceErrors(problems)))] : []
    return {
      format: 9,
      measures: design.dimensions,
      versions: [{ n: 1, design: design, summary: input.photos.length ? 'Reconstrucción desde fotos' : 'Diseño desde tu descripción', reason: input.notes || 'Fotos y medidas', operations: [], date: now(), origin: response.origin, decisions: [], plan, extras: [] }],
      current: 1,
      requirements: r.requirements,
      decisions: [],
      chat: [
        message('user', initialRequest(input), { thumbnail: input.thumbnails[0]?.dataUrl ?? null }),
        message('expert', [r.explanation, ...repaired, ...pendingItems, ...estimated, ...spaceNote, ...(response.warnings ?? [])].join('\n\n'), {
          questions: r.questions.slice(0, 3),
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
      locks: {},
      ficha: null,
    }
  }

  /** Starts from a ready design (the examples), without spending a call to the model; with its plan, the plan sheet and the local requests work from the first version. */
  function fromExample(design: Design, plan: FurniturePlan | null = null, ficha: DesignState['ficha'] = null): DesignState {
    return save({
      format: 9,
      measures: design.dimensions,
      versions: [{ n: 1, design: design.kind ? { ...design, kindSource: 'example' } : design, summary: `${plan ? 'Base' : 'Ejemplo'}: ${design.name}`, reason: 'Ejemplo', operations: [], date: now(), origin: null, decisions: [], plan, extras: [] }],
      current: 1,
      requirements: [],
      decisions: [],
      chat: [message('expert', plan ? `Aquí tienes una base de ${design.name.toLowerCase()}. ${design.notes} Cambia sus medidas y opciones con «Editar», arriba del mueble, o pídeme cambios: la carga, reforzarlo, otro acabado…` : `Aquí tienes un ${design.name.toLowerCase()} de ejemplo. ${design.notes} Pídeme cambios: el ancho, la carga, mover una repisa, reforzarlo…`, { version: 1 })],
      thumbnails: [],
      proposal: null,
      review: null,
      trace: [],
      accepted: [],
      tray: [],
      locks: {},
      ficha,
    })
  }

  /** One of the home screen's examples: a plan example is built here, with the session's catalog. */
  function openExample(example: Example): DesignState {
    const { design, plan } = exampleDesign(example, catalog)
    return fromExample(design, plan, 'plan' in example && example.code && example.version ? { code: example.code, version: example.version } : null)
  }

  /** Capture reads each photo as it is added; nothing cancels it, because designing may be waiting on the same read. */
  const readOnAdd = async (photo: Photo, context: string) => (await readPhoto(photo, context, new AbortController().signal)).reading

  return { reconstruct, redoAs, fromExample, openExample, readPhoto: readOnAdd }
}
