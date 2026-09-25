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
import type { Catalog } from '../../../domain/materiales/catalog'
import { PhotoReading } from '../../../domain/reading/reading'
import { describeProblems, strictSchema } from './jsonSchema'
import { ADJUSTMENT, PLAN_ADJUSTMENT, PURCHASE_REVIEW, SKELETON, promptIdOf, READING, RECONSTRUCTION, systemFor } from './prompts'

export type Content = { kind: 'texto'; text: string } | { kind: 'imagen'; base64: string }

/** All that changes between providers: how to ask for JSON that matches a schema. */
export interface Transport {
  provider: string
  modelo: string
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
  kind: 'texto',
  text: `## Tu respuesta anterior no se pudo usar\n${errors}\n\nRespuesta anterior:\n\`\`\`json\n${JSON.stringify(previous)}\n\`\`\`\nCorrígela y responde completa de nuevo.`,
})

/** What a design or skeleton request carries: measures, the person's words, and the photo reading or the photos themselves. */
function designRequest(s: ReconstructionRequest): Content[] {
  const measures = s.measures
    ? `Medidas del mueble: ancho ${s.measures.ancho} mm, alto ${s.measures.alto} mm, fondo ${s.measures.fondo} mm.`
    : 'La persona no sabe las medidas: propón unas típicas para ese mueble y dilo en la explicación.'
  const reading = s.reading
    ? `\nNo te mando las fotos: ya se leyeron. Esto es lo que se ve en ellas (proporciones relativas, columnas de izquierda a derecha y huecos de abajo hacia arriba):\n${JSON.stringify(s.reading)}`
    : ''
  return [
    {
      kind: 'texto',
      text:
        s.photos.length || s.reading
          ? `${measures}${s.notes ? `\nNotas de la persona: ${s.notes}` : ''}${reading}`
          : `${measures}\nNo hay fotos: diseña a partir de esta descripción de la persona.\nDescripción: ${s.notes || '(sin descripción)'}`,
    },
    ...s.photos.flatMap((f, i): Content[] => [
      { kind: 'texto', text: `Foto ${i + 1}: ${f.angle}${f.note ? `. La persona dice: ${f.note}` : ''}` },
      { kind: 'imagen', base64: f.base64 },
    ]),
  ]
}

const materialsText = (catalog: Catalog) => {
  const boards = catalog.materiales.filter((m) => m.tipo === 'triplay')
  return `uno de ${boards.map((m) => `"${m.id}" (${m.espesor} mm)`).join(', ')}`
}

export function createExpert(t: Transport, label: string): LLMProvider {
  return {
    id: t.provider,
    label: label,
    async reconstruct(s: ReconstructionRequest, signal) {
      const content = designRequest(s)
      if (s.correction) content.push(correction(s.correction.previousResponse, s.correction.errors.map((e) => `- ${e.code}: ${e.message}`).join('\n')))
      const { json, usage: usage, warnings: warnings } = await t.completeJSON(systemFor(RECONSTRUCTION, s.catalog), content, RECONSTRUCTION_SCHEMA, 'reconstruccion', signal)
      return { value: validate(ReconstructionResponse, json), origin: { promptId: promptIdOf(RECONSTRUCTION), proveedor: t.provider, modelo: t.modelo }, usage: usage, warnings: warnings }
    },
    async proposeAdjustment(s: AdjustmentRequest, signal) {
      const content: Content[] = [
        { kind: 'texto', text: `${s.context}\n\n## Pedido de la persona\n${s.request}` },
        ...s.photos.flatMap((f): Content[] => [
          { kind: 'texto', text: `Foto que manda la persona: ${f.angle}` },
          { kind: 'imagen', base64: f.base64 },
        ]),
      ]
      if (s.correction) content.push(correction(s.correction.previousResponse, s.correction.errors))
      const { json, usage: usage, warnings: warnings } = await t.completeJSON(systemFor(ADJUSTMENT, s.catalog), content, ADJUSTMENT_SCHEMA, 'ajuste', signal)
      return { value: validate(AdjustmentResponse, json), origin: { promptId: promptIdOf(ADJUSTMENT), proveedor: t.provider, modelo: t.modelo }, usage: usage, warnings: warnings }
    },
    async planDesign(s: ReconstructionRequest, signal) {
      const content = designRequest(s)
      if (s.correction) content.push(correction(s.correction.previousResponse, s.correction.errors.map((e) => `- ${e.code}: ${e.message}`).join('\n')))
      const { json, usage: usage, warnings: warnings } = await t.completeJSON(SKELETON.text.replaceAll('{{materiales}}', materialsText(s.catalog)), content, PLAN_SCHEMA, 'esqueleto', signal)
      return { value: validate(PlanResponse, json), origin: { promptId: SKELETON.id, proveedor: t.provider, modelo: t.modelo }, usage: usage, warnings: warnings }
    },
    async adjustPlan(r: PlanAdjustRequest, signal) {
      const content: Content[] = [{ kind: 'texto', text: `${r.context}\n\n## Ficha actual\n${JSON.stringify(r.plan)}\n\n## Pedido de la persona\n${r.request}` }]
      const { json, usage: usage, warnings: warnings } = await t.completeJSON(PLAN_ADJUSTMENT.text.replaceAll('{{materiales}}', materialsText(r.catalog)), content, PLAN_ADJUSTMENT_SCHEMA, 'ajuste_ficha', signal)
      return { value: validate(PlanAdjustment, json), origin: { promptId: PLAN_ADJUSTMENT.id, proveedor: t.provider, modelo: t.modelo }, usage: usage, warnings: warnings }
    },
    async readPhoto(r: PhotoReadingRequest, signal) {
      const content: Content[] = [
        { kind: 'texto', text: `Foto: ${r.photo.angle}.${r.photo.note ? ` La persona dice de esta foto: ${r.photo.note}` : ''}${r.context ? `\nLo que la persona busca: ${r.context}` : ''}` },
        { kind: 'imagen', base64: r.photo.base64 },
      ]
      const { json, usage: usage, warnings: warnings } = await t.completeJSON(READING.text, content, READING_SCHEMA, 'lectura', signal)
      return { value: validate(PhotoReading, json), origin: { promptId: READING.id, proveedor: t.provider, modelo: t.modelo }, usage: usage, warnings: warnings }
    },
    async reviewPurchase(s: ReviewRequest, signal) {
      const content: Content[] = [{ kind: 'texto', text: `${s.context}\n\n${s.review}` }]
      const { json, usage: usage, warnings: warnings } = await t.completeJSON(systemFor(PURCHASE_REVIEW, s.catalog), content, REVIEW_SCHEMA, 'dictamen', signal)
      return { value: validate(ReviewResponse, json), origin: { promptId: promptIdOf(PURCHASE_REVIEW), proveedor: t.provider, modelo: t.modelo }, usage: usage, warnings: warnings }
    },
  }
}
