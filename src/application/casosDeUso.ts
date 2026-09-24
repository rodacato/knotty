import { analizar } from '../domain/analisis'
import type { Dimensiones, Diseno } from '../domain/diseno/esquema'
import { normalizar } from '../domain/diseno/normalizador'
import type { Hallazgo } from '../domain/estructura/hallazgo'
import { criticosNuevos } from '../domain/estructura/motor'
import { abreviar, actualizarDecisiones, podarVersiones, type Decision, type Origen } from '../domain/historial/historial'
import type { Catalogo } from '../domain/materiales/catalogo'
import { aplicar } from '../domain/operaciones/aplicar'
import type { Operacion } from '../domain/operaciones/esquema'
import { actualizarRequisitos, type Requisito } from '../domain/requisitos/requisitos'
import { disenoActual, type EstadoDiseno, type Mensaje, type Miniatura, type Pregunta } from '../domain/sesion/estado'
import type { ErrorDiseno } from '../domain/validacion/errores'
import type { DesignRepository } from '../ports/DesignRepository'
import { RespuestaInvalida, type Foto, type LLMProvider, type RespuestaAjuste } from '../ports/LLMProvider'
import { construirContexto } from './contexto'

export type Etapa = 'mirando-fotos' | 'proponiendo' | 'revisando' | 'estructura' | 'corrigiendo'
export type AlAvanzar = (etapa: Etapa, intento: number) => void

export interface Dependencias {
  llm: () => LLMProvider
  catalogo: Catalogo
  repositorio: DesignRepository
  ahora?: () => string
  nuevoId?: () => string
}

const INTENTOS = 3
const listarErrores = (errores: ErrorDiseno[]) => errores.map((e) => `- ${e.codigo}: ${e.mensaje}${e.datos ? ` ${JSON.stringify(e.datos)}` : ''}`).join('\n')

