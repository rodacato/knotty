import { analyze } from '../domain/analysis'
import { DIMENSION_OF_AXIS, type Position, type Dimensions, type Design, type Axis } from '../domain/diseno/schema'
import { normalize } from '../domain/diseno/normalize'
import { completeJoints } from '../domain/diseno/joints'
import { findingKey, type Finding } from '../domain/structure/finding'
import { newCriticals } from '../domain/structure/review'
import { abbreviate, updateDecisions, pruneVersions, type Decision, type Origin } from '../domain/historial/history'
import { materialById, type Catalog } from '../domain/materiales/catalog'
import { estimatePurchase } from '../domain/materiales/purchase'
import { cutList, type CutLine } from '../domain/materiales/cutList'
import { applyOperations } from '../domain/operaciones/apply'
import type { Operation } from '../domain/operaciones/schema'
import { updateRequirements, checkRequirements, type Requirement } from '../domain/requisitos/requirements'
import { currentDesign, markAnswered, type PurchaseReview, type DesignState, type Message, type Thumbnail, type Question } from '../domain/sesion/state'
import { describeChange, restorePieces } from '../domain/changes/changes'
import type { Fix } from '../domain/fixes/fixes'
import { buildPlan, FurniturePlan, isBed, isTable } from '../domain/modules/plan'
import { rebuildFromPlan } from '../domain/modules/rebuild'
import { describePlanChanges } from '../domain/modules/planChanges'
import { repairDesign, type Repair } from '../domain/repair/repair'
import { detectKind } from '../domain/typology/typology'
import { mergeReadings, photoKey, type PhotoReading } from '../domain/reading/reading'
import { appendTrace, describeProblems, errorKey, traceErrors, type TraceEntry } from '../domain/trace/trace'
import type { DesignError } from '../domain/validation/errors'
import { worst, reviewViability, type Check } from '../domain/viabilidad/viability'
import { toggleInTray, trayRequest, type TrayItem } from '../domain/tray/tray'
import type { DesignRepository } from '../ports/DesignRepository'
import { RespuestaInvalida, type Foto, type LLMProvider, type PlanAdjustment, type Respuesta, type RespuestaAjuste, type RespuestaPlan, type RespuestaReconstruccion } from '../ports/LLMProvider'
import { construirContexto } from './contexto'

export type Etapa = 'leyendo-fotos' | 'mirando-fotos' | 'disenando-piezas' | 'proponiendo' | 'revisando' | 'estructura' | 'corrigiendo'
export type AlAvanzar = (etapa: Etapa, intento: number, progress?: { done: number; total: number }) => void

export interface Dependencias {
  llm: () => LLMProvider
  catalogo: Catalog
  repositorio: DesignRepository
  ahora?: () => string
  nuevoId?: () => string
}

export const INTENTOS = 3
const MAX_MINIATURAS = 8

/** Una foto que la persona manda en medio de la conversación, casi siempre porque el experto la pidió. */
export interface FotoEnviada {
  angulo: string
  base64: string
  miniatura: string
}
const listarErrores = (errores: DesignError[]) => errores.map((e) => `- ${e.code}: ${e.message}${e.data ? ` ${JSON.stringify(e.data)}` : ''}`).join('\n')

/** Lo que la persona pidió al empezar, como primer mensaje del chat. */
function pedidoInicial(entrada: { medidas: Dimensions | null; fotos: Foto[]; notas: string }) {
  const medidas = entrada.medidas ? `Mide ${entrada.medidas.alto} × ${entrada.medidas.ancho} × ${entrada.medidas.fondo} mm (alto, ancho, fondo).` : 'No sé las medidas.'
  const fotos = entrada.fotos.length ? `Te mando ${entrada.fotos.length === 1 ? 'una foto' : `${entrada.fotos.length} fotos`} (${entrada.fotos.map((f) => f.angulo).join(', ')}).` : ''
  const notasDeFotos = entrada.fotos.filter((f) => f.note?.trim()).map((f) => `Sobre la foto ${f.angulo}: ${f.note!.trim()}`)
  return [entrada.notas.trim(), fotos, ...notasDeFotos, medidas].filter(Boolean).join('\n\n')
}

/** Si el experto no ofreció opciones ante un crítico, se ofrecen las alternativas que calculó el motor. */
function preguntaDeAlternativas(criticos: Finding[]): Question[] {
  const opciones = [...new Set(criticos.flatMap((h) => h.alternatives.filter((a) => a.key !== 'claro-maximo').map((a) => a.description)))].slice(0, 3)
  return opciones.length ? [{ texto: '¿Cómo lo resolvemos?', opciones }] : []
}

/** Con qué se hizo un dictamen: si cambia la versión, los requisitos o los ajustes de corte, hay que repetirlo. */
export const firmaDictamen = (estado: DesignState, catalogoEfectivo: Catalog) =>
  JSON.stringify([estado.actual, estado.requisitos.map((r) => r.id), estado.accepted.map((a) => a.key), catalogoEfectivo.acomodo, catalogoEfectivo.materiales.map((m) => [m.id, m.hoja])])

const ESTADO_COMPROBACION = { ok: 'bien', aviso: 'aviso', falla: 'FALLA' }
function textoRevision(corte: CutLine[], comprobaciones: Check[]) {
  return [
    '## Lista de corte (largo × ancho × espesor, mm)',
    ...corte.map((r) => `- ${r.count} × ${r.name} (${r.material}): ${r.length} × ${r.width} × ${r.thickness}`),
    '',
    '## Comprobaciones de la app',
    ...comprobaciones.map((c) => `- [${ESTADO_COMPROBACION[c.estado]}] ${c.titulo}: ${c.detalle}`),
  ].join('\n')
}

/**
 * The plan behind the current design. `since` is the version it comes from; if later versions changed the design
 * freely, applying the plan again drops those changes.
 */
export function currentPlan(estado: DesignState): { plan: FurniturePlan | null; extras: Operation[]; since: number | null; diverged: boolean } {
  const ordered = [...estado.versiones].sort((a, b) => b.n - a.n).filter((v) => v.n <= estado.actual)
  const source = ordered.find((v) => v.plan)
  return { plan: source?.plan ?? null, extras: source?.extras ?? [], since: source?.n ?? null, diverged: !!source && source.n !== estado.actual }
}

/** A free-form change on a design that has a plan keeps the plan and joins its extras. */
const layered = (vigente: ReturnType<typeof currentPlan>, operaciones: Operation[]) =>
  vigente.plan && !vigente.diverged ? { plan: vigente.plan, extras: [...vigente.extras, ...operaciones] } : { plan: null, extras: [] }

/** Pieces that hold the furniture up: the expert does not take them away unasked. */
const STRUCTURAL = new Set(['lateral', 'piso', 'techo', 'divisor', 'trasera', 'zoclo', 'faja', 'refuerzo'])
/** The request itself asks to take something away. */
const ASKS_REMOVAL = /\b(quit|elimin|sac|borr|remuev|remov|sin )/i

