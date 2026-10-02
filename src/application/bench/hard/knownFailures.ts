// Hard-question failures declared on purpose, apart from the bench's. A declaration labels a failure and never turns it green;
// a blocking failure cannot be declared at all.

export interface HardKnownFailure {
  questionId: string
  checkId: string
  reason: string
  evidence: string
}

export const HARD_KNOWN_FAILURES: HardKnownFailure[] = []
