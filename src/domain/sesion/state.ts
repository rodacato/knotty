import { z } from 'zod'
import { Design, Dimensions } from '../diseno/schema'
import { Decision, Origin, Version } from '../historial/history'
import { Operation } from '../operaciones/schema'
import { FurniturePlan } from '../modules/plan'
import { Requirement } from '../requisitos/requirements'
import { TraceEntry } from '../trace/trace'
import { TrayItem } from '../tray/tray'
import { Check, CarpenterOpinion, Verdict } from '../viabilidad/viability'

// The whole design session: what is saved and comes back on reload. Its field names are the saved format: they stay in Spanish until step 9.

export const Question = z.object({
  texto: z.string().min(1),
  opciones: z.array(z.string()).nullable().describe('Respuestas rápidas en botón; null si es abierta'),
})
export type Question = z.infer<typeof Question>

export const PhotoRequest = z.object({ angulo: z.string(), motivo: z.string() })
export type PhotoRequest = z.infer<typeof PhotoRequest>

export const Message = z.object({
  id: z.string(),
  autor: z.enum(['usuario', 'experto']),
  texto: z.string(),
  fecha: z.string(),
  preguntas: z.array(Question),
  respondida: z.boolean(),
  version: z.number().nullable(),
  propuesta: z.enum(['pendiente', 'aplicada', 'descartada']).nullable(),
  error: z.boolean(),
  /** Photos the expert asked for in this message; they are taken from the chat. */
  fotosPedidas: z.array(PhotoRequest).default([]),
  /** A thumbnail of the photo the person sent with this message. */
  miniatura: z.string().nullable().default(null),
  /** Which questions ("p0") and photos ("f:interior") of this message were answered; with all of them, it is `respondida`. */
  respuestas: z.array(z.string()).default([]),
  /** Next steps the expert suggests; shown as buttons under its last message. */
  sugerencias: z.array(z.string()).default([]),
})

/** The key of what gets answered inside one of the expert's messages. */
export const questionAnswerKey = (index: number) => `p${index}`
export const photoAnswerKey = (angle: string) => `f:${angle}`

/** Marks a question or photo of a message as answered; `answering` is "messageId" or "messageId#key,key", several separated by ";". */
export function markAnswered(chat: Message[], answering: string | null): Message[] {
  if (!answering) return chat
  if (answering.includes(';')) return answering.split(';').reduce(markAnswered, chat)
  const [id, keys] = answering.split('#')
  return chat.map((m) => {
    if (m.id !== id) return m
    if (!keys) return { ...m, respondida: true }
    const respuestas = [...new Set([...m.respuestas, ...keys.split(',')])]
    const total = m.preguntas.filter((p) => p.opciones).length + m.fotosPedidas.length
    return { ...m, respuestas, respondida: respuestas.length >= total }
  })
}
export type Message = z.infer<typeof Message>

export const Proposal = z.object({
  diseno: Design,
  operaciones: z.array(Operation),
  resumen: z.string(),
  motivo: z.string(),
  criticos: z.array(z.object({ codigo: z.string(), mensaje: z.string(), piezas: z.array(z.string()) })),
  requisitos: z.array(Requirement),
  decisiones: z.array(Decision),
  origen: Origin.nullable(),
  /** The plan and extras the proposed design comes from, so applying it keeps the ficha alive. */
  plan: FurniturePlan.nullable().default(null),
  extras: z.array(Operation).default([]),
  /** Why it waits for the person besides critical problems: structure removed that was not asked for, open questions. */
  holds: z.array(z.string()).default([]),
})
export type Proposal = z.infer<typeof Proposal>

export const Thumbnail = z.object({ angulo: z.string(), dataUrl: z.string() })
export type Thumbnail = z.infer<typeof Thumbnail>

/** A version's review before buying; `firma` says which version and cutting settings it was made with. */
export const PurchaseReview = z.object({
  firma: z.string(),
  veredicto: Verdict,
  comprobaciones: z.array(Check),
  carpintero: CarpenterOpinion.extend({ origen: Origin }).nullable(),
  /** Why the carpenter did not answer, if it did not; the arithmetic checks hold anyway. */
  error: z.string().nullable(),
  fecha: z.string(),
})
export type PurchaseReview = z.infer<typeof PurchaseReview>

export const DesignState = z.object({
  formato: z.literal(1),
  medidas: Dimensions,
  versiones: z.array(Version).min(1),
  actual: z.number().int().positive(),
  requisitos: z.array(Requirement),
  decisiones: z.array(Decision),
  chat: z.array(Message),
  miniaturas: z.array(Thumbnail),
  propuesta: Proposal.nullable(),
  dictamen: PurchaseReview.nullable().default(null),
  trace: z.array(TraceEntry).default([]),
  /** Findings the person chose to leave as they are, by the key of each finding. */
  accepted: z.array(z.object({ key: z.string(), title: z.string(), at: z.string() })).default([]),
  /** What waits to go to the expert in one request. */
  tray: z.array(TrayItem).default([]),
})
export type DesignState = z.infer<typeof DesignState>

export const currentVersion = (state: DesignState) => state.versiones.find((v) => v.n === state.actual) ?? state.versiones.at(-1)!
export const currentDesign = (state: DesignState) => currentVersion(state).diseno
