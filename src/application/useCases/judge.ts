import { describeChange } from '../../domain/changes/changes'
import type { Design } from '../../domain/design/schema'
import type { Catalog } from '../../domain/materials/catalog'
import type { Finding } from '../../domain/structure/finding'
import { newCriticals } from '../../domain/structure/review'
import type { DesignError } from '../../domain/validation/errors'
import type { AdjustmentResponse } from '../../ports/LLMProvider'
import type { Accepted, Candidate } from './candidate'
import { holdText } from './copy'

/** Pieces that hold the furniture up: the expert does not take them away unasked. */
const STRUCTURAL = new Set(['side', 'bottom', 'top', 'divider', 'back', 'kick', 'apron', 'brace'])
/** The request itself asks to take something away. */
const ASKS_REMOVAL = /\b(quit|elimin|sac|borr|remuev|remov|sin )/i

export interface Judging {
  /** The design the change was asked on, and its findings. */
  design: Design
  before: Finding[]
  /** The expert's operations tried on `design`; null when it brought none. */
  candidate: Candidate | null
  response: Pick<AdjustmentResponse, 'questions' | 'acceptedRisks'>
  request: string
  catalog: Catalog
  /** The expert already had its one chance to answer for new critical findings. */
  criticalsReviewed: boolean
}

export type Verdict =
  /** No change: the expert only answers. */
  | { kind: 'answer' }
  /** The change breaks the design: back to the expert with the errors. */
  | { kind: 'retry'; reason: 'invalid'; errors: DesignError[] }
  /** Valid, but with new critical findings: the expert gets one extra look at them before the person does. */
  | { kind: 'retry'; reason: 'criticals'; criticals: Finding[] }
  /** Valid, but it waits for the person: `holds` (unasked removals, open questions) or `critical` findings. */
  | { kind: 'pending'; candidate: Accepted; holds: string[]; critical: Finding[] }
  /** A new version; `unresolved` are errors the design already had and still has. */
  | { kind: 'applied'; candidate: Accepted; unresolved: DesignError[] }

/** What becomes of an expert's change: pure, so every way it can go is tested on its own. */
export function judge({ design, before, candidate, response, request, catalog, criticalsReviewed }: Judging): Verdict {
  if (!candidate) return { kind: 'answer' }
  if (!candidate.ok) return { kind: 'retry', reason: 'invalid', errors: candidate.errors }
  const { design: next, analysis } = candidate
  const unasked = describeChange(design, next, catalog).direct.filter((c) => c.kind === 'removed' && STRUCTURAL.has(design.pieces.find((p) => p.id === c.id)?.role ?? ''))
  const holds = [
    ...(unasked.length && !ASKS_REMOVAL.test(request) ? [holdText.removesStructure(unasked.map((c) => c.name))] : []),
    ...(response.questions.length ? [holdText.askedQuestions] : []),
  ]
  if (holds.length) return { kind: 'pending', candidate, holds, critical: [] }
  const accepted = new Set(response.acceptedRisks.map((a) => a.code))
  const criticals = newCriticals(before, analysis.valid ? analysis.findings : []).filter((h) => !accepted.has(h.code))
  // Questions already held the change above, so here the expert has asked nothing.
  if (criticals.length && !criticalsReviewed) return { kind: 'retry', reason: 'criticals', criticals }
  if (criticals.length) return { kind: 'pending', candidate, holds: [], critical: criticals }
  return { kind: 'applied', candidate, unresolved: analysis.valid ? [] : analysis.errors }
}
