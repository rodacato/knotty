import type { z } from 'zod'
import {
  AdjustmentResponse,
  ReviewResponse,
  InvalidResponse,
  PlanResponse,
  PlanAdjustment,
  type PlanAdjustRequest,
  ReconstructionResponse,
  type Usage,
  type LLMProvider,
  type AdjustmentRequest,
  type ReviewRequest,
  type PhotoReadingRequest,
  type ReconstructionRequest,
} from '../../../ports/LLMProvider'
import type { Catalog } from '../../../domain/materials/catalog'
import { PhotoReading } from '../../../domain/reading/reading'
import { describeProblems, strictSchema } from './jsonSchema'
import { ADJUSTMENT, PLAN_ADJUSTMENT, PURCHASE_REVIEW, SKELETON, promptIdOf, READING, RECONSTRUCTION, systemFor } from './prompts'

export type Content = { kind: 'text'; text: string } | { kind: 'image'; base64: string }

/** All that changes between providers: how to ask for JSON that matches a schema. */
export interface Transport {
  provider: string
  model: string
  completeJSON(system: string, content: Content[], schema: Record<string, unknown>, name: string, signal: AbortSignal): Promise<{ json: unknown; usage: Usage; warnings?: string[] }>
}

const RECONSTRUCTION_SCHEMA = strictSchema(ReconstructionResponse)
const ADJUSTMENT_SCHEMA = strictSchema(AdjustmentResponse)
const REVIEW_SCHEMA = strictSchema(ReviewResponse)
const READING_SCHEMA = strictSchema(PhotoReading)
const PLAN_SCHEMA = strictSchema(PlanResponse)
const PLAN_ADJUSTMENT_SCHEMA = strictSchema(PlanAdjustment)

function validate<T>(schema: z.ZodType<T>, json: unknown): T {
  const r = schema.safeParse(json)
  if (!r.success) throw new InvalidResponse(json, describeProblems(r.error))
  return r.data
}

const correction = (previous: unknown, errors: string): Content => ({
  kind: 'text',
  text: `## Your previous answer could not be used\n${errors}\n\nPrevious answer:\n\`\`\`json\n${JSON.stringify(previous)}\n\`\`\`\nFix it and answer again in full.`,
})

/** What a design or skeleton request carries: measures, the person's words, and the photo reading or the photos themselves. */
function designRequest(s: ReconstructionRequest): Content[] {
  const measures = s.measures
    ? `Furniture measures: width ${s.measures.width} mm, height ${s.measures.height} mm, depth ${s.measures.depth} mm.`
    : 'The person does not know the measures: propose typical ones for that furniture and say so in the explanation.'
  const reading = s.reading
    ? `\nThe photos are not attached: they were already read. This is what they show (relative proportions, columns from left to right and openings from bottom to top):\n${JSON.stringify(s.reading)}`
    : ''
  return [
    {
      kind: 'text',
      text:
        s.photos.length || s.reading
          ? `${measures}${s.notes ? `\nThe person's notes: ${s.notes}` : ''}${reading}`
          : `${measures}\nThere are no photos: design from this description by the person.\nDescription: ${s.notes || '(no description)'}`,
    },
    ...s.photos.flatMap((f, i): Content[] => [
      { kind: 'text', text: `Photo ${i + 1}: ${f.angle}${f.note ? `. The person says: ${f.note}` : ''}` },
      { kind: 'image', base64: f.base64 },
    ]),
  ]
}

const materialsText = (catalog: Catalog) => {
  const boards = catalog.materials.filter((m) => m.type === 'plywood')
  return `one of ${boards.map((m) => `"${m.id}" (${m.thickness} mm)`).join(', ')}`
}

export function createExpert(t: Transport, label: string): LLMProvider {
  return {
    id: t.provider,
    label: label,
    async reconstruct(s: ReconstructionRequest, signal) {
      const content = designRequest(s)
      if (s.correction) content.push(correction(s.correction.previousResponse, s.correction.errors.map((e) => `- ${e.code}: ${e.message}`).join('\n')))
      const { json, usage, warnings } = await t.completeJSON(systemFor(RECONSTRUCTION, s.catalog), content, RECONSTRUCTION_SCHEMA, 'reconstruction', signal)
      return { value: validate(ReconstructionResponse, json), origin: { promptId: promptIdOf(RECONSTRUCTION), provider: t.provider, model: t.model }, usage, warnings }
    },
    async proposeAdjustment(s: AdjustmentRequest, signal) {
      const content: Content[] = [
        { kind: 'text', text: `${s.context}\n\n## The person's request\n${s.request}` },
        ...s.photos.flatMap((f): Content[] => [
          { kind: 'text', text: `Photo sent by the person: ${f.angle}` },
          { kind: 'image', base64: f.base64 },
        ]),
      ]
      if (s.correction) content.push(correction(s.correction.previousResponse, s.correction.errors))
      const { json, usage, warnings } = await t.completeJSON(systemFor(ADJUSTMENT, s.catalog), content, ADJUSTMENT_SCHEMA, 'adjustment', signal)
      return { value: validate(AdjustmentResponse, json), origin: { promptId: promptIdOf(ADJUSTMENT), provider: t.provider, model: t.model }, usage, warnings }
    },
    async planDesign(s: ReconstructionRequest, signal) {
      const content = designRequest(s)
      if (s.correction) content.push(correction(s.correction.previousResponse, s.correction.errors.map((e) => `- ${e.code}: ${e.message}`).join('\n')))
      const { json, usage, warnings } = await t.completeJSON(SKELETON.text.replaceAll('{{materials}}', materialsText(s.catalog)), content, PLAN_SCHEMA, 'skeleton', signal)
      return { value: validate(PlanResponse, json), origin: { promptId: SKELETON.id, provider: t.provider, model: t.model }, usage, warnings }
    },
    async adjustPlan(r: PlanAdjustRequest, signal) {
      const content: Content[] = [{ kind: 'text', text: `${r.context}\n\n## Current plan\n${JSON.stringify(r.plan)}\n\n## The person's request\n${r.request}` }]
      const { json, usage, warnings } = await t.completeJSON(PLAN_ADJUSTMENT.text.replaceAll('{{materials}}', materialsText(r.catalog)), content, PLAN_ADJUSTMENT_SCHEMA, 'plan_adjustment', signal)
      return { value: validate(PlanAdjustment, json), origin: { promptId: PLAN_ADJUSTMENT.id, provider: t.provider, model: t.model }, usage, warnings }
    },
    async readPhoto(r: PhotoReadingRequest, signal) {
      const content: Content[] = [
        { kind: 'text', text: `Photo: ${r.photo.angle}.${r.photo.note ? ` The person says about this photo: ${r.photo.note}` : ''}${r.context ? `\nWhat the person is after: ${r.context}` : ''}` },
        { kind: 'image', base64: r.photo.base64 },
      ]
      const { json, usage, warnings } = await t.completeJSON(READING.text, content, READING_SCHEMA, 'photo_reading', signal)
      return { value: validate(PhotoReading, json), origin: { promptId: READING.id, provider: t.provider, model: t.model }, usage, warnings }
    },
    async reviewPurchase(s: ReviewRequest, signal) {
      const content: Content[] = [{ kind: 'text', text: `${s.context}\n\n${s.review}` }]
      const { json, usage, warnings } = await t.completeJSON(systemFor(PURCHASE_REVIEW, s.catalog), content, REVIEW_SCHEMA, 'purchase_review', signal)
      return { value: validate(ReviewResponse, json), origin: { promptId: promptIdOf(PURCHASE_REVIEW), provider: t.provider, model: t.model }, usage, warnings }
    },
  }
}
