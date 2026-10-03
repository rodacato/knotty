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
]