/** A cota tied to an outer face of the piece of furniture. */
const toOutside = (cota: Position | null) => cota?.tipo === 'ref' && cota.ref.startsWith('mueble.')

export type PieceEdit = { kind: 'length'; axis: Axis; value: number } | { kind: 'thickness'; material: string } | { kind: 'move'; axis: Axis; delta: number }
export type PieceEditResult = { ok: true; estado: DesignState } | { ok: false; message: string; alternatives: { label: string; axis: Axis; value: number }[] }

/** El experto no logró algo y lo dice; el mensaje es para el usuario. */
export class ErrorExperto extends Error {
  constructor(
    message: string,
    readonly trace: TraceEntry[] = [],
  ) {
    super(message)
  }
}

const traceEntry = (
  step: TraceEntry['step'],
  attempt: number,
  started: number,
  respuesta: Respuesta<unknown> | null,
  outcome: TraceEntry['outcome'],
  errors: TraceEntry['errors'],
  repairs: Repair[] = [],
  subject: string | null = null,
): TraceEntry => ({
  at: new Date(started).toISOString(),
  step,
  subject,
  attempt,
  seconds: Math.round((Date.now() - started) / 100) / 10,
  outputTokens: respuesta?.consumo.tokensSalida ?? null,
  promptId: respuesta?.origen.promptId ?? null,
  outcome,
  errors,
  repairs: repairs.map((r) => r.message),
})

