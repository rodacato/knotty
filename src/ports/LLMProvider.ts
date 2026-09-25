import { z } from 'zod'
import { Diseno, type Dimensiones } from '../domain/diseno/esquema'
import { Decision } from '../domain/historial/historial'
import type { Catalogo } from '../domain/materiales/catalogo'
import { Operacion } from '../domain/operaciones/esquema'
import { Requisito } from '../domain/requisitos/requisitos'
import { Pregunta } from '../domain/sesion/estado'
import type { ErrorDiseno } from '../domain/validacion/errores'
import { OpinionCarpintero, type Comprobacion } from '../domain/viabilidad/viabilidad'

// Lo que el experto puede contestar. Los mismos esquemas generan el JSON Schema de la salida estructurada y validan la respuesta.

export const RespuestaReconstruccion = z.object({
  explicacion: z.string().describe('Qué viste y cómo lo interpretaste, en 2–4 frases para el usuario'),
  diseno: Diseno,
  preguntas: z.array(Pregunta).describe('Lo que no se pudo determinar con las fotos; máximo 3'),
  fotosSolicitadas: z.array(z.object({ angulo: z.string(), motivo: z.string() })),
  requisitos: z.array(Requisito),
  sugerencias: z.array(z.string()).describe('3 o 4 cambios que la persona podría pedir enseguida, escritos como ella los pediría'),
})
export type RespuestaReconstruccion = z.infer<typeof RespuestaReconstruccion>

export const RespuestaAjuste = z.object({
  explicacion: z.string().describe('Qué cambia y por qué, en tono de carpintero, breve'),
  resumen: z.string().max(90).describe('Para la línea de tiempo, en infinitivo: "Ensanchar a 90 cm"'),
  operaciones: z.array(Operacion),
  preguntas: z.array(Pregunta),
  fotosSolicitadas: z.array(z.object({ angulo: z.string(), motivo: z.string() })).describe('Solo si una foto resolvería una duda que no se puede preguntar en botones'),
  sugerencias: z.array(z.string()).describe('2 a 4 siguientes pasos que la persona podría pedir, escritos como ella los pediría'),
  requisitos: z.object({ agregar: z.array(Requisito), quitar: z.array(z.string()) }),
  decisiones: z.array(Decision),
  aceptaRiesgo: z.array(z.object({ codigo: z.string(), justificacion: z.string() })).describe('Solo si el usuario eligió dejar un crítico bajo su riesgo'),
})
export type RespuestaAjuste = z.infer<typeof RespuestaAjuste>

/** La opinión del carpintero; vive en el dominio porque se guarda con el diseño. */
export const RespuestaDictamen = OpinionCarpintero
export type RespuestaDictamen = z.infer<typeof RespuestaDictamen>

export interface SolicitudDictamen {
  /** El contexto del diseño ya armado por la aplicación. */
  contexto: string
  /** La lista de corte y las comprobaciones de cuentas, en texto. */
  revision: string
  diseno: Diseno
  /** Las comprobaciones de cuentas, para quien no lee texto (el simulado). */
  comprobaciones: Comprobacion[]
  catalogo: Catalogo
}

export interface Foto {
  angulo: string
  /** JPEG en base64, sin el prefijo data:. */
  base64: string
}

export interface SolicitudReconstruccion {
  /** null: la persona no las sabe y el experto las estima. */
  medidas: Dimensiones | null
  fotos: Foto[]
  notas: string
  catalogo: Catalogo
  /** En un reintento: lo que salió mal con la respuesta anterior. */
  correccion: { respuestaAnterior: unknown; errores: ErrorDiseno[] } | null
}

export interface SolicitudAjuste {
  /** El contexto ya armado y compactado por la aplicación. */
  contexto: string
  peticion: string
  /** El diseño vigente, para quien necesite leerlo sin parsear el contexto (el simulado). */
  diseno: Diseno
  /** Operaciones de la propuesta sin aplicar, si la hay; también van descritas en el contexto. */
  propuesta: Operacion[] | null
  /** Fotos que la persona manda con este pedido, casi siempre porque el experto las pidió. */
  fotos: Foto[]
  catalogo: Catalogo
  correccion: { respuestaAnterior: unknown; errores: string } | null
}

export interface Consumo {
  tokensEntrada?: number
  tokensSalida?: number
}

export interface Respuesta<T> {
  valor: T
  origen: { promptId: string; proveedor: string; modelo: string }
  consumo: Consumo
  /** Lo que el proveedor no pudo hacer y la persona debe saber, por ejemplo que no vio las fotos. */
  avisos?: string[]
}

export interface LLMProvider {
  id: string
  etiqueta: string
  reconstruir(solicitud: SolicitudReconstruccion, signal: AbortSignal): Promise<Respuesta<RespuestaReconstruccion>>
  proponerAjuste(solicitud: SolicitudAjuste, signal: AbortSignal): Promise<Respuesta<RespuestaAjuste>>
  dictaminar(solicitud: SolicitudDictamen, signal: AbortSignal): Promise<Respuesta<RespuestaDictamen>>
}

/** El proveedor contestó algo que no cumple el esquema; el texto va de vuelta al LLM para que corrija. */
export class RespuestaInvalida extends Error {
  constructor(
    readonly respuesta: unknown,
    readonly problemas: string,
  ) {
    super('El experto contestó en un formato que no se pudo leer.')
  }
}
