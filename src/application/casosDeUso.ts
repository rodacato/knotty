import { analizar } from '../domain/analisis'
import type { Dimensiones, Diseno } from '../domain/diseno/esquema'
import { normalizar } from '../domain/diseno/normalizador'
import { completeJoints } from '../domain/diseno/joints'
import type { Hallazgo } from '../domain/estructura/hallazgo'
import { criticosNuevos } from '../domain/estructura/motor'
import { abreviar, actualizarDecisiones, podarVersiones, type Decision, type Origen } from '../domain/historial/historial'
import type { Catalogo } from '../domain/materiales/catalogo'
import { estimarCompra } from '../domain/materiales/compra'
import { despiece, type RenglonDespiece } from '../domain/materiales/despiece'
import { aplicar } from '../domain/operaciones/aplicar'
import type { Operacion } from '../domain/operaciones/esquema'
import { actualizarRequisitos, verificarRequisitos, type Requisito } from '../domain/requisitos/requisitos'
import { disenoActual, marcarRespondida, type Dictamen, type EstadoDiseno, type Mensaje, type Miniatura, type Pregunta } from '../domain/sesion/estado'
import { repairDesign, type Repair } from '../domain/repair/repair'
import { mergeReadings, photoKey, type PhotoReading } from '../domain/reading/reading'
import { appendTrace, describeProblems, errorKey, traceErrors, type TraceEntry } from '../domain/trace/trace'
import type { ErrorDiseno } from '../domain/validacion/errores'
import { peor, revisarViabilidad, type Comprobacion } from '../domain/viabilidad/viabilidad'
import type { DesignRepository } from '../ports/DesignRepository'
import { RespuestaInvalida, type Foto, type LLMProvider, type Respuesta, type RespuestaAjuste, type RespuestaReconstruccion } from '../ports/LLMProvider'
import { construirContexto } from './contexto'

export type Etapa = 'leyendo-fotos' | 'mirando-fotos' | 'proponiendo' | 'revisando' | 'estructura' | 'corrigiendo'
export type AlAvanzar = (etapa: Etapa, intento: number, progress?: { done: number; total: number }) => void

export interface Dependencias {
  llm: () => LLMProvider
  catalogo: Catalogo
  repositorio: DesignRepository
  ahora?: () => string
  nuevoId?: () => string
}

const INTENTOS = 3
const MAX_MINIATURAS = 8

/** Una foto que la persona manda en medio de la conversación, casi siempre porque el experto la pidió. */
export interface FotoEnviada {
  angulo: string
  base64: string
  miniatura: string
}
const listarErrores = (errores: ErrorDiseno[]) => errores.map((e) => `- ${e.codigo}: ${e.mensaje}${e.datos ? ` ${JSON.stringify(e.datos)}` : ''}`).join('\n')

/** Lo que la persona pidió al empezar, como primer mensaje del chat. */
function pedidoInicial(entrada: { medidas: Dimensiones | null; fotos: Foto[]; notas: string }) {
  const medidas = entrada.medidas ? `Mide ${entrada.medidas.alto} × ${entrada.medidas.ancho} × ${entrada.medidas.fondo} mm (alto, ancho, fondo).` : 'No sé las medidas.'
  const fotos = entrada.fotos.length ? `Te mando ${entrada.fotos.length === 1 ? 'una foto' : `${entrada.fotos.length} fotos`} (${entrada.fotos.map((f) => f.angulo).join(', ')}).` : ''
  const notasDeFotos = entrada.fotos.filter((f) => f.note?.trim()).map((f) => `Sobre la foto ${f.angulo}: ${f.note!.trim()}`)
  return [entrada.notas.trim(), fotos, ...notasDeFotos, medidas].filter(Boolean).join('\n\n')
}

