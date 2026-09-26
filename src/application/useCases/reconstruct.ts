import { analyze } from '../../domain/checks/analysis'
import type { Design, Dimensions } from '../../domain/design/schema'
import { normalize } from '../../domain/design/normalize'
import { completeJoints } from '../../domain/design/joints'
import { exampleDesign, type Example } from '../../domain/furniture/examples'
import { buildPlan, MODULE_OF_KIND, moduleOf, type FurniturePlan } from '../../domain/furniture/modules/plan'
import { angleLabel, mergeReadings, photoKey, type PhotoReading } from '../../domain/furniture/reading/reading'
import { repairDesign, type Repair } from '../../domain/editing/repair/repair'
import type { DesignState, Thumbnail } from '../../domain/session/state'
import { describeProblems, traceErrors, type TraceEntry } from '../../domain/session/trace/trace'
import { kindFromWords } from '../../domain/checks/typology/typology'
import type { DesignError } from '../../domain/design/validation/errors'
import { expertPlans, type ExpertResponse, type Photo, type ReconstructionResponse } from '../../ports/LLMProvider'
import { estimatedMeasures, initialRequest, leftUnresolved, reconstructFailed, repairedOnMyOwn } from './copy'
import { ExpertError, expertCall, traceEntry } from './expertCall'
import { ATTEMPTS, type Kit, type OnProgress } from './kit'

type Input = { measures: Dimensions | null; photos: Photo[]; thumbnails: Thumbnail[]; notes: string }

/** Starting a design: from photos and a description through the expert, or from a ready example. */
export function createReconstruct(kit: Kit) {
  const { catalog, now, message, save } = kit

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

  /** The skeleton path: if the expert says it is a cabinet, Knotty builds it. Null means: design it whole. */
  async function designFromPlan(input: Input, photos: Photo[], reading: PhotoReading | null, signal: AbortSignal, onProgress: OnProgress, trace: TraceEntry[]): Promise<DesignState | null> {
    const llm = kit.llm()
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

  async function reconstruct(input: Input, signal: AbortSignal, onProgress: OnProgress = () => {}): Promise<DesignState> {
    const llm = kit.llm()
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
    throw new ExpertError(reconstructFailed(input.photos.length > 0, describeProblems(trace.at(-1)?.errors ?? []), ATTEMPTS), trace)
  }

  /** The first version of a design, from what the expert answered; `problems` are validation errors left unresolved. */
  function initialState(
    input: Input,
    design: Design,
    r: ReconstructionResponse,
    response: ExpertResponse<ReconstructionResponse>,
    problems: DesignError[],
    repairs: Repair[],
    trace: TraceEntry[],
    plan: FurniturePlan | null = null,
  ): DesignState {
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
      versions: [{ n: 1, design: design, summary: `Ejemplo: ${design.name}`, reason: 'Ejemplo', operations: [], date: now(), origin: null, decisions: [], plan, extras: [] }],
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

  return { reconstruct, fromExample, openExample }
}