export function crearCasosDeUso(deps: Dependencias) {
  const { catalogo, repositorio } = deps
  const ahora = deps.ahora ?? (() => new Date().toISOString())
  const nuevoId = deps.nuevoId ?? (() => crypto.randomUUID())

  const mensaje = (autor: Message['autor'], texto: string, extra: Partial<Message> = {}): Message => ({
    id: nuevoId(),
    autor,
    texto,
    fecha: ahora(),
    preguntas: [],
    respondida: false,
    version: null,
    propuesta: null,
    error: false,
    fotosPedidas: [],
    miniatura: null,
    respuestas: [],
    sugerencias: [],
    ...extra,
  })

  const guardar = (estado: DesignState) => {
    repositorio.guardar(estado)
    return estado
  }

  function conVersion(
    estado: DesignState,
    diseno: Design,
    datos: { resumen: string; motivo: string; operaciones: Operation[]; origen: Origin | null; plan?: FurniturePlan | null; extras?: Operation[] },
  ): DesignState {
    const n = Math.max(...estado.versiones.map((v) => v.n)) + 1
    const versiones = pruneVersions([
      ...estado.versiones,
      { n, diseno, resumen: datos.resumen, motivo: datos.motivo, operaciones: datos.operaciones.map(abbreviate), fecha: ahora(), origen: datos.origen, decisiones: estado.decisiones, plan: datos.plan ?? null, extras: datos.plan ? (datos.extras ?? []) : [] },
    ])
    return { ...estado, versiones, actual: n, propuesta: null, chat: estado.chat.map((m) => (m.propuesta === 'pendiente' ? { ...m, propuesta: 'descartada' as const, respondida: true } : m)) }
  }

  const hallazgosDe = (diseno: Design, requisitos: Requirement[]): Finding[] => {
    const a = analyze(diseno, catalogo, requisitos)
    return a.valid ? a.findings : []
  }

  // Readings of this session's photos: a retry or a second design does not look at the same photo twice.
  const readings = new Map<string, PhotoReading>()

  /** Reads every photo at once; one that fails is retried alone. Null if none could be read. */
  async function readPhotos(fotos: Foto[], context: string, signal: AbortSignal, alAvanzar: AlAvanzar, trace: TraceEntry[]) {
    if (!fotos.length) return null
    const llm = deps.llm()
    let done = 0
    const advance = () => alAvanzar('leyendo-fotos', 0, { done, total: fotos.length })
    advance()
    const readOne = async (foto: Foto) => {
      const key = photoKey(foto.base64, foto.note ?? '')
      const subject = `Foto ${foto.angulo}`
      const cached = readings.get(key)
      for (let attempt = 0; !cached && attempt < 2; attempt++) {
        const started = Date.now()
        try {
          const r = await llm.readPhoto({ photo: foto, context }, signal)
          trace.push(traceEntry('read', attempt, started, r, 'ok', [], [], subject))
          readings.set(key, r.valor)
          break
        } catch (e) {
          if (signal.aborted) throw e
          const outcome = e instanceof RespuestaInvalida ? 'unreadable' : 'failed'
          trace.push(traceEntry('read', attempt, started, null, outcome, [{ code: outcome === 'failed' ? 'E_PROVEEDOR' : 'E_ESQUEMA', message: (e instanceof RespuestaInvalida ? e.problemas : e instanceof Error ? e.message : String(e)).slice(0, 500) }], [], subject))
        }
      }
      done++
      advance()
      const reading = readings.get(key)
      return reading ? { angle: foto.angulo, reading } : null
    }
    const read = await Promise.all(fotos.map(readOne))
    return mergeReadings(read.filter((r): r is NonNullable<typeof r> => !!r))
  }

  /** Kinds that are not a box with columns: asking for a cabinet plan would only add a wasted call. */
  /** Kinds with no ficha yet: they go straight to piece by piece. */
  const NOT_CABINETS = new Set(['bench'])

  /** The skeleton path: if the expert says it is a cabinet, Knotty builds it. Null means: design it whole. */
  async function designFromPlan(
    entrada: { medidas: Dimensions | null; fotos: Foto[]; miniaturas: Thumbnail[]; notas: string },
    fotos: Foto[],
    lectura: PhotoReading | null,
    signal: AbortSignal,
    alAvanzar: AlAvanzar,
    trace: TraceEntry[],
  ): Promise<DesignState | null> {
    const llm = deps.llm()
    const hint = detectKind({ nombre: `${entrada.notas} ${lectura?.kind ?? ''}` })
    if (!llm.planDesign || (hint && NOT_CABINETS.has(hint))) return null
    alAvanzar('mirando-fotos', 0)
    const started = Date.now()
    let plan: Respuesta<RespuestaPlan>
    try {
      plan = await llm.planDesign({ medidas: entrada.medidas, fotos, notas: entrada.notas, lectura, catalogo, correccion: null }, signal)
    } catch (e) {
      if (signal.aborted) throw e
      trace.push(traceEntry('plan', 0, started, null, e instanceof RespuestaInvalida ? 'unreadable' : 'failed', [{ code: 'E_PLAN', message: (e instanceof Error ? e.message : String(e)).slice(0, 500) }]))
      return null
    }
    const { cabinet, bed, table } = plan.valor
    if (!cabinet && !bed && !table) {
      trace.push(traceEntry('plan', 0, started, plan, 'ok', [], [], 'No tiene ficha: se diseña pieza por pieza'))
      return null
    }
    alAvanzar('revisando', 0)
    // A cabinet takes the measures given; a bed takes them from its mattress.
    const given = entrada.medidas && { width: entrada.medidas.ancho, height: entrada.medidas.alto, depth: entrada.medidas.fondo }
    const furniture: FurniturePlan = bed ? bed : table ? { ...table, dimensions: given ?? table.dimensions } : { ...cabinet!, dimensions: given ?? cabinet!.dimensions }
    const { design: built, notes } = buildPlan(furniture, catalogo)
    const { design, repairs } = repairDesign(built, catalogo, plan.valor.requisitos)
    const analisis = analyze(design, catalogo, plan.valor.requisitos)
    if (!analisis.valid) {
      trace.push(traceEntry('plan', 0, started, plan, 'invalid', traceErrors(analisis.errors), repairs))
      return null
    }
    trace.push(traceEntry('plan', 0, started, plan, 'ok', [], repairs, bed ? `Cama ${bed.mattress}` : table ? `Mesa (${table.use})` : `Gabinete de ${cabinet!.columns.length} ${cabinet!.columns.length === 1 ? 'columna' : 'columnas'}`))
    alAvanzar('estructura', 0)
    const { explicacion, preguntas, fotosSolicitadas, requisitos, sugerencias } = plan.valor
    const r: RespuestaReconstruccion = { explicacion: [explicacion, ...notes].join('\n\n'), diseno: design, preguntas, fotosSolicitadas, requisitos, sugerencias }
    return estadoInicial(entrada, design, r, { ...plan, valor: r }, [], repairs, trace, furniture)
  }

  async function reconstruir(
    entrada: { medidas: Dimensions | null; fotos: Foto[]; miniaturas: Thumbnail[]; notas: string },
    signal: AbortSignal,
    alAvanzar: AlAvanzar = () => {},
  ): Promise<DesignState> {
    const llm = deps.llm()
    let correccion: { respuestaAnterior: unknown; errores: DesignError[] } | null = null
    const trace: TraceEntry[] = []
    const lectura = await readPhotos(entrada.fotos, entrada.notas, signal, alAvanzar, trace)
    // With a reading the photos are not sent again; if none could be read, the design looks at them itself.
    const fotosParaDiseno = lectura ? [] : entrada.fotos
    const desdePlan = await designFromPlan(entrada, fotosParaDiseno, lectura, signal, alAvanzar, trace)
    if (desdePlan) return guardar(desdePlan)
    // A design that resolves but did not pass validation: shown with its problems instead of thrown away.
    let lastCandidate: { diseno: Design; r: RespuestaReconstruccion; respuesta: Respuesta<RespuestaReconstruccion>; errores: DesignError[]; repairs: Repair[] } | null = null
    for (let intento = 0; intento < INTENTOS; intento++) {
      // Not a cabinet (or its plan failed): the expert writes every piece, which takes minutes, and the wait says so.
      alAvanzar(intento ? 'corrigiendo' : 'disenando-piezas', intento)
      const started = Date.now()
      let respuesta
      try {
        respuesta = await llm.reconstruir({ medidas: entrada.medidas, fotos: fotosParaDiseno, notas: entrada.notas, lectura, catalogo, correccion }, signal)
      } catch (e) {
        if (!(e instanceof RespuestaInvalida)) {
          if (signal.aborted) throw e
          trace.push(traceEntry('reconstruct', intento, started, null, 'failed', [{ code: 'E_PROVEEDOR', message: e instanceof Error ? e.message : String(e) }]))
          throw new ErrorExperto(e instanceof Error ? e.message : 'Algo falló al consultar al experto.', trace)
        }
        trace.push(traceEntry('reconstruct', intento, started, null, 'unreadable', [{ code: 'E_ESQUEMA', message: e.problemas.slice(0, 500) }]))
        correccion = { respuestaAnterior: e.respuesta, errores: [{ code: 'E_ESQUEMA', message: e.problemas }] }
        continue
      }
      alAvanzar('revisando', intento)
      const r = respuesta.valor
      const propuesto = completeJoints(normalize(entrada.medidas ? { ...r.diseno, dimensiones: entrada.medidas } : r.diseno, catalogo), catalogo)
      // What has an obvious fix is fixed here; only the rest goes back to the model.
      const { design: diseno, repairs } = repairDesign(propuesto, catalogo, r.requisitos)
      const analisis = analyze(diseno, catalogo, r.requisitos)
      if (!analisis.valid) {
        trace.push(traceEntry('reconstruct', intento, started, respuesta, 'invalid', traceErrors(analisis.errors), repairs))
        if (analisis.geo) lastCandidate = { diseno, r, respuesta, errores: analisis.errors, repairs }
        correccion = { respuestaAnterior: r, errores: analisis.errors }
        continue
      }
      trace.push(traceEntry('reconstruct', intento, started, respuesta, 'ok', [], repairs))
      alAvanzar('estructura', intento)
      return guardar(estadoInicial(entrada, diseno, r, respuesta, [], repairs, trace))
    }
    if (lastCandidate) {
      const { diseno, r, respuesta, errores, repairs } = lastCandidate
      return guardar(estadoInicial(entrada, diseno, r, respuesta, errores, repairs, trace))
    }
    const problemas = describeProblems(trace.at(-1)?.errors ?? [])
    throw new ErrorExperto(
      `${entrada.fotos.length ? 'No logré armar un modelo con estas fotos' : 'No logré armar un modelo con esa descripción'}${problemas ? `: en ${INTENTOS} intentos quedaron ${problemas}` : ''}. ${entrada.fotos.length ? 'Prueba con otra toma de frente y una de 3/4 con buena luz.' : 'Prueba contando qué es, sus partes principales (repisas, puertas, cajones) y para qué lo vas a usar.'}`,
      trace,
    )
  }

  /** The first version of a design, from what the expert answered; `problemas` are validation errors left unresolved. */
  function estadoInicial(
    entrada: { medidas: Dimensions | null; fotos: Foto[]; miniaturas: Thumbnail[]; notas: string },
    diseno: Design,
    r: RespuestaReconstruccion,
    respuesta: Respuesta<RespuestaReconstruccion>,
    problemas: DesignError[],
    repairs: Repair[],
    trace: TraceEntry[],
    plan: FurniturePlan | null = null,
  ): DesignState {
    const { ancho, alto, fondo } = diseno.dimensiones
    const estimadas =
      plan && isBed(plan)
        ? [`Las medidas salen del colchón ${plan.mattress}: la cama mide ${fondo / 10} × ${ancho / 10} cm${plan.headboard.style === 'none' ? '' : `, y ${alto / 10} cm de alto con la cabecera`}.`]
        : entrada.medidas
          ? []
          : [`Como no tenías las medidas, las estimé: ${alto} × ${ancho} × ${fondo} mm (alto, ancho, fondo). Dime las reales cuando las tengas y lo ajusto.`]
    const reparado = repairs.length ? [`Ajusté por mi cuenta ${repairs.length === 1 ? 'un detalle' : `${repairs.length} detalles`}: ${repairs.map((x) => x.message).join(' ')}`] : []
    const pendientes = problemas.length
      ? [`No logré que todo cerrara: quedaron ${describeProblems(traceErrors(problemas))}. Te las marqué en el 3D y en los avisos; pídeme que las corrija y lo arreglo sin empezar de cero.`]
      : []
    return {
      formato: 1,
      medidas: diseno.dimensiones,
      versiones: [{ n: 1, diseno, resumen: entrada.fotos.length ? 'Reconstrucción desde fotos' : 'Diseño desde tu descripción', motivo: entrada.notas || 'Fotos y medidas', operaciones: [], fecha: ahora(), origen: respuesta.origen, decisiones: [], plan, extras: [] }],
      actual: 1,
      requisitos: r.requisitos,
      decisiones: [],
      chat: [
        mensaje('usuario', pedidoInicial(entrada), { miniatura: entrada.miniaturas[0]?.dataUrl ?? null }),
        mensaje('experto', [r.explicacion, ...reparado, ...pendientes, ...estimadas, ...(respuesta.avisos ?? [])].join('\n\n'), {
          preguntas: r.preguntas.slice(0, 3),
          fotosPedidas: r.fotosSolicitadas.slice(0, 2),
          sugerencias: [...(problemas.length ? ['Corrige las piezas marcadas'] : []), ...r.sugerencias].slice(0, 4),
          version: 1,
        }),
      ],
      miniaturas: entrada.miniaturas,
      propuesta: null,
      dictamen: null,
      trace,
      accepted: [],
      tray: [],
    }
  }

  async function ajustar(
    estado: DesignState,
    peticion: string,
    signal: AbortSignal,
    alAvanzar: AlAvanzar = () => {},
    respondeA: string | null = null,
    foto: FotoEnviada | null = null,
  ): Promise<DesignState> {
    const conPeticion: DesignState = {
      ...estado,
      miniaturas: foto ? [...estado.miniaturas.filter((m) => m.angulo !== foto.angulo), { angulo: foto.angulo, dataUrl: foto.miniatura }].slice(-MAX_MINIATURAS) : estado.miniaturas,
      chat: [...markAnswered(estado.chat, respondeA), mensaje('usuario', peticion, { miniatura: foto?.miniatura ?? null })],
    }
    guardar(conPeticion)
    const llm = deps.llm()
    const diseno = currentDesign(conPeticion)
    const antes = hallazgosDe(diseno, conPeticion.requisitos)
    const vigentePlan = currentPlan(conPeticion)
    // If the current design has unresolved problems, a change that fixes some and adds none is progress.
    const vigente = analyze(diseno, catalogo, conPeticion.requisitos)
    const problemasPrevios = vigente.valid ? null : new Set(vigente.errors.map(errorKey))
    const contexto = construirContexto(conPeticion, catalogo)
    const trace: TraceEntry[] = []
    const responder = (texto: string, extra: Partial<Message> = {}, base: DesignState = conPeticion) =>
      guardar({ ...base, trace: appendTrace(base.trace, trace), chat: [...base.chat, mensaje('experto', texto, extra)] })

    let correccion: { respuestaAnterior: unknown; errores: string } | null = null
    let criticosRevisados = false
    let ultimoError = ''

    /** With a live plan the expert edits the ficha; null means: go piece by piece. */
    const throughPlan = async (): Promise<DesignState | null> => {
      const plan = vigentePlan.plan
      if (!plan || vigentePlan.diverged || !llm.adjustPlan || foto) return null
      alAvanzar('proponiendo', 0)
      const started = Date.now()
      let respuesta: Respuesta<PlanAdjustment>
      try {
        respuesta = await llm.adjustPlan({ contexto, peticion, plan, catalogo }, signal)
      } catch (e) {
        if (signal.aborted) throw e
        trace.push(traceEntry('adjust', 0, started, null, e instanceof RespuestaInvalida ? 'unreadable' : 'failed', [{ code: 'E_FICHA', message: (e instanceof Error ? e.message : String(e)).slice(0, 500) }], [], 'Ficha'))
        return null
      }
      const r = respuesta.valor
      const requisitos = updateRequirements(conPeticion.requisitos, r.requisitos)
      const base = { ...conPeticion, requisitos, decisiones: updateDecisions(conPeticion.decisiones, r.decisiones) }
      const sugerencias = r.sugerencias.slice(0, 4)
      const next: FurniturePlan | null = isBed(plan) ? r.bed : isTable(plan) ? r.table : r.plan
      if (r.action === 'freeform' || (r.action === 'plan' && !next)) {
        trace.push(traceEntry('adjust', 0, started, respuesta, 'ok', [], [], 'Ficha: no cabe, va pieza por pieza'))
        return null
      }
      if (r.action === 'answer') {
        trace.push(traceEntry('adjust', 0, started, respuesta, 'ok', [], [], 'Ficha: respuesta'))
        return responder(r.explicacion, { preguntas: r.preguntas, sugerencias }, base)
      }
      alAvanzar('revisando', 0)
      const rebuilt = rebuildFromPlan(next!, vigentePlan.extras, catalogo, requisitos)
      const analysis = analyze(rebuilt.design, catalogo, requisitos)
      if (!analysis.valid) {
        trace.push(traceEntry('adjust', 0, started, respuesta, 'invalid', traceErrors(analysis.errors), rebuilt.repairs, 'Ficha'))
        return null
      }
      trace.push(traceEntry('adjust', 0, started, respuesta, 'ok', [], rebuilt.repairs, 'Ficha'))
      alAvanzar('estructura', 0)
      const extras = vigentePlan.extras.filter((e) => !rebuilt.dropped.includes(e))
      const criticos = newCriticals(antes, analysis.findings)
      if (criticos.length) {
        const propuesta = {
          diseno: rebuilt.design,
          operaciones: [],
          resumen: r.resumen,
          motivo: peticion,
          criticos: criticos.map((h) => ({ codigo: h.code, mensaje: h.message, piezas: h.pieces })),
          requisitos,
          decisiones: r.decisiones,
          origen: respuesta.origen,
          plan: next!,
          extras,
          holds: [],
        }
        const pendiente = { ...base, requisitos: conPeticion.requisitos, decisiones: conPeticion.decisiones, propuesta }
        return responder(r.explicacion, { preguntas: r.preguntas.length ? r.preguntas : preguntaDeAlternativas(criticos), propuesta: 'pendiente' }, pendiente)
      }
      const conCambio = conVersion(base, rebuilt.design, { resumen: r.resumen, motivo: peticion, operaciones: [], origen: respuesta.origen, plan: next!, extras })
      return responder([r.explicacion, ...rebuilt.notes].join('\n\n'), { preguntas: r.preguntas, sugerencias, version: conCambio.actual }, conCambio)
    }

    try {
      const porFicha = await throughPlan()
      if (porFicha) return porFicha
      for (let intento = 0; intento < INTENTOS; intento++) {
        alAvanzar(intento ? 'corrigiendo' : 'proponiendo', intento)
        const started = Date.now()
        let respuesta
        try {
          respuesta = await llm.proponerAjuste({ contexto, peticion, diseno, propuesta: conPeticion.propuesta?.operaciones ?? null, fotos: foto ? [{ angulo: foto.angulo, base64: foto.base64 }] : [], catalogo, correccion }, signal)
        } catch (e) {
          if (!(e instanceof RespuestaInvalida)) {
            if (!signal.aborted) trace.push(traceEntry('adjust', intento, started, null, 'failed', [{ code: 'E_PROVEEDOR', message: e instanceof Error ? e.message : String(e) }]))
            throw e
          }
          trace.push(traceEntry('adjust', intento, started, null, 'unreadable', [{ code: 'E_ESQUEMA', message: e.problemas.slice(0, 500) }]))
          correccion = { respuestaAnterior: e.respuesta, errores: e.problemas }
          ultimoError = 'la respuesta no tenía el formato esperado'
          continue
        }
        const r = { ...respuesta.valor, explicacion: [respuesta.valor.explicacion, ...(respuesta.avisos ?? [])].join('\n\n') }
        const requisitos = updateRequirements(conPeticion.requisitos, r.requisitos)
        const decisiones = updateDecisions(conPeticion.decisiones, r.decisiones)
        const base = { ...conPeticion, requisitos, decisiones }
        const fotosPedidas = r.fotosSolicitadas.slice(0, 2)
        const sugerencias = r.sugerencias.slice(0, 4)
        if (!r.operaciones.length) {
          trace.push(traceEntry('adjust', intento, started, respuesta, 'ok', []))
          return responder(r.explicacion, { preguntas: r.preguntas, fotosPedidas, sugerencias }, base)
        }

        alAvanzar('revisando', intento)
        const aplicado = applyOperations(diseno, r.operaciones, catalogo)
        const aplicadoNormal = aplicado.ok ? completeJoints(normalize(aplicado.value.design, catalogo), catalogo, diseno) : null
        const reparado = aplicadoNormal ? repairDesign(aplicadoNormal, catalogo, requisitos) : null
        const nuevo = reparado?.design ?? null
        const repairs = reparado?.repairs ?? []
        const analisis = nuevo ? analyze(nuevo, catalogo, requisitos) : null
        const sinProblemasNuevos = !!analisis && !analisis.valid && !!problemasPrevios && analisis.errors.every((e) => problemasPrevios.has(errorKey(e)))
        if (!aplicado.ok || !nuevo || !analisis || (!analisis.valid && !sinProblemasNuevos)) {
          const errores = !aplicado.ok ? aplicado.errors : analisis && !analisis.valid ? analisis.errors : []
          trace.push(traceEntry('adjust', intento, started, respuesta, 'invalid', traceErrors(errores), repairs))
          correccion = { respuestaAnterior: r, errores: listarErrores(errores) }
          ultimoError = errores[0]?.message ?? 'el cambio no se pudo aplicar'
          continue
        }
        trace.push(traceEntry('adjust', intento, started, respuesta, 'ok', analisis.valid ? [] : traceErrors(analisis.errors), repairs))
        const ajustes = repairs.length ? [`Además ajusté por mi cuenta: ${repairs.map((x) => x.message).join(' ')}`] : []
        const hallazgosNuevos = analisis.valid ? analisis.findings : []
        const quedan = analisis.valid ? [] : [`Todavía quedan ${describeProblems(traceErrors(analisis.errors))}; pídeme que las corrija.`]

        alAvanzar('estructura', intento)
        // Nothing that holds the piece up goes away unasked, and changes wait for the answers to the expert's own questions.
        const unasked = describeChange(diseno, nuevo, catalogo).direct.filter((c) => c.kind === 'removed' && STRUCTURAL.has(diseno.piezas.find((p) => p.id === c.id)?.rol ?? ''))
        const holds = [
          ...(unasked.length && !ASKS_REMOVAL.test(peticion) ? [`Quiere quitar ${unasked.map((c) => c.name).join(', ')}, que sostienen el mueble y no pediste quitar.`] : []),
          ...(r.preguntas.length ? ['Hizo preguntas: el cambio espera tus respuestas.'] : []),
        ]
        if (holds.length) {
          const propuesta = {
            diseno: nuevo,
            operaciones: r.operaciones,
            resumen: r.resumen,
            motivo: peticion,
            criticos: [],
            requisitos,
            decisiones: r.decisiones,
            origen: respuesta.origen,
            ...layered(vigentePlan, r.operaciones),
            holds,
          }
          const pendiente = { ...base, requisitos: conPeticion.requisitos, decisiones: conPeticion.decisiones, propuesta }
          return responder(r.explicacion, { preguntas: r.preguntas, propuesta: 'pendiente', sugerencias }, pendiente)
        }
        const aceptados = new Set(r.aceptaRiesgo.map((a) => a.codigo))
        const criticos = newCriticals(antes, hallazgosNuevos).filter((h) => !aceptados.has(h.code))
        if (criticos.length && !criticosRevisados && !r.preguntas.length) {
          criticosRevisados = true
          intento--
          correccion = {
            respuestaAnterior: r,
            errores: [
              'El cambio es válido pero deja estos problemas estructurales críticos nuevos:',
              ...criticos.map((h) => `- ${h.code} ${h.pieces.join(', ')}: ${h.message} Alternativas: ${h.alternatives.map((a) => `${a.description} ${JSON.stringify(a.data)}`).join('; ')}`),
              'Si la solución es clara, inclúyela en las operaciones. Si hay que elegir, deja las operaciones del pedido y ofrece las opciones en preguntas.',
            ].join('\n'),
          }
          continue
        }

        if (criticos.length) {
          const propuesta = {
            diseno: nuevo,
            operaciones: r.operaciones,
            resumen: r.resumen,
            motivo: peticion,
            criticos: criticos.map((h) => ({ codigo: h.code, mensaje: h.message, piezas: h.pieces })),
            requisitos,
            decisiones: r.decisiones,
            origen: respuesta.origen,
            ...layered(vigentePlan, r.operaciones),
            holds: [],
          }
          const pendiente = { ...base, requisitos: conPeticion.requisitos, decisiones: conPeticion.decisiones, propuesta }
          return responder(r.explicacion, { preguntas: r.preguntas.length ? r.preguntas : preguntaDeAlternativas(criticos), propuesta: 'pendiente' }, pendiente)
        }

        const conCambio = conVersion(base, nuevo, { resumen: r.resumen, motivo: peticion, operaciones: r.operaciones, origen: respuesta.origen, ...layered(vigentePlan, r.operaciones) })
        const avisos = aplicado.value.warnings.map((a) => a.message)
        return responder([r.explicacion, ...ajustes, ...quedan, ...avisos].join('\n\n'), { preguntas: r.preguntas, fotosPedidas, sugerencias, version: conCambio.actual }, conCambio)
      }
      const motivo = ultimoError.trim().replace(/\.?$/, '.')
      return responder(`No logré hacer ese cambio sin romper el diseño, así que no apliqué nada. ${motivo.charAt(0).toUpperCase()}${motivo.slice(1)} ¿Lo intentamos de otra forma?`, { error: true })
    } catch (e) {
      if (signal.aborted) return responder('Cancelado.', { error: true })
      return responder(e instanceof Error ? e.message : 'Algo falló al consultar al experto.', { error: true })
    }
  }

  function aplicarPropuesta(estado: DesignState): DesignState {
    const p = estado.propuesta
    if (!p) return estado
    const base = { ...estado, requisitos: p.requisitos, decisiones: updateDecisions(estado.decisiones, p.decisiones as Decision[]) }
    const conCambio = conVersion(base, p.diseno, { resumen: p.resumen, motivo: p.motivo, operaciones: p.operaciones, origen: p.origen, plan: p.plan, extras: p.extras })
    return guardar({
      ...conCambio,
      chat: [
        ...estado.chat.map((m) => (m.propuesta === 'pendiente' ? { ...m, propuesta: 'aplicada' as const, respondida: true } : m)),
        mensaje('experto', `Listo, apliqué "${p.resumen}" como lo pediste. Los puntos críticos siguen marcados en la revisión.`, { version: conCambio.actual }),
      ],
    })
  }

  function descartarPropuesta(estado: DesignState): DesignState {
    return guardar({ ...estado, propuesta: null, chat: estado.chat.map((m) => (m.propuesta === 'pendiente' ? { ...m, propuesta: 'descartada' as const, respondida: true } : m)) })
  }

  function volverAVersion(estado: DesignState, n: number): DesignState {
    const destino = estado.versiones.find((v) => v.n === n)
    if (!destino || n === estado.actual) return estado
    const conCambio = conVersion({ ...estado, decisiones: destino.decisiones }, destino.diseno, { resumen: `Volver a v${n}`, motivo: `Volver a v${n}: ${destino.resumen}`, operaciones: [], origen: null, plan: destino.plan, extras: destino.extras })
    return guardar({ ...conCambio, chat: [...conCambio.chat, mensaje('experto', `Regresé al diseño de la v${n} (${destino.resumen}).`, { version: conCambio.actual })] })
  }

  /** La persona confirma a mano una pieza que el experto dejó en boceto. */
  function confirmarPieza(estado: DesignState, id: string): DesignState {
    const diseno = currentDesign(estado)
    const pieza = diseno.piezas.find((p) => p.id === id)
    if (!pieza || pieza.confianza === 'alta') return estado
    const operaciones: Operation[] = [{ op: 'cambiarPropiedades', id, nombre: null, rol: null, veta: null, carga: null, apoyo: null, cantos: null, confianza: 'alta' }]
    const r = applyOperations(diseno, operaciones, catalogo)
    if (!r.ok) return estado
    const vigente = currentPlan(estado)
    const conCambio = conVersion(estado, r.value.design, { resumen: `Confirmar ${pieza.nombre.toLowerCase()}`, motivo: 'Confirmada a mano', operaciones, origen: null, ...layered(vigente, operaciones) })
    return guardar({ ...conCambio, chat: [...conCambio.chat, mensaje('experto', `Anoté ${pieza.nombre.toLowerCase()} como confirmada.`, { version: conCambio.actual })] })
  }

  function agregarRequisito(estado: DesignState, texto: string): DesignState {
    const limpio = texto.trim()
    if (!limpio) return estado
    const id = `nota-${nuevoId().slice(0, 8)}`
    return guardar({ ...estado, requisitos: [...estado.requisitos, { id, texto: limpio, tipo: 'otro', eje: null, min: null, max: null }] })
  }

  const quitarRequisito = (estado: DesignState, id: string) => guardar({ ...estado, requisitos: estado.requisitos.filter((r) => r.id !== id) })
  const quitarDecision = (estado: DesignState, tema: string) => guardar({ ...estado, decisiones: estado.decisiones.filter((d) => d.tema !== tema) })

  /** Empieza desde un diseño ya hecho (los ejemplos), sin gastar una llamada al LLM. */
  function desdeEjemplo(diseno: Design): DesignState {
    return guardar({
      formato: 1,
      medidas: diseno.dimensiones,
      versiones: [{ n: 1, diseno, resumen: `Ejemplo: ${diseno.nombre}`, motivo: 'Ejemplo', operaciones: [], fecha: ahora(), origen: null, decisiones: [], plan: null, extras: [] }],
      actual: 1,
      requisitos: [],
      decisiones: [],
      chat: [mensaje('experto', `Aquí tienes un ${diseno.nombre.toLowerCase()} de ejemplo. ${diseno.observaciones} Pídeme cambios: el ancho, la carga, mover una repisa, reforzarlo…`, { version: 1 })],
      miniaturas: [],
      propuesta: null,
      dictamen: null,
      trace: [],
      accepted: [],
      tray: [],
    })
  }

  /** A change made on the plan itself: rebuilt at once, no expert involved. */
  function applyPlan(estado: DesignState, plan: FurniturePlan): { ok: true; estado: DesignState; notes: string[] } | { ok: false; message: string } {
    const parsed = FurniturePlan.safeParse(plan)
    if (!parsed.success) return { ok: false, message: 'Hay un valor que no tiene sentido en la ficha: revisa que las medidas y los altos sean mayores que cero.' }
    const vigente = currentPlan(estado)
    const { design, notes, dropped } = rebuildFromPlan(parsed.data, vigente.diverged ? [] : vigente.extras, catalogo, estado.requisitos)
    const analysis = analyze(design, catalogo, estado.requisitos)
    if (!analysis.valid) {
      const first = design.piezas.reduce((m, p) => m.replaceAll(`"${p.id}"`, p.nombre), analysis.errors[0]?.message ?? '')
      return { ok: false, message: `Así no se puede armar: quedarían ${describeProblems(traceErrors(analysis.errors))}. ${first}` }
    }
    const previous = vigente.plan
    const changes = previous ? describePlanChanges(previous, parsed.data) : []
    const summary = changes.length ? changes.join(', ') : 'sin cambios'
    const extras = (vigente.diverged ? [] : vigente.extras).filter((e) => !dropped.includes(e))
    const withVersion = conVersion(estado, design, { resumen: `Ficha: ${summary}`.slice(0, 90), motivo: `Desde la ficha: ${summary}`, operaciones: [], origen: null, plan: parsed.data, extras })
    const chat = [...withVersion.chat, mensaje('usuario', `Cambié desde la ficha: ${summary}.`, { version: withVersion.actual })]
    return { ok: true, estado: guardar({ ...withVersion, medidas: design.dimensiones, chat }), notes }
  }

  /** A hand edit on one piece, with no expert: the edit if it holds, or the ways it could. */
  function editPiece(estado: DesignState, id: string, edit: PieceEdit): PieceEditResult {
    const design = currentDesign(estado)
    const piece = design.piezas.find((p) => p.id === id)
    const analysis = analyze(design, catalogo, estado.requisitos)
    const box = analysis.geo?.boxes.get(id)
    if (!piece || !box) return { ok: false, message: 'No encuentro esa pieza en el diseño.', alternatives: [] }
    const size = (axis: Axis) => box[`${axis}1`] - box[`${axis}0`]
    const operaciones: Operation[] =
      edit.kind === 'thickness'
        ? [{ op: 'cambiarEspesor', ids: [id], material: edit.material }]
        : edit.kind === 'move'
          ? [{ op: 'mover', id, eje: edit.axis, cota: { tipo: 'mm', mm: box[`${edit.axis}0`] + edit.delta } }]
          : [
              // The end tied to the outside of the piece stays; the other one moves.
              toOutside(piece[edit.axis].hasta) && !toOutside(piece[edit.axis].desde)
                ? { op: 'redimensionar', id, eje: edit.axis, extremo: 'desde', cota: { tipo: 'mm', mm: box[`${edit.axis}1`] - edit.value } }
                : { op: 'redimensionar', id, eje: edit.axis, extremo: 'hasta', cota: { tipo: 'mm', mm: box[`${edit.axis}0`] + edit.value } },
            ]
    const summary =
      edit.kind === 'thickness'
        ? `${piece.nombre} de ${materialById(catalogo, edit.material)?.espesor ?? '?'} mm`
        : edit.kind === 'move'
          ? `Mover ${piece.nombre.toLowerCase()} ${Math.abs(edit.delta)} mm`
          : `${piece.nombre} de ${Math.round(size(edit.axis))} a ${Math.round(edit.value)} mm`
    const applied = applyOperations(design, operaciones, catalogo)
    const candidate = applied.ok ? completeJoints(normalize(applied.value.design, catalogo), catalogo, design) : null
    const after = candidate ? analyze(candidate, catalogo, estado.requisitos) : null
    // An edit may leave the problems a design already had, but it must not add new ones.
    const before = new Set(analysis.valid ? [] : analysis.errors.map(errorKey))
    const holds = !!after && (after.valid || after.errors.every((e) => before.has(errorKey(e))))
    if (candidate && holds) {
      const vigente = currentPlan(estado)
      const withVersion = conVersion(estado, candidate, { resumen: summary.slice(0, 90), motivo: `A mano: ${summary}`, operaciones, origen: null, ...layered(vigente, operaciones) })
      return { ok: true, estado: guardar({ ...withVersion, chat: [...withVersion.chat, mensaje('usuario', `Cambié a mano: ${summary}.`, { version: withVersion.actual })] }) }
    }
    const reason = !applied.ok ? applied.errors[0]?.message : after && !after.valid ? after.errors.find((e) => !before.has(errorKey(e)))?.message : undefined
    const named = (text = '') => design.piezas.reduce((m, p) => m.replaceAll(`"${p.id}"`, p.nombre), text)
    // Tied to the outside of the piece: what can change is the whole piece of furniture.
    const alternatives: { label: string; axis: Axis; value: number }[] =
      edit.kind === 'length'
        ? [{ label: `Cambiar el ${DIMENSION_OF_AXIS[edit.axis]} del mueble en ${edit.value - Math.round(size(edit.axis)) > 0 ? '+' : ''}${Math.round(edit.value - size(edit.axis))} mm`, axis: edit.axis, value: Math.round(design.dimensiones[DIMENSION_OF_AXIS[edit.axis]] + edit.value - size(edit.axis)) }]
        : []
    return { ok: false, message: `Así no queda: ${(named(reason) || 'la pieza está amarrada a otras').replace(/\.$/, '')}.`, alternatives }
  }

  /** The whole piece of furniture grows or shrinks along one axis; through the ficha when there is one. */
  function resizeFurniture(estado: DesignState, axis: Axis, value: number): PieceEditResult {
    const vigente = currentPlan(estado)
    if (vigente.plan && !vigente.diverged) {
      const plan = vigente.plan
      const key = { x: 'width', y: 'height', z: 'depth' } as const
      // A bed's length and width come from its mattress; its height is the headboard's, or the base's without one.
      if (isBed(plan) && axis !== 'y') return { ok: false, message: 'El largo y el ancho de la cama salen del colchón: cambia el colchón en la ficha.', alternatives: [] }
      const resized: FurniturePlan = isBed(plan)
        ? plan.headboard.style === 'none'
          ? { ...plan, height: value }
          : { ...plan, headboard: { ...plan.headboard, height: value } }
        : { ...plan, dimensions: { ...plan.dimensions, [key[axis]]: value } }
      const r = applyPlan(estado, resized)
      return r.ok ? { ok: true, estado: r.estado } : { ok: false, message: r.message, alternatives: [] }
    }
    const operaciones: Operation[] = [{ op: 'cambiarDimensionGlobal', eje: axis, valor: value, regla: 'estirar' }]
    const design = currentDesign(estado)
    const applied = applyOperations(design, operaciones, catalogo)
    const candidate = applied.ok ? completeJoints(normalize(applied.value.design, catalogo), catalogo, design) : null
    const after = candidate && analyze(candidate, catalogo, estado.requisitos)
    if (!candidate || !after?.valid) return { ok: false, message: 'Tampoco se puede cambiar la medida del mueble así.', alternatives: [] }
    const dimension = DIMENSION_OF_AXIS[axis]
    const summary = `${dimension.charAt(0).toUpperCase()}${dimension.slice(1)} del mueble a ${value} mm`
    const withVersion = conVersion(estado, candidate, { resumen: summary, motivo: `A mano: ${summary}`, operaciones, origen: null })
    return { ok: true, estado: guardar({ ...withVersion, medidas: candidate.dimensiones, chat: [...withVersion.chat, mensaje('usuario', `Cambié a mano: ${summary}.`, { version: withVersion.actual })] }) }
  }

  /** The version a given one was made from: the one just before it in the timeline. */
  const previousOf = (estado: DesignState, n: number) => {
    const ordered = [...estado.versiones].sort((a, b) => a.n - b.n)
    const i = ordered.findIndex((v) => v.n === n)
    return i > 0 ? ordered[i - 1] : null
  }

  /** Brings pieces back to how they were before version `n`, keeping everything that came after. */
  function restoreFromVersion(estado: DesignState, n: number, ids: string[]): { ok: true; estado: DesignState } | { ok: false; message: string } {
    const before = previousOf(estado, n)
    if (!before || !ids.length) return { ok: false, message: 'No hay una versión anterior de dónde regresar.' }
    const current = currentDesign(estado)
    const r = restorePieces(current, before.diseno, ids, catalogo)
    const named = (text = '') => current.piezas.concat(before.diseno.piezas).reduce((m, p) => m.replaceAll(`"${p.id}"`, p.nombre), text)
    if (!r.ok) return { ok: false, message: `No se puede regresar así: ${named(r.errors[0]?.message) || 'choca con lo que cambió después'}` }
    const previousErrors = analyze(current, catalogo, estado.requisitos)
    const known = new Set(previousErrors.valid ? [] : previousErrors.errors.map(errorKey))
    const after = analyze(r.design, catalogo, estado.requisitos)
    if (!after.valid && !after.errors.every((e) => known.has(errorKey(e)))) return { ok: false, message: `No se puede regresar así: ${named(after.errors.find((e) => !known.has(errorKey(e)))?.message)}` }
    const names = ids.map((id) => before.diseno.piezas.find((p) => p.id === id)?.nombre ?? current.piezas.find((p) => p.id === id)?.nombre ?? id)
    const summary = `Regresar ${names.join(', ')}`
    const operaciones: Operation[] = ids.flatMap((id): Operation[] => {
      const was = before.diseno.piezas.find((p) => p.id === id)
      const now = current.piezas.some((p) => p.id === id)
      if (!was) return [{ op: 'eliminarPieza', id }]
      return [...(now ? [{ op: 'eliminarPieza' as const, id }] : []), { op: 'agregarPieza' as const, pieza: was }]
    })
    const withVersion = conVersion(estado, r.design, { resumen: summary.slice(0, 90), motivo: `${summary} como ${names.length === 1 ? 'estaba' : 'estaban'} antes de la v${n}`, operaciones, origen: null, ...layered(currentPlan(estado), operaciones) })
    return { ok: true, estado: guardar({ ...withVersion, chat: [...withVersion.chat, mensaje('usuario', `Regresé ${names.join(', ')} como ${names.length === 1 ? 'estaba' : 'estaban'} antes de la v${n}.`, { version: withVersion.actual })] }) }
  }

  /** Undoes one change: the last one exactly; an older one by bringing back what it touched. */
  function undoChange(estado: DesignState, n: number): { ok: true; estado: DesignState } | { ok: false; message: string } {
    const before = previousOf(estado, n)
    if (!before) return { ok: false, message: 'Es la primera versión: no hay nada antes.' }
    if (n === estado.actual) return { ok: true, estado: volverAVersion(estado, before.n) }
    const version = estado.versiones.find((v) => v.n === n)!
    const ids = describeChange(before.diseno, version.diseno, catalogo).direct.map((c) => c.id)
    return restoreFromVersion(estado, n, ids)
  }

  /** The person leaves a finding as it is: it stops counting as pending and the verdict mentions it. */
  function acceptNotice(estado: DesignState, findings: Finding[], title: string): DesignState {
    const keys = new Set(estado.accepted.map((a) => a.key))
    const added = findings.map(findingKey).filter((k) => !keys.has(k)).map((key) => ({ key, title, at: ahora() }))
    return guardar({ ...estado, accepted: [...estado.accepted, ...added] })
  }

  function reopenNotice(estado: DesignState, findings: Finding[]): DesignState {
    const keys = new Set(findings.map(findingKey))
    return guardar({ ...estado, accepted: estado.accepted.filter((a) => !keys.has(a.key)) })
  }

  /** A solution Knotty built: applied as one version, with no expert. */
  function applyFix(estado: DesignState, fix: Fix): DesignState {
    const withVersion = conVersion(estado, fix.design, { resumen: fix.label.slice(0, 90), motivo: `Solución: ${fix.label}`, operaciones: fix.operations, origen: null, ...layered(currentPlan(estado), fix.operations) })
    return guardar({ ...withVersion, chat: [...withVersion.chat, mensaje('usuario', `Resolví: ${fix.label}.`, { version: withVersion.actual })] })
  }

  function toggleTray(estado: DesignState, item: TrayItem): DesignState {
    return guardar({ ...estado, tray: toggleInTray(estado.tray, item) })
  }

  /** Everything in the tray, plus what was typed, in one request; its questions are marked answered. */
  function sendTray(estado: DesignState, typed: string, signal: AbortSignal, alAvanzar?: AlAvanzar): Promise<DesignState> {
    const { text, answers } = trayRequest(estado.tray, typed)
    return ajustar({ ...estado, tray: [] }, text, signal, alAvanzar, answers)
  }

  /** A session made elsewhere (a bench run) becomes the one the person works on. */
  function adopt(estado: DesignState): DesignState {
    return guardar(estado)
  }

  function nuevoDiseno() {
    repositorio.borrar()
  }

  /** Las cuentas primero y luego el carpintero; si él no contesta, el dictamen queda solo con las cuentas. */
  async function dictaminar(estado: DesignState, catalogoEfectivo: Catalog, signal: AbortSignal): Promise<PurchaseReview> {
    const diseno = currentDesign(estado)
    const analisis = analyze(diseno, catalogo)
    if (!analisis.valid) throw new ErrorExperto(`El diseño tiene errores y no se puede revisar la compra: ${analisis.errors[0].message}`)
    const compra = estimatePurchase(diseno, analisis.geo, catalogoEfectivo)
    const incumplidos = checkRequirements(diseno, estado.requisitos).map((e) => e.message)
    const accepted = new Map(estado.accepted.map((a) => [a.key, a.title]))
    const viabilidad = reviewViability({
      design: diseno,
      geo: analisis.geo,
      catalog: catalogoEfectivo,
      purchase: compra,
      findings: analisis.findings.filter((h) => !accepted.has(findingKey(h))),
      unmet: incumplidos,
      accepted: analisis.findings.flatMap((h) => accepted.get(findingKey(h)) ?? []),
    })
    const base = { firma: firmaDictamen(estado, catalogoEfectivo), comprobaciones: viabilidad.comprobaciones, fecha: ahora() }
    try {
      const r = await deps.llm().dictaminar(
        {
          contexto: construirContexto(estado, catalogo),
          revision: textoRevision(cutList(diseno, analisis.geo), viabilidad.comprobaciones),
          diseno,
          comprobaciones: viabilidad.comprobaciones,
          catalogo: catalogoEfectivo,
        },
        signal,
      )
      return { ...base, veredicto: worst(viabilidad.veredicto, r.valor.veredicto), carpintero: { ...r.valor, origen: r.origen }, error: null }
    } catch (e) {
      if (signal.aborted) throw e
      return { ...base, veredicto: viabilidad.veredicto, carpintero: null, error: e instanceof Error ? e.message : 'El carpintero no contestó.' }
    }
  }

  /** Se guarda sobre el estado vigente: el diseño pudo cambiar mientras el carpintero revisaba. */
  const guardarDictamen = (estado: DesignState, dictamen: PurchaseReview) => guardar({ ...estado, dictamen })

  const cargar = () => repositorio.cargar()

  const preguntasPendientes = (estado: DesignState): Question[] => estado.chat.filter((m) => !m.respondida).flatMap((m) => m.preguntas)

  return {
    reconstruir,
    ajustar,
    aplicarPropuesta,
    descartarPropuesta,
    volverAVersion,
    confirmarPieza,
    agregarRequisito,
    quitarRequisito,
    quitarDecision,
    desdeEjemplo,
    nuevoDiseno,
    dictaminar,
    guardarDictamen,
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
    cargar,
    preguntasPendientes,
  }
}

export type CasosDeUso = ReturnType<typeof crearCasosDeUso>
export type { RespuestaAjuste }
