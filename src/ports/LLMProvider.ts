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

// What the expert can answer. The same schemas produce the structured output's JSON Schema and validate the answer.

export const ReconstructionResponse = z.object({
  explicacion: z.string().describe('Qué viste y cómo lo interpretaste, en 2–4 frases para el usuario'),
  diseno: Design,
  preguntas: z.array(Question).describe('Lo que no se pudo determinar con las fotos; máximo 3'),
  fotosSolicitadas: z.array(z.object({ angulo: z.string(), motivo: z.string() })),
  requisitos: z.array(Requirement),
  sugerencias: z.array(z.string()).describe('3 o 4 cambios que la persona podría pedir enseguida, escritos como ella los pediría'),
})
export type ReconstructionResponse = z.infer<typeof ReconstructionResponse>

export const AdjustmentResponse = z.object({
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
export type AdjustmentResponse = z.infer<typeof AdjustmentResponse>

/** The carpenter's opinion; it lives in the domain because it is saved with the design. */
export const ReviewResponse = CarpenterOpinion
export type ReviewResponse = z.infer<typeof ReviewResponse>

export interface ReviewRequest {
  /** The design's context, already put together by the application. */
  context: string
  /** The cut list and the arithmetic checks, as text. */
  review: string
  design: Design
  /** The arithmetic checks, for whoever does not read text (the simulated expert). */
  comprobaciones: Check[]
  catalog: Catalog
}

/** The skeleton: when the piece of furniture is a cabinet, its plan is enough and Knotty builds every piece. */
export const PlanResponse = z.object({
  explicacion: z.string().describe('Qué entendiste y qué decidiste, en 2–4 frases para la persona'),
  cabinet: CabinetPlan.nullable().describe('El plan si el mueble es un gabinete (caja con columnas y huecos); null si no lo es'),
  bed: BedPlan.nullable().describe('La ficha si el mueble es una cama (base con o sin cajones y cabecera); null si no lo es'),
  table: TablePlan.nullable().describe('La ficha si el mueble es una mesa o un escritorio; null si no lo es'),
  preguntas: z.array(Question).describe('Lo que más cambia el diseño o la compra; máximo 3'),
  fotosSolicitadas: z.array(z.object({ angulo: z.string(), motivo: z.string() })),
  requisitos: z.array(Requirement),
  sugerencias: z.array(z.string()).describe('3 o 4 cambios que la persona podría pedir enseguida, escritos como ella los pediría'),
})
export type PlanResponse = z.infer<typeof PlanResponse>

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
  context: string
  request: string
  plan: FurniturePlan
  catalog: Catalog
}

export interface Photo {
  angle: string
  /** JPEG in base64, without the data: prefix. */
  base64: string
  /** What the person says about this photo, if anything. */
  note?: string
}

export interface PhotoReadingRequest {
  photo: Photo
  /** The person's general description, so the reading knows what to look for. */
  context: string
}

export interface ReconstructionRequest {
  /** null: the person does not know them and the expert estimates them. */
  measures: Dimensions | null
  photos: Photo[]
  notes: string
  /** What was read from the photos beforehand; when present, the photos are not sent again. */
  reading: PhotoReading | null
  catalog: Catalog
  /** On a retry: what went wrong with the previous answer. */
  correction: { previousResponse: unknown; errors: DesignError[] } | null
}

export interface AdjustmentRequest {
  /** The context, already put together and compacted by the application. */
  context: string
  request: string
  /** The current design, for whoever needs it without parsing the context (the simulated expert). */
  design: Design
  /** Operations of the pending proposal, if any; they are also described in the context. */
  proposal: Operation[] | null
  /** Photos the person sends with this request, almost always because the expert asked for them. */
  photos: Photo[]
  catalog: Catalog
  correction: { previousResponse: unknown; errors: string } | null
}

export interface Usage {
  inputTokens?: number
  outputTokens?: number
}

export interface ExpertResponse<T> {
  value: T
  origin: { promptId: string; proveedor: string; modelo: string }
  usage: Usage
  /** What the provider could not do and the person should know, for example that it did not see the photos. */
  warnings?: string[]
}

export interface LLMProvider {
  id: string
  label: string
  reconstruct(request: ReconstructionRequest, signal: AbortSignal): Promise<ExpertResponse<ReconstructionResponse>>
  proposeAdjustment(request: AdjustmentRequest, signal: AbortSignal): Promise<ExpertResponse<AdjustmentResponse>>
  reviewPurchase(request: ReviewRequest, signal: AbortSignal): Promise<ExpertResponse<ReviewResponse>>
  readPhoto(request: PhotoReadingRequest, signal: AbortSignal): Promise<ExpertResponse<PhotoReading>>
  /** Null when the provider has no skeleton step: the full design is asked for directly. */
  planDesign: ((request: ReconstructionRequest, signal: AbortSignal) => Promise<ExpertResponse<PlanResponse>>) | null
  /** Null when the provider does not edit plans: chat changes go piece by piece. */
  adjustPlan: ((request: PlanAdjustRequest, signal: AbortSignal) => Promise<ExpertResponse<PlanAdjustment>>) | null
}

/** The provider answered something that does not match the schema; the text goes back to the model to correct it. */
export class InvalidResponse extends Error {
  constructor(
    readonly response: unknown,
    readonly problems: string,
  ) {
    super('El experto contestó en un formato que no se pudo leer.')
  }
}
