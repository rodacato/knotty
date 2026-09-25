import { z } from 'zod'
import { Design, Dimensions } from '../design/schema'
import { Decision, Origin, Version } from '../history/history'
import { Operation } from '../operations/schema'
import { FurniturePlan } from '../modules/plan'
import { Requirement } from '../requirements/requirements'
import { TraceEntry } from '../trace/trace'
import { TrayItem } from '../tray/tray'
import { Check, CarpenterOpinion, Verdict } from '../viability/viability'

// The whole design session: what is saved and comes back on reload. Its field names are the saved format (6); `migrate.ts` reads older ones.

export const Question = z.object({
  text: z.string().min(1),
  options: z.array(z.string()).nullable().describe('Quick button answers, in Spanish; null if the question is open'),
})
export type Question = z.infer<typeof Question>

const PhotoRequest = z.object({ angle: z.string(), reason: z.string() })
type PhotoRequest = z.infer<typeof PhotoRequest>

export const Message = z.object({
  id: z.string(),
  author: z.enum(['user', 'expert']),
  text: z.string(),
  date: z.string(),
  questions: z.array(Question),
  answered: z.boolean(),
  version: z.number().nullable(),
  proposal: z.enum(['pending', 'applied', 'discarded']).nullable(),
  error: z.boolean(),
  /** Photos the expert asked for in this message; they are taken from the chat. */
  requestedPhotos: z.array(PhotoRequest).default([]),
  /** A thumbnail of the photo the person sent with this message. */
  thumbnail: z.string().nullable().default(null),
  /** Which questions ("p0") and photos ("f:interior") of this message were answered; with all of them, it is `answered`. */
  answers: z.array(z.string()).default([]),
  /** Next steps the expert suggests; shown as buttons under its last message. */
  suggestions: z.array(z.string()).default([]),
  /** Options from the rules' alternatives that Knotty builds itself when chosen; the expert never sees this. */
  solutions: z.array(z.object({ question: z.number().int(), option: z.string(), alternative: z.string() })).default([]),
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
    if (!keys) return { ...m, answered: true }
    const answers = [...new Set([...m.answers, ...keys.split(',')])]
    const total = m.questions.filter((q) => q.options).length + m.requestedPhotos.length
    return { ...m, answers, answered: answers.length >= total }
  })
}
export type Message = z.infer<typeof Message>

const Proposal = z.object({
  design: Design,
  operations: z.array(Operation),
  summary: z.string(),
  reason: z.string(),
  critical: z.array(z.object({ code: z.string(), message: z.string(), pieces: z.array(z.string()) })),
  requirements: z.array(Requirement),
  decisions: z.array(Decision),
  origin: Origin.nullable(),
  /** The plan and extras the proposed design comes from, so applying it keeps the ficha alive. */
  plan: FurniturePlan.nullable().default(null),
  extras: z.array(Operation).default([]),
  /** Why it waits for the person besides critical problems: structure removed that was not asked for, open questions. */
  holds: z.array(z.string()).default([]),
})
type Proposal = z.infer<typeof Proposal>

export const Thumbnail = z.object({ angle: z.string(), dataUrl: z.string() })
export type Thumbnail = z.infer<typeof Thumbnail>

/** A version's review before buying; `signature` says which design and cutting settings it was made with. */
export const PurchaseReview = z.object({
  signature: z.string(),
  verdict: Verdict,
  checks: z.array(Check),
  carpenter: CarpenterOpinion.extend({ origin: Origin }).nullable(),
  /** Why the carpenter did not answer, if it did not; the arithmetic checks hold anyway. */
  error: z.string().nullable(),
  date: z.string(),
})
export type PurchaseReview = z.infer<typeof PurchaseReview>

export const DesignState = z.object({
  format: z.literal(6),
  measures: Dimensions,
  versions: z.array(Version).min(1),
  current: z.number().int().positive(),
  requirements: z.array(Requirement),
  decisions: z.array(Decision),
  chat: z.array(Message),
  thumbnails: z.array(Thumbnail),
  proposal: Proposal.nullable(),
  review: PurchaseReview.nullable().default(null),
  trace: z.array(TraceEntry).default([]),
  /** Findings the person chose to leave as they are, by the key of each finding. */
  accepted: z.array(z.object({ key: z.string(), title: z.string(), at: z.string() })).default([]),
  /** What waits to go to the expert in one request. */
  tray: z.array(TrayItem).default([]),
})
export type DesignState = z.infer<typeof DesignState>

export const currentVersion = (state: DesignState) => state.versions.find((v) => v.n === state.current) ?? state.versions.at(-1)!
export const currentDesign = (state: DesignState) => currentVersion(state).design
