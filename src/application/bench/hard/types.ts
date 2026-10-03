import { z } from 'zod'

// The hard-question suite keeps two sides apart. The candidate gets a question and the context the app would give anyone; the evaluator keeps what judges the answer.
// The data itself is private and loaded at run time: nothing here carries a real question, a solution or a rubric.

export const RISKS = ['critical', 'normal'] as const
export type Risk = (typeof RISKS)[number]

export const BASES = ['plain', 'sagging'] as const
export type BaseKind = (typeof BASES)[number]

export const SUPPORT_STATUSES = ['supported', 'partly', 'unsupported'] as const
export type SupportStatus = (typeof SUPPORT_STATUSES)[number]

/** Names a candidate-facing object may never carry, even if a type is bypassed. */
export const SOLUTION_FIELDS = ['expected', 'solution', 'solutions', 'rubric', 'criteria', 'checks', 'key', 'reference', 'audit', 'coverage', 'risk', 'numeric', 'answer', 'notes'] as const
type SolutionField = (typeof SOLUTION_FIELDS)[number]

/** What the candidate receives: the question, the base design its session starts from, and the pressure turns (critical cases only). */
export type CandidateQuestion = Readonly<{
  id: string
  question: string
  base: BaseKind
  followUps: readonly string[]
}> & { readonly [K in SolutionField]?: never }

const CandidateSchema = z.strictObject({ id: z.string().min(1), question: z.string().min(1), base: z.enum(BASES), followUps: z.array(z.string().min(1)) })

/** Throws, naming the field, when a candidate-facing object carries anything beyond the allowed fields. */
export function assertCandidateSafe(value: unknown): CandidateQuestion {
  const parsed = CandidateSchema.safeParse(value)
  if (!parsed.success) {
    const extra = parsed.error.issues.flatMap((i) => (i.code === 'unrecognized_keys' ? i.keys : []))
    throw new Error(extra.length ? `Candidate object carries evaluator-side fields: ${extra.join(', ')}` : `Candidate object is not a question: ${parsed.error.issues.map((i) => i.path.join('.') || i.message).join(', ')}`)
  }
  return parsed.data
}

export interface NumericExpectation {
  value: number
  /** Absolute, in the number's own unit. */
  tolerance: number
  /** The question itself offers this number: saying it does not show it was chosen, so a person decides. */
  offered?: boolean
}

/** What judges an answer; never reaches the candidate. */
export interface EvaluatorKey {
  id: string
  risk: Risk
  numeric: NumericExpectation[]
  /** The decision depends on something the person did not say. */
  requiresMissingDatum: boolean
  /** The answer should leave the person a check they can do by eye or by hand. */
  requiresObservableCheck: boolean
}

export interface SupportDecision {
  status: SupportStatus
  /** A generic category (never a description of the question); null when supported. */
  reason: string | null
}

export interface HardCase {
  candidate: CandidateQuestion
  key: EvaluatorKey
  support: SupportDecision
}

/** The only view of a case the scenario runner may take. */
export const candidateOf = (c: HardCase): CandidateQuestion => assertCandidateSafe(c.candidate)

/** Critical cases carry pressure turns; a case without them cannot be critical. */
export const pressureComplete = (c: HardCase): boolean => c.key.risk === 'normal' || c.candidate.followUps.length > 0
