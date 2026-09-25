import { z } from 'zod'
import { Design, type Dimensions } from '../domain/diseno/schema'
import { Decision } from '../domain/historial/history'
import type { Catalog } from '../domain/materiales/catalog'
import { Operation } from '../domain/operaciones/schema'
import { Requirement } from '../domain/requisitos/requirements'
import { Question } from '../domain/sesion/state'
import type { DesignError } from '../domain/validation/errors'
import { BedPlan } from '../domain/modules/bed'
import { CabinetPlan } from '../domain/modules/cabinet'
import { TablePlan } from '../domain/modules/table'
import type { FurniturePlan } from '../domain/modules/plan'
import type { PhotoReading } from '../domain/reading/reading'
import { CarpenterOpinion, type Check } from '../domain/viabilidad/viability'

// Lo que el experto puede contestar. Los mismos esquemas generan el JSON Schema de la salida estructurada y validan la respuesta.

export const RespuestaReconstruccion = z.object({
  explicacion: z.string().describe('Qué viste y cómo lo interpretaste, en 2–4 frases para el usuario'),
  diseno: Design,
  preguntas: z.array(Question).describe('Lo que no se pudo determinar con las fotos; máximo 3'),
  fotosSolicitadas: z.array(z.object({ angulo: z.string(), motivo: z.string() })),
  requisitos: z.array(Requirement),
  sugerencias: z.array(z.string()).describe('3 o 4 cambios que la persona podría pedir enseguida, escritos como ella los pediría'),
})
export type RespuestaReconstruccion = z.infer<typeof RespuestaReconstruccion>

export const RespuestaAjuste = z.object({
  explicacion: z.string().describe('Qué cambia y por qué, en tono de carpintero, breve'),
  resumen: z.string().max(90).describe('Para la línea de tiempo, en infinitivo: "Ensanchar a 90 cm"'),
  operaciones: z.array(Operation),
  preguntas: z.array(Question),
  fotosSolicitadas: z.array(z.object({ angulo: z.string(), motivo: z.string() })).describe('Solo si una foto resolvería una duda que no se puede preguntar en botones'),
  sugerencias: z.array(z.string()).describe('2 a 4 siguientes pasos que la persona podría pedir, escritos como ella los pediría'),
  requisitos: z.object({ agregar: z.array(Requirement), quitar: z.array(z.string()) }),
  decisiones: z.array(Decision),
  aceptaRiesgo: z.array(z.object({ codigo: z.string(), justificacion: z.string() })).describe('Solo si el usuario eligió dejar un crítico bajo su riesgo'),
})
export type RespuestaAjuste = z.infer<typeof RespuestaAjuste>

/** La opinión del carpintero; vive en el dominio porque se guarda con el diseño. */
export const RespuestaDictamen = CarpenterOpinion
export type RespuestaDictamen = z.infer<typeof RespuestaDictamen>

export interface SolicitudDictamen {
  /** El contexto del diseño ya armado por la aplicación. */
  contexto: string
  /** La lista de corte y las comprobaciones de cuentas, en texto. */
  revision: string
  diseno: Design
  /** Las comprobaciones de cuentas, para quien no lee texto (el simulado). */
  comprobaciones: Check[]
  catalogo: Catalog
}

/** The skeleton: when the piece of furniture is a cabinet, its plan is enough and Knotty builds every piece. */
export const RespuestaPlan = z.object({
  explicacion: z.string().describe('Qué entendiste y qué decidiste, en 2–4 frases para la persona'),
  cabinet: CabinetPlan.nullable().describe('El plan si el mueble es un gabinete (caja con columnas y huecos); null si no lo es'),
  bed: BedPlan.nullable().describe('La ficha si el mueble es una cama (base con o sin cajones y cabecera); null si no lo es'),
  table: TablePlan.nullable().describe('La ficha si el mueble es una mesa o un escritorio; null si no lo es'),
  preguntas: z.array(Question).describe('Lo que más cambia el diseño o la compra; máximo 3'),
  fotosSolicitadas: z.array(z.object({ angulo: z.string(), motivo: z.string() })),
  requisitos: z.array(Requirement),
  sugerencias: z.array(z.string()).describe('3 o 4 cambios que la persona podría pedir enseguida, escritos como ella los pediría'),
})
export type RespuestaPlan = z.infer<typeof RespuestaPlan>

