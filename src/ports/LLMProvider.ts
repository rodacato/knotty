import { z } from 'zod'
import { Design, type Dimensions } from '../domain/design/schema'
import { Decision } from '../domain/history/history'
import type { Catalog } from '../domain/materials/catalog'
import { Operation } from '../domain/operations/schema'
import { Requirement } from '../domain/requirements/requirements'
import { Question } from '../domain/session/state'
import type { DesignError } from '../domain/validation/errors'
import { BedPlan } from '../domain/modules/bed'
import { CabinetPlan } from '../domain/modules/cabinet'
import { TablePlan } from '../domain/modules/table'
import type { FurniturePlan } from '../domain/modules/plan'
import type { PhotoReading } from '../domain/reading/reading'
import { CarpenterOpinion, type Check } from '../domain/viability/viability'

// What the expert can answer. The same schemas produce the structured output's JSON Schema and validate the answer.

export const ReconstructionResponse = z.object({
  explanation: z.string().describe('What you saw and how you interpreted it, in 2–4 sentences for the person, in Spanish'),
  design: Design,
  questions: z.array(Question).describe('What could not be determined from the photos; at most 3'),
  requestedPhotos: z.array(z.object({ angle: z.string(), reason: z.string() })),
  requirements: z.array(Requirement),
  suggestions: z.array(z.string()).describe('3 or 4 changes the person could ask for right away, in Spanish, written as they would ask'),
})
export type ReconstructionResponse = z.infer<typeof ReconstructionResponse>

export const AdjustmentResponse = z.object({
  explanation: z.string().describe('What changes and why, in a carpenter tone, brief, in Spanish'),
  summary: z.string().max(90).describe('For the timeline, in Spanish, in the infinitive: "Ensanchar a 90 cm"'),
  operations: z.array(Operation),
  questions: z.array(Question),
  requestedPhotos: z.array(z.object({ angle: z.string(), reason: z.string() })).describe('Only if a photo would settle a doubt that cannot be asked with buttons'),
  suggestions: z.array(z.string()).describe('2 to 4 next steps the person could ask for, in Spanish, written as they would ask'),
  requirements: z.object({ add: z.array(Requirement), remove: z.array(z.string()) }),
  decisions: z.array(Decision),
  acceptedRisks: z.array(z.object({ code: z.string(), justification: z.string() })).describe('Only if the person chose to leave a critical finding at their own risk'),
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
  checks: Check[]
  catalog: Catalog
}

/** The skeleton: when the piece of furniture is a cabinet, its plan is enough and Knotty builds every piece. */
export const PlanResponse = z.object({
  explanation: z.string().describe('What you understood and what you decided, in 2–4 sentences for the person, in Spanish'),
  cabinet: CabinetPlan.nullable().describe('The plan if the furniture is a cabinet (a box with columns and openings); null if it is not'),
  bed: BedPlan.nullable().describe('The ficha if the furniture is a bed (a base with or without drawers, and a headboard); null if it is not'),
  table: TablePlan.nullable().describe('The ficha if the furniture is a table or a desk; null if it is not'),
  questions: z.array(Question).describe('What changes the design or the purchase the most; at most 3'),
  requestedPhotos: z.array(z.object({ angle: z.string(), reason: z.string() })),
  requirements: z.array(Requirement),
  suggestions: z.array(z.string()).describe('3 or 4 changes the person could ask for right away, in Spanish, written as they would ask'),
})
export type PlanResponse = z.infer<typeof PlanResponse>

/** A change asked in the chat on a design that has a plan: the new plan, or why it does not fit in one. */
export const PlanAdjustment = z.object({
  explanation: z.string().describe('What changes and why, brief, like a carpenter, in Spanish; or the answer if the person only asked'),
  summary: z.string().max(90).describe('For the timeline, in Spanish, in the infinitive: "Agregar un cajón"'),
  action: z.enum(['plan', 'freeform', 'answer']).describe('plan: the change fits in the ficha and goes in `cabinet`, `bed` or `table`; freeform: asks for something the ficha cannot express; answer: did not ask for a change'),
  cabinet: CabinetPlan.nullable().describe('The complete cabinet ficha with the change, when action is "plan" and the furniture is a cabinet; null otherwise'),
  bed: BedPlan.nullable().describe('The complete bed ficha with the change, when action is "plan" and the furniture is a bed; null otherwise'),
  table: TablePlan.nullable().describe('The complete table or desk ficha with the change, when action is "plan" and the furniture is a table; null otherwise'),
  questions: z.array(Question),
  suggestions: z.array(z.string()).describe('2 to 4 next steps the person could ask for, in Spanish'),
  requirements: z.object({ add: z.array(Requirement), remove: z.array(z.string()) }),
  decisions: z.array(Decision),
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
  origin: { promptId: string; provider: string; model: string }
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