/** Si el experto no ofreció opciones ante un crítico, se ofrecen las alternativas que calculó el motor. */
function preguntaDeAlternativas(criticos: Hallazgo[]): Pregunta[] {
  const opciones = [...new Set(criticos.flatMap((h) => h.alternativas.filter((a) => a.clave !== 'claro-maximo').map((a) => a.descripcion)))].slice(0, 3)
  return opciones.length ? [{ texto: '¿Cómo lo resolvemos?', opciones }] : []
}

/** Con qué se hizo un dictamen: si cambia la versión, los requisitos o los ajustes de corte, hay que repetirlo. */
export const firmaDictamen = (estado: EstadoDiseno, catalogoEfectivo: Catalogo) =>
  JSON.stringify([estado.actual, estado.requisitos.map((r) => r.id), catalogoEfectivo.acomodo, catalogoEfectivo.materiales.map((m) => [m.id, m.hoja])])

const ESTADO_COMPROBACION = { ok: 'bien', aviso: 'aviso', falla: 'FALLA' }
function textoRevision(corte: RenglonDespiece[], comprobaciones: Comprobacion[]) {
  return [
    '## Lista de corte (largo × ancho × espesor, mm)',
    ...corte.map((r) => `- ${r.cantidad} × ${r.nombre} (${r.material}): ${r.largo} × ${r.ancho} × ${r.espesor}`),
    '',
    '## Comprobaciones de la app',
    ...comprobaciones.map((c) => `- [${ESTADO_COMPROBACION[c.estado]}] ${c.titulo}: ${c.detalle}`),
  ].join('\n')
}

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

  const mensaje = (autor: Mensaje['autor'], texto: string, extra: Partial<Mensaje> = {}): Mensaje => ({
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

  const guardar = (estado: EstadoDiseno) => {
    repositorio.guardar(estado)
    return estado
  }

  function conVersion(estado: EstadoDiseno, diseno: Diseno, datos: { resumen: string; motivo: string; operaciones: Operacion[]; origen: Origen | null }): EstadoDiseno {
    const n = Math.max(...estado.versiones.map((v) => v.n)) + 1
    const versiones = podarVersiones([...estado.versiones, { n, diseno, resumen: datos.resumen, motivo: datos.motivo, operaciones: datos.operaciones.map(abreviar), fecha: ahora(), origen: datos.origen, decisiones: estado.decisiones }])
    return { ...estado, versiones, actual: n, propuesta: null, chat: estado.chat.map((m) => (m.propuesta === 'pendiente' ? { ...m, propuesta: 'descartada' as const, respondida: true } : m)) }
  }

  const hallazgosDe = (diseno: Diseno, requisitos: Requisito[]): Hallazgo[] => {
    const a = analizar(diseno, catalogo, requisitos)
    return a.valido ? a.hallazgos : []
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

  async function reconstruir(
    entrada: { medidas: Dimensiones | null; fotos: Foto[]; miniaturas: Miniatura[]; notas: string },
    signal: AbortSignal,
    alAvanzar: AlAvanzar = () => {},
  ): Promise<EstadoDiseno> {
    const llm = deps.llm()
    let correccion: { respuestaAnterior: unknown; errores: ErrorDiseno[] } | null = null
    const trace: TraceEntry[] = []
    const lectura = await readPhotos(entrada.fotos, entrada.notas, signal, alAvanzar, trace)
    // With a reading the photos are not sent again; if none could be read, the design looks at them itself.
    const fotosParaDiseno = lectura ? [] : entrada.fotos
    // A design that resolves but did not pass validation: shown with its problems instead of thrown away.
    let lastCandidate: { diseno: Diseno; r: RespuestaReconstruccion; respuesta: Respuesta<RespuestaReconstruccion>; errores: ErrorDiseno[]; repairs: Repair[] } | null = null
    for (let intento = 0; intento < INTENTOS; intento++) {
      alAvanzar(intento ? 'corrigiendo' : 'mirando-fotos', intento)
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
        correccion = { respuestaAnterior: e.respuesta, errores: [{ codigo: 'E_ESQUEMA', mensaje: e.problemas }] }
        continue
      }
      alAvanzar('revisando', intento)
      const r = respuesta.valor
      const propuesto = completeJoints(normalizar(entrada.medidas ? { ...r.diseno, dimensiones: entrada.medidas } : r.diseno, catalogo), catalogo)
      // What has an obvious fix is fixed here; only the rest goes back to the model.
      const { design: diseno, repairs } = repairDesign(propuesto, catalogo, r.requisitos)
      const analisis = analizar(diseno, catalogo, r.requisitos)
      if (!analisis.valido) {
        trace.push(traceEntry('reconstruct', intento, started, respuesta, 'invalid', traceErrors(analisis.errores), repairs))
        if (analisis.geo) lastCandidate = { diseno, r, respuesta, errores: analisis.errores, repairs }
        correccion = { respuestaAnterior: r, errores: analisis.errores }
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
    entrada: { medidas: Dimensiones | null; fotos: Foto[]; miniaturas: Miniatura[]; notas: string },
    diseno: Diseno,
    r: RespuestaReconstruccion,
    respuesta: Respuesta<RespuestaReconstruccion>,
    problemas: ErrorDiseno[],
    repairs: Repair[],
    trace: TraceEntry[],
  ): EstadoDiseno {
    const { ancho, alto, fondo } = diseno.dimensiones
    const estimadas = entrada.medidas ? [] : [`Como no tenías las medidas, las estimé: ${alto} × ${ancho} × ${fondo} mm (alto, ancho, fondo). Dime las reales cuando las tengas y lo ajusto.`]
    const reparado = repairs.length ? [`Ajusté por mi cuenta ${repairs.length === 1 ? 'un detalle' : `${repairs.length} detalles`}: ${repairs.map((x) => x.message).join(' ')}`] : []
    const pendientes = problemas.length
      ? [`No logré que todo cerrara: quedaron ${describeProblems(traceErrors(problemas))}. Te las marqué en el 3D y en Revisión; pídeme que las corrija y lo arreglo sin empezar de cero.`]
      : []
    return {
      formato: 1,
      medidas: diseno.dimensiones,
      versiones: [{ n: 1, diseno, resumen: entrada.fotos.length ? 'Reconstrucción desde fotos' : 'Diseño desde tu descripción', motivo: entrada.notas || 'Fotos y medidas', operaciones: [], fecha: ahora(), origen: respuesta.origen, decisiones: [] }],
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
    }
  }

  async function ajustar(
    estado: EstadoDiseno,
    peticion: string,
    signal: AbortSignal,
    alAvanzar: AlAvanzar = () => {},
    respondeA: string | null = null,
    foto: FotoEnviada | null = null,
  ): Promise<EstadoDiseno> {
    const conPeticion: EstadoDiseno = {
      ...estado,
      miniaturas: foto ? [...estado.miniaturas.filter((m) => m.angulo !== foto.angulo), { angulo: foto.angulo, dataUrl: foto.miniatura }].slice(-MAX_MINIATURAS) : estado.miniaturas,
      chat: [...marcarRespondida(estado.chat, respondeA), mensaje('usuario', peticion, { miniatura: foto?.miniatura ?? null })],
    }
    guardar(conPeticion)
    const llm = deps.llm()
    const diseno = disenoActual(conPeticion)
    const antes = hallazgosDe(diseno, conPeticion.requisitos)
    // If the current design has unresolved problems, a change that fixes some and adds none is progress.
    const vigente = analizar(diseno, catalogo, conPeticion.requisitos)
    const problemasPrevios = vigente.valido ? null : new Set(vigente.errores.map(errorKey))
    const contexto = construirContexto(conPeticion, catalogo)
    const trace: TraceEntry[] = []
    const responder = (texto: string, extra: Partial<Mensaje> = {}, base: EstadoDiseno = conPeticion) =>
      guardar({ ...base, trace: appendTrace(base.trace, trace), chat: [...base.chat, mensaje('experto', texto, extra)] })

    let correccion: { respuestaAnterior: unknown; errores: string } | null = null
    let criticosRevisados = false
    let ultimoError = ''
    try {
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
        const requisitos = actualizarRequisitos(conPeticion.requisitos, r.requisitos)
        const decisiones = actualizarDecisiones(conPeticion.decisiones, r.decisiones)
        const base = { ...conPeticion, requisitos, decisiones }
        const fotosPedidas = r.fotosSolicitadas.slice(0, 2)
        const sugerencias = r.sugerencias.slice(0, 4)
        if (!r.operaciones.length) {
          trace.push(traceEntry('adjust', intento, started, respuesta, 'ok', []))
          return responder(r.explicacion, { preguntas: r.preguntas, fotosPedidas, sugerencias }, base)
        }

        alAvanzar('revisando', intento)
        const aplicado = aplicar(diseno, r.operaciones, catalogo)
        const aplicadoNormal = aplicado.ok ? completeJoints(normalizar(aplicado.valor.diseno, catalogo), catalogo, diseno) : null
        const reparado = aplicadoNormal ? repairDesign(aplicadoNormal, catalogo, requisitos) : null
        const nuevo = reparado?.design ?? null
        const repairs = reparado?.repairs ?? []
        const analisis = nuevo ? analizar(nuevo, catalogo, requisitos) : null
        const sinProblemasNuevos = !!analisis && !analisis.valido && !!problemasPrevios && analisis.errores.every((e) => problemasPrevios.has(errorKey(e)))
        if (!aplicado.ok || !nuevo || !analisis || (!analisis.valido && !sinProblemasNuevos)) {
          const errores = !aplicado.ok ? aplicado.errores : analisis && !analisis.valido ? analisis.errores : []
          trace.push(traceEntry('adjust', intento, started, respuesta, 'invalid', traceErrors(errores), repairs))
          correccion = { respuestaAnterior: r, errores: listarErrores(errores) }
          ultimoError = errores[0]?.mensaje ?? 'el cambio no se pudo aplicar'
          continue
        }
        trace.push(traceEntry('adjust', intento, started, respuesta, 'ok', analisis.valido ? [] : traceErrors(analisis.errores), repairs))
        const ajustes = repairs.length ? [`Además ajusté por mi cuenta: ${repairs.map((x) => x.message).join(' ')}`] : []
        const hallazgosNuevos = analisis.valido ? analisis.hallazgos : []
        const quedan = analisis.valido ? [] : [`Todavía quedan ${describeProblems(traceErrors(analisis.errores))}; pídeme que las corrija.`]

        alAvanzar('estructura', intento)
        const aceptados = new Set(r.aceptaRiesgo.map((a) => a.codigo))
        const criticos = criticosNuevos(antes, hallazgosNuevos).filter((h) => !aceptados.has(h.codigo))
        if (criticos.length && !criticosRevisados && !r.preguntas.length) {
          criticosRevisados = true
          intento--
          correccion = {
            respuestaAnterior: r,
            errores: [
              'El cambio es válido pero deja estos problemas estructurales críticos nuevos:',
              ...criticos.map((h) => `- ${h.codigo} ${h.piezas.join(', ')}: ${h.mensaje} Alternativas: ${h.alternativas.map((a) => `${a.descripcion} ${JSON.stringify(a.datos)}`).join('; ')}`),
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
            criticos: criticos.map((h) => ({ codigo: h.codigo, mensaje: h.mensaje, piezas: h.piezas })),
            requisitos,
            decisiones: r.decisiones,
            origen: respuesta.origen,
          }
          const pendiente = { ...base, requisitos: conPeticion.requisitos, decisiones: conPeticion.decisiones, propuesta }
          return responder(r.explicacion, { preguntas: r.preguntas.length ? r.preguntas : preguntaDeAlternativas(criticos), propuesta: 'pendiente' }, pendiente)
        }

        const conCambio = conVersion(base, nuevo, { resumen: r.resumen, motivo: peticion, operaciones: r.operaciones, origen: respuesta.origen })
        const avisos = aplicado.valor.avisos.map((a) => a.mensaje)
        return responder([r.explicacion, ...ajustes, ...quedan, ...avisos].join('\n\n'), { preguntas: r.preguntas, fotosPedidas, sugerencias, version: conCambio.actual }, conCambio)
      }
      const motivo = ultimoError.trim().replace(/\.?$/, '.')
      return responder(`No logré hacer ese cambio sin romper el diseño, así que no apliqué nada. ${motivo.charAt(0).toUpperCase()}${motivo.slice(1)} ¿Lo intentamos de otra forma?`, { error: true })
    } catch (e) {
      if (signal.aborted) return responder('Cancelado.', { error: true })
      return responder(e instanceof Error ? e.message : 'Algo falló al consultar al experto.', { error: true })
    }
  }

  function aplicarPropuesta(estado: EstadoDiseno): EstadoDiseno {
    const p = estado.propuesta
    if (!p) return estado
    const base = { ...estado, requisitos: p.requisitos, decisiones: actualizarDecisiones(estado.decisiones, p.decisiones as Decision[]) }
    const conCambio = conVersion(base, p.diseno, { resumen: p.resumen, motivo: p.motivo, operaciones: p.operaciones, origen: p.origen })
    return guardar({
      ...conCambio,
      chat: [
        ...estado.chat.map((m) => (m.propuesta === 'pendiente' ? { ...m, propuesta: 'aplicada' as const, respondida: true } : m)),
        mensaje('experto', `Listo, apliqué "${p.resumen}" como lo pediste. Los puntos críticos siguen marcados en la revisión.`, { version: conCambio.actual }),
      ],
    })
  }

  function descartarPropuesta(estado: EstadoDiseno): EstadoDiseno {
    return guardar({ ...estado, propuesta: null, chat: estado.chat.map((m) => (m.propuesta === 'pendiente' ? { ...m, propuesta: 'descartada' as const, respondida: true } : m)) })
  }

  function volverAVersion(estado: EstadoDiseno, n: number): EstadoDiseno {
    const destino = estado.versiones.find((v) => v.n === n)
    if (!destino || n === estado.actual) return estado
    const conCambio = conVersion({ ...estado, decisiones: destino.decisiones }, destino.diseno, { resumen: `Volver a v${n}`, motivo: `Volver a v${n}: ${destino.resumen}`, operaciones: [], origen: null })
    return guardar({ ...conCambio, chat: [...conCambio.chat, mensaje('experto', `Regresé al diseño de la v${n} (${destino.resumen}).`, { version: conCambio.actual })] })
  }

  /** La persona confirma a mano una pieza que el experto dejó en boceto. */
  function confirmarPieza(estado: EstadoDiseno, id: string): EstadoDiseno {
    const diseno = disenoActual(estado)
    const pieza = diseno.piezas.find((p) => p.id === id)
    if (!pieza || pieza.confianza === 'alta') return estado
    const operaciones: Operacion[] = [{ op: 'cambiarPropiedades', id, nombre: null, rol: null, veta: null, carga: null, apoyo: null, cantos: null, confianza: 'alta' }]
    const r = aplicar(diseno, operaciones, catalogo)
    if (!r.ok) return estado
    const conCambio = conVersion(estado, r.valor.diseno, { resumen: `Confirmar ${pieza.nombre.toLowerCase()}`, motivo: 'Confirmada a mano', operaciones, origen: null })
    return guardar({ ...conCambio, chat: [...conCambio.chat, mensaje('experto', `Anoté ${pieza.nombre.toLowerCase()} como confirmada.`, { version: conCambio.actual })] })
  }

  function agregarRequisito(estado: EstadoDiseno, texto: string): EstadoDiseno {
    const limpio = texto.trim()
    if (!limpio) return estado
    const id = `nota-${nuevoId().slice(0, 8)}`
    return guardar({ ...estado, requisitos: [...estado.requisitos, { id, texto: limpio, tipo: 'otro', eje: null, min: null, max: null }] })
  }

  const quitarRequisito = (estado: EstadoDiseno, id: string) => guardar({ ...estado, requisitos: estado.requisitos.filter((r) => r.id !== id) })
  const quitarDecision = (estado: EstadoDiseno, tema: string) => guardar({ ...estado, decisiones: estado.decisiones.filter((d) => d.tema !== tema) })

  /** Empieza desde un diseño ya hecho (los ejemplos), sin gastar una llamada al LLM. */
  function desdeEjemplo(diseno: Diseno): EstadoDiseno {
    return guardar({
      formato: 1,
      medidas: diseno.dimensiones,
      versiones: [{ n: 1, diseno, resumen: `Ejemplo: ${diseno.nombre}`, motivo: 'Ejemplo', operaciones: [], fecha: ahora(), origen: null, decisiones: [] }],
      actual: 1,
      requisitos: [],
      decisiones: [],
      chat: [mensaje('experto', `Aquí tienes un ${diseno.nombre.toLowerCase()} de ejemplo. ${diseno.observaciones} Pídeme cambios: el ancho, la carga, mover una repisa, reforzarlo…`, { version: 1 })],
      miniaturas: [],
      propuesta: null,
      dictamen: null,
      trace: [],
    })
  }

  function nuevoDiseno() {
    repositorio.borrar()
  }

  /** Las cuentas primero y luego el carpintero; si él no contesta, el dictamen queda solo con las cuentas. */
  async function dictaminar(estado: EstadoDiseno, catalogoEfectivo: Catalogo, signal: AbortSignal): Promise<Dictamen> {
    const diseno = disenoActual(estado)
    const analisis = analizar(diseno, catalogo)
    if (!analisis.valido) throw new ErrorExperto(`El diseño tiene errores y no se puede revisar la compra: ${analisis.errores[0].mensaje}`)
    const compra = estimarCompra(diseno, analisis.geo, catalogoEfectivo)
    const incumplidos = verificarRequisitos(diseno, estado.requisitos).map((e) => e.mensaje)
    const viabilidad = revisarViabilidad({ diseno, geo: analisis.geo, catalogo: catalogoEfectivo, compra, hallazgos: analisis.hallazgos, incumplidos })
    const base = { firma: firmaDictamen(estado, catalogoEfectivo), comprobaciones: viabilidad.comprobaciones, fecha: ahora() }
    try {
      const r = await deps.llm().dictaminar(
        {
          contexto: construirContexto(estado, catalogo),
          revision: textoRevision(despiece(diseno, analisis.geo), viabilidad.comprobaciones),
          diseno,
          comprobaciones: viabilidad.comprobaciones,
          catalogo: catalogoEfectivo,
        },
        signal,
      )
      return { ...base, veredicto: peor(viabilidad.veredicto, r.valor.veredicto), carpintero: { ...r.valor, origen: r.origen }, error: null }
    } catch (e) {
      if (signal.aborted) throw e
      return { ...base, veredicto: viabilidad.veredicto, carpintero: null, error: e instanceof Error ? e.message : 'El carpintero no contestó.' }
    }
  }

  /** Se guarda sobre el estado vigente: el diseño pudo cambiar mientras el carpintero revisaba. */
  const guardarDictamen = (estado: EstadoDiseno, dictamen: Dictamen) => guardar({ ...estado, dictamen })

  const cargar = () => repositorio.cargar()

  const preguntasPendientes = (estado: EstadoDiseno): Pregunta[] => estado.chat.filter((m) => !m.respondida).flatMap((m) => m.preguntas)

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
    cargar,
    preguntasPendientes,
  }
}

export type CasosDeUso = ReturnType<typeof crearCasosDeUso>
export type { RespuestaAjuste }