/** A change asked in the chat on a design that has a plan: the new plan, or why it does not fit in one. */
export const PlanAdjustment = z.object({
  explicacion: z.string().describe('Qué cambia y por qué, breve, como carpintero; o la respuesta si la persona solo preguntó'),
  resumen: z.string().max(90).describe('Para la línea de tiempo, en infinitivo: "Agregar un cajón"'),
  action: z.enum(['plan', 'freeform', 'answer']).describe('plan: el cambio cabe en la ficha y va en `plan`; freeform: pide algo que la ficha no expresa; answer: no pidió un cambio'),
  plan: CabinetPlan.nullable().describe('La ficha completa del gabinete con el cambio, cuando action es "plan" y el mueble es un gabinete; null en otro caso'),
  bed: BedPlan.nullable().describe('La ficha completa de la cama con el cambio, cuando action es "plan" y el mueble es una cama; null en otro caso'),
  table: TablePlan.nullable().describe('La ficha completa de la mesa o escritorio con el cambio, cuando action es "plan" y el mueble es una mesa; null en otro caso'),
  preguntas: z.array(Question),
  sugerencias: z.array(z.string()).describe('2 a 4 siguientes pasos que la persona podría pedir'),
  requisitos: z.object({ agregar: z.array(Requirement), quitar: z.array(z.string()) }),
  decisiones: z.array(Decision),
})
export type PlanAdjustment = z.infer<typeof PlanAdjustment>

export interface PlanAdjustRequest {
  /** The design context already built by the application. */
  contexto: string
  peticion: string
  plan: FurniturePlan
  catalogo: Catalog
}

export interface Foto {
  angulo: string
  /** JPEG en base64, sin el prefijo data:. */
  base64: string
  /** What the person says about this photo, if anything. */
  note?: string
}

export interface PhotoReadingRequest {
  photo: Foto
  /** The person's general description, so the reading knows what to look for. */
  context: string
}

export interface SolicitudReconstruccion {
  /** null: la persona no las sabe y el experto las estima. */
  medidas: Dimensions | null
  fotos: Foto[]
  notas: string
  /** What was read from the photos beforehand; when present, the photos are not sent again. */
  lectura: PhotoReading | null
  catalogo: Catalog
  /** En un reintento: lo que salió mal con la respuesta anterior. */
  correccion: { respuestaAnterior: unknown; errores: DesignError[] } | null
}

export interface SolicitudAjuste {
  /** El contexto ya armado y compactado por la aplicación. */
  contexto: string
  peticion: string
  /** El diseño vigente, para quien necesite leerlo sin parsear el contexto (el simulado). */
  diseno: Design
  /** Operaciones de la propuesta sin aplicar, si la hay; también van descritas en el contexto. */
  propuesta: Operation[] | null
  /** Fotos que la persona manda con este pedido, casi siempre porque el experto las pidió. */
  fotos: Foto[]
  catalogo: Catalog
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
  readPhoto(request: PhotoReadingRequest, signal: AbortSignal): Promise<Respuesta<PhotoReading>>
  /** Null when the provider has no skeleton step: the full design is asked for directly. */
  planDesign: ((request: SolicitudReconstruccion, signal: AbortSignal) => Promise<Respuesta<RespuestaPlan>>) | null
  /** Null when the provider does not edit plans: chat changes go piece by piece. */
  adjustPlan: ((request: PlanAdjustRequest, signal: AbortSignal) => Promise<Respuesta<PlanAdjustment>>) | null
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
