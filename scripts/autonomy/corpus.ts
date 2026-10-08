import type { Topic } from '../../src/domain/furniture/intent/intent'

// What a person would say and what it means, written from the meaning and not from what Knotty reads today:
// a request it does not read yet belongs here as much as one it does.

export interface Edit {
  field: string
  value: string | number
}

export type Expected =
  /** Every change the request asks for; Knotty reads one at a time today, so two stay with the expert until it reads both. */
  | { edits: Edit[] }
  | { question: Topic }
  /** It reads two ways on that piece: Knotty asks which, and choosing one for the person is the mistake. */
  | 'ask'
  /** Vague, open, or beyond what a plan says: reading anything into it is the mistake. */
  | 'expert'

export type Case = [say: string, expected: Expected]

export interface Group {
  /** The module's bench variant the request is said about. */
  on: string
  cases: Case[]
}

export const set = (field: string, value: string | number): Expected => ({ edits: [{ field, value }] })
export const both = (...edits: [field: string, value: string | number][]): Expected => ({ edits: edits.map(([field, value]) => ({ field, value })) })
export const asks = (question: Topic): Expected => ({ question })
