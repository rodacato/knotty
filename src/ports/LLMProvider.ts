import { z } from 'zod'
import { Design, type Dimensions } from '../domain/design/schema'
import type { DesignKind } from '../domain/design/kind'
import { Decision } from '../domain/session/history/history'
import type { Catalog } from '../domain/materials/catalog'
import { Operation } from '../domain/editing/operations/schema'
import { Requirement } from '../domain/checks/requirements/requirements'
import { Question } from '../domain/session/state'
import type { DesignError } from '../domain/design/validation/errors'
import { CabinetPlan } from '../domain/furniture/modules/cabinet'
import { FURNITURE_KINDS, MODULES, type FurnitureKind, type FurniturePlan, type PlanOf } from '../domain/furniture/modules/plan'
import type { PhotoReading } from '../domain/furniture/reading/reading'
import { CarpenterOpinion, type Check } from '../domain/checks/viability/viability'

// What the expert can answer. The same schemas produce the structured output's JSON Schema and validate the answer.

/** The design as the expert writes it: what the furniture is (`kind`, `mattress`) and its finish are Knotty's data, so its schema stays as it was. */
const ExpertDesign = Design.omit({ kind: true, kindSource: true, mattress: true, finish: true })

export const ReconstructionResponse = z.object({
  explanation: z.string().describe('What you saw and how you interpreted it, in 2–4 sentences for the person, in Spanish'),
  design: ExpertDesign,
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

/** The expert names the kind by the field it fills, so its cabinet has no `kind` (every other plan carries its own): what it sees stays as it was. */
const ExpertCabinetPlan = CabinetPlan.omit({ kind: true })
type ExpertPlan<K extends FurnitureKind> = K extends 'cabinet' ? z.infer<typeof ExpertCabinetPlan> : PlanOf<K>
export type ExpertPlans = { [K in FurnitureKind]: ExpertPlan<K> | null }

const planField = <K extends FurnitureKind>(kind: K, describe: (what: string) => string) =>
  (kind === 'cabinet' ? ExpertCabinetPlan : MODULES[kind].schema).nullable().describe(describe(MODULES[kind].expert.what)) as unknown as z.ZodNullable<z.ZodType<ExpertPlan<K>>>

/** One nullable field per module, named by its kind and in the order of MODULES: a new module shows up in the expert's schema by itself. */
const planFields = (describe: (what: string) => string) =>
  Object.fromEntries(FURNITURE_KINDS.map((kind) => [kind, planField(kind, describe)])) as unknown as {
    [K in FurnitureKind]: z.ZodNullable<z.ZodType<ExpertPlan<K>>>
  }

/** Every plan field, as the schema and the prompts name them: "`bed`, `table` or `cabinet`". */
export const planFieldList = () => `${FURNITURE_KINDS.slice(0, -1).map((k) => `\`${k}\``).join(', ')} or \`${FURNITURE_KINDS.at(-1)}\``

/** The plan the expert gave for each kind: when it fills more than one field, the first one in the order of MODULES counts. */
export const expertPlans = (r: ExpertPlans): { [K in FurnitureKind]: PlanOf<K> | null } =>
  Object.fromEntries(FURNITURE_KINDS.map((kind) => [kind, r[kind] && { kind, ...r[kind] }])) as { [K in FurnitureKind]: PlanOf<K> | null }

/** The plan fields of an answer with this plan in its own field and the others null; with none, all null. */
export const answerWith = (plan: FurniturePlan | null): ExpertPlans => Object.fromEntries(FURNITURE_KINDS.map((kind) => [kind, plan?.kind === kind ? plan : null])) as ExpertPlans

/** The skeleton: when the piece of furniture has a module, its plan is enough and Knotty builds every piece. */
const planResponse = <P extends z.ZodRawShape>(plans: P) =>
  z.object({
    explanation: z.string().describe('What you understood and what you decided, in 2–4 sentences for the person, in Spanish'),
    ...plans,
    questions: z.array(Question).describe('What changes the design or the purchase the most; at most 3'),
    requestedPhotos: z.array(z.object({ angle: z.string(), reason: z.string() })),
    requirements: z.array(Requirement),
    suggestions: z.array(z.string()).describe('3 or 4 changes the person could ask for right away, in Spanish, written as they would ask'),
  })

const designedPlan = (what: string) => `The plan if the furniture is ${what}; null if it is not`

/** What the app reads from the skeleton, with every module's field; also what the expert is asked for when the kind is unknown. */
export const PlanResponse = planResponse(planFields(designedPlan))
export type PlanResponse = z.infer<typeof PlanResponse>

/** What the expert is asked for when the kind is known: only its module's field, null if it cannot be built as one. */
export const planResponseFor = (kind: FurnitureKind) =>
  planResponse({ [kind]: planField(kind, designedPlan) }) as unknown as z.ZodType<Omit<PlanResponse, FurnitureKind> & Partial<ExpertPlans>>

const adjustedPlan = (what: string) => `The complete plan with the change, when action is "plan" and the furniture is ${what}; null otherwise`

/** A plan adjustment's fields around its plan, in the order the expert writes them; `fields` names where the plan goes. */
const planAdjustment = <P extends z.ZodRawShape>(fields: string, plans: P) =>
  z.object({
    explanation: z.string().describe('What changes and why, brief, like a carpenter, in Spanish; or the answer if the person only asked'),
    summary: z.string().max(90).describe('For the timeline, in Spanish, in the infinitive: "Agregar un cajón"'),
    action: z.enum(['plan', 'freeform', 'answer']).describe(`plan: the change fits in the plan and goes in ${fields}; freeform: asks for something the plan cannot express; answer: did not ask for a change`),
    ...plans,
    questions: z.array(Question),
    suggestions: z.array(z.string()).describe('2 to 4 next steps the person could ask for, in Spanish'),
    requirements: z.object({ add: z.array(Requirement), remove: z.array(z.string()) }),
    decisions: z.array(Decision),
  })

/** A change asked in the chat on a design that has a plan: the new plan, or why it does not fit in one. What the app reads, with every module's field. */
export const PlanAdjustment = planAdjustment(planFieldList(), planFields(adjustedPlan))
export type PlanAdjustment = z.infer<typeof PlanAdjustment>

/** What the expert is asked for: only the field of the plan it is editing, since a plan never becomes another module's. */
export const planAdjustmentFor = (kind: FurnitureKind) =>
  planAdjustment(`\`${kind}\``, { [kind]: planField(kind, adjustedPlan) }) as unknown as z.ZodType<Omit<PlanAdjustment, FurnitureKind> & Partial<ExpertPlans>>

export interface PlanAdjustRequest {
  /** The plan's context already built by the application: no pieces, the plan goes apart. */
  context: string
  request: string
  plan: FurniturePlan
  catalog: Catalog
  /** On the correction round: the plan answered before and why it did not build. */
  correction: { previousResponse: unknown; errors: string } | null
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
  /** What the person said the furniture is, when they chose it. */
  kind?: DesignKind | null
  /** What the furniture is known to be, from any source: the skeleton asks only for its module. Null or without a module: every module. */
  routeKind?: DesignKind | null
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
