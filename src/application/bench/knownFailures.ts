import type { Dimensions } from '../../domain/design/schema'

// Failures declared on purpose. They stay failing in every report: a declaration labels a failure, it never turns it green.

export interface KnownFailure {
  caseId: string
  covers: {
    /** Critical rule codes; the case's criticals are covered only if every one is listed. */
    rules?: string[]
    /** Expectation keys without the step index («dimensions», «verdict»). */
    expectations?: string[]
    /** Substrings of a problem line. */
    lines?: string[]
    /** An out-of-range dimension is covered only while it stays at or under `max` and every other dimension is in range. */
    overshoot?: { dimension: keyof Dimensions; max: number }
  }
  reason: string
  evidence: string
}

export const KNOWN_FAILURES: KnownFailure[] = [
  {
    caseId: 'plant-stand',
    covers: { rules: ['R5_RACKING'], lines: ['veredicto needs-changes'] },
    reason: 'the stepped plant stand is designed piece by piece and the review finds it can rack: R5_RACKING critical, verdict needs-changes',
    evidence: 'both rows of plant-stand in scripts/compare/baseline.json (base 2026-09-26) end in needs-changes with R5_RACKING',
  },
  {
    caseId: 'bed-drawers',
    covers: { expectations: ['dimensions'], overshoot: { dimension: 'depth', max: 2300 } },
    reason: 'the real expert makes the single bed longer than the 1900-2200 mm range the case allows',
    evidence: 'lengths of 2218 to 2238 mm observed on 2026-10-02 against the real expert',
  },
  {
    caseId: 'bookcase-wide-books',
    covers: { rules: ['R1_SAG', 'R2_JOINT_THICKNESS', 'R3_SCREWS', 'R5_RACKING'], expectations: ['verdict', 'pieces:shelf'] },
    reason: 'the one-piece back of a 120 cm bookcase is wider than the usable sheet (E_TOO_BIG_FOR_SHEET), the plan is discarded and the piece-by-piece fallback ends with criticals or too many shelves',
    evidence: 'no run of this case has been viable: 0 of 6 on main without the bookcase guide and 0 of 5 with it, on 2026-10-03, each with different problems',
  },
]