/** El experto no logró algo y lo dice; el mensaje es para el usuario. */
export class ErrorExperto extends Error {}

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
    ...extra,
  })

  const guardar = (estado: EstadoDiseno) => {
    repositorio.guardar(estado)
    return estado
  }

  function conVersion(estado: EstadoDiseno, diseno: Diseno, datos: { resumen: string; motivo: string; operaciones: Operacion[]; origen: Origen | null }): EstadoDiseno {
    const n = Math.max(...estado.versiones.map((v) => v.n)) + 1
    const versiones = podarVersiones([...estado.versiones, { n, diseno, resumen: datos.resumen, motivo: datos.motivo, operaciones: datos.operaciones.map(abreviar), fecha: ahora(), origen: datos.origen }])
    return { ...estado, versiones, actual: n, propuesta: null, chat: estado.chat.map((m) => (m.propuesta === 'pendiente' ? { ...m, propuesta: 'descartada' as const } : m)) }
  }

  const hallazgosDe = (diseno: Diseno, requisitos: Requisito[]): Hallazgo[] => {
    const a = analizar(diseno, catalogo, requisitos)
    return a.valido ? a.hallazgos : []
  }

  async function reconstruir(
    entrada: { medidas: Dimensiones; fotos: Foto[]; miniaturas: Miniatura[]; notas: string },
    signal: AbortSignal,
    alAvanzar: AlAvanzar = () => {},
  ): Promise<EstadoDiseno> {
    const llm = deps.llm()
    let correccion: { respuestaAnterior: unknown; errores: ErrorDiseno[] } | null = null
    for (let intento = 0; intento < INTENTOS; intento++) {
      alAvanzar(intento ? 'corrigiendo' : 'mirando-fotos', intento)
      let respuesta
      try {
        respuesta = await llm.reconstruir({ medidas: entrada.medidas, fotos: entrada.fotos, notas: entrada.notas, catalogo, correccion }, signal)
      } catch (e) {
        if (!(e instanceof RespuestaInvalida)) throw e
        correccion = { respuestaAnterior: e.respuesta, errores: [{ codigo: 'E_ESQUEMA', mensaje: e.problemas }] }
        continue
      }
      alAvanzar('revisando', intento)
      const r = respuesta.valor
      const diseno = normalizar({ ...r.diseno, dimensiones: entrada.medidas }, catalogo)
      const analisis = analizar(diseno, catalogo, r.requisitos)
      if (!analisis.valido) {
        correccion = { respuestaAnterior: r, errores: analisis.errores }
        continue
      }
      alAvanzar('estructura', intento)
      const pedidas = r.fotosSolicitadas.map((f) => `📷 ${f.angulo}: ${f.motivo}`)
      const texto = [r.explicacion, ...pedidas].join('\n\n')
      return guardar({
        formato: 1,
        medidas: entrada.medidas,
        versiones: [{ n: 1, diseno, resumen: 'Reconstrucción desde fotos', motivo: entrada.notas || 'Fotos y medidas', operaciones: [], fecha: ahora(), origen: respuesta.origen }],
        actual: 1,
        requisitos: r.requisitos,
        decisiones: [],
        chat: [mensaje('experto', texto, { preguntas: r.preguntas.slice(0, 3), version: 1 })],
        miniaturas: entrada.miniaturas,
        propuesta: null,
      })
    }
    throw new ErrorExperto('No logré armar un modelo coherente con estas fotos. Prueba con otra toma de frente y una de 3/4 con buena luz.')
  }

  async function ajustar(estado: EstadoDiseno, peticion: string, signal: AbortSignal, alAvanzar: AlAvanzar = () => {}, respondeA: string | null = null): Promise<EstadoDiseno> {
    const conPeticion: EstadoDiseno = {
      ...estado,
      chat: [...estado.chat.map((m) => (m.id === respondeA ? { ...m, respondida: true } : m)), mensaje('usuario', peticion)],
    }
    guardar(conPeticion)
    const llm = deps.llm()
    const diseno = disenoActual(conPeticion)
    const antes = hallazgosDe(diseno, conPeticion.requisitos)
    const contexto = construirContexto(conPeticion, catalogo)
    const responder = (texto: string, extra: Partial<Mensaje> = {}, base: EstadoDiseno = conPeticion) => guardar({ ...base, chat: [...base.chat, mensaje('experto', texto, extra)] })

    let correccion: { respuestaAnterior: unknown; errores: string } | null = null
    let criticosRevisados = false
    let ultimoError = ''
    try {
      for (let intento = 0; intento < INTENTOS; intento++) {
        alAvanzar(intento ? 'corrigiendo' : 'proponiendo', intento)
        let respuesta
        try {
          respuesta = await llm.proponerAjuste({ contexto, peticion, diseno, catalogo, correccion }, signal)
        } catch (e) {
          if (!(e instanceof RespuestaInvalida)) throw e
          correccion = { respuestaAnterior: e.respuesta, errores: e.problemas }
          ultimoError = 'la respuesta no tenía el formato esperado'
          continue
        }
        const r = respuesta.valor
        const requisitos = actualizarRequisitos(conPeticion.requisitos, r.requisitos)
        const decisiones = actualizarDecisiones(conPeticion.decisiones, r.decisiones)
        const base = { ...conPeticion, requisitos, decisiones }
        if (!r.operaciones.length) return responder(r.explicacion, { preguntas: r.preguntas }, base)

        alAvanzar('revisando', intento)
        const aplicado = aplicar(diseno, r.operaciones, catalogo)
        const nuevo = aplicado.ok ? normalizar(aplicado.valor.diseno, catalogo) : null
        const analisis = nuevo ? analizar(nuevo, catalogo, requisitos) : null
        if (!aplicado.ok || !nuevo || !analisis?.valido) {
          const errores = !aplicado.ok ? aplicado.errores : analisis && !analisis.valido ? analisis.errores : []
          correccion = { respuestaAnterior: r, errores: listarErrores(errores) }
          ultimoError = errores[0]?.mensaje ?? 'el cambio no se pudo aplicar'
          continue
        }

        alAvanzar('estructura', intento)
        const aceptados = new Set(r.aceptaRiesgo.map((a) => a.codigo))
        const criticos = criticosNuevos(antes, analisis.hallazgos).filter((h) => !aceptados.has(h.codigo))
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
          return responder(r.explicacion, { preguntas: r.preguntas, propuesta: 'pendiente' }, pendiente)
        }

        const conCambio = conVersion(base, nuevo, { resumen: r.resumen, motivo: peticion, operaciones: r.operaciones, origen: respuesta.origen })
        const avisos = aplicado.valor.avisos.map((a) => a.mensaje)
        return responder([r.explicacion, ...avisos].join('\n\n'), { preguntas: r.preguntas, version: conCambio.actual }, conCambio)
      }
      return responder(`No logré hacer ese cambio sin romper el diseño (${ultimoError}), así que no apliqué nada. ¿Lo intentamos de otra forma?`, { error: true })
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
        ...estado.chat.map((m) => (m.propuesta === 'pendiente' ? { ...m, propuesta: 'aplicada' as const } : m)),
        mensaje('experto', `Listo, apliqué "${p.resumen}" como lo pediste. Los puntos críticos siguen marcados en la revisión.`, { version: conCambio.actual }),
      ],
    })
  }

  function descartarPropuesta(estado: EstadoDiseno): EstadoDiseno {
    return guardar({ ...estado, propuesta: null, chat: estado.chat.map((m) => (m.propuesta === 'pendiente' ? { ...m, propuesta: 'descartada' as const } : m)) })
  }

  function volverAVersion(estado: EstadoDiseno, n: number): EstadoDiseno {
    const destino = estado.versiones.find((v) => v.n === n)
    if (!destino) return estado
    const conCambio = conVersion(estado, destino.diseno, { resumen: `Volver a v${n}`, motivo: `Volver a v${n}: ${destino.resumen}`, operaciones: [], origen: null })
    return guardar({ ...conCambio, chat: [...conCambio.chat, mensaje('experto', `Regresé al diseño de la v${n} (${destino.resumen}).`, { version: conCambio.actual })] })
  }

  function nuevoDiseno() {
    repositorio.borrar()
  }

  const cargar = () => repositorio.cargar()

  const preguntasPendientes = (estado: EstadoDiseno): Pregunta[] => estado.chat.filter((m) => !m.respondida).flatMap((m) => m.preguntas)

  return { reconstruir, ajustar, aplicarPropuesta, descartarPropuesta, volverAVersion, nuevoDiseno, cargar, preguntasPendientes }
}

export type CasosDeUso = ReturnType<typeof crearCasosDeUso>
export type { RespuestaAjuste }
