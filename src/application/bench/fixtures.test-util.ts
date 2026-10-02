import { jobId } from './ids'
import type { JobRecord, Manifest } from './manifest'
import type { GradedResult } from './classify'

export const RUN = '20261002-154501007-abcdef12'
export const COMMIT = 'a'.repeat(40)

export function manifestOf(over: Partial<Manifest> = {}, cases: string[] = ['bed', 'desk'], repeat = 1): Manifest {
  const jobs: JobRecord[] = cases.flatMap((caseId) => Array.from({ length: repeat }, (_, trial) => ({ jobId: jobId(RUN, caseId, trial), caseId, trial, status: 'done' as const, outcome: 'pass' as const })))
  return {
    version: 1,
    runId: RUN,
    createdAt: '2026-10-02T15:45:01.007Z',
    label: 'test',
    commit: COMMIT,
    state: { dirty: false, stateHash: null },
    hashes: { cases: Object.fromEntries(cases.map((c) => [c, `h-${c}`])), graderVersion: '2', prompts: { skeleton: 'p1', cabinet: 'p2' }, schemas: 's1', catalog: 'c1', corpus: null },
    provider: { spec: 'shellm:claude', host: 'localhost:8080', requestedModel: 'claude', effectiveModels: ['claude-sonnet'] },
    config: { repeat, concurrency: { default: 2, perHost: {} }, casesFilter: null, timeouts: { requestMs: 300_000, jobMs: null } },
    jobs,
    ...over,
  }
}

export const jobsOf = (m: Manifest, patch: (j: JobRecord) => Partial<JobRecord>): Manifest => ({ ...m, jobs: m.jobs.map((j) => ({ ...j, ...patch(j) })) })

const clean: GradedResult = {
  caseId: 'bed',
  ok: true,
  error: null,
  seconds: 10,
  calls: 1,
  outputTokens: 1,
  inputTokens: 1,
  callLog: [],
  path: 'plan',
  pieces: 1,
  joints: 1,
  measures: '700 × 1000 × 2000',
  reasonable: true,
  structure: null,
  criticals: 0,
  rules: [],
  corrections: [],
  repairs: 0,
  verdict: 'viable',
  adjustments: [],
  steps: [],
}

export const resultOf = (over: Partial<GradedResult> = {}): GradedResult => ({ ...clean, ...over })

export const expectation = (id: string, status: 'pass' | 'fail' | 'unknown', detail = 'x', mandatory = true) => ({ id, kind: 'dimensions' as const, status, detail, mandatory, subject: 'design' as const })

export function stepOf(label: string, expectations: ReturnType<typeof expectation>[], over: Record<string, unknown> = {}) {
  const design = { valid: true, verdict: 'viable', criticals: 0, rules: [], criticalKeys: [], problems: [], pieces: 1, joints: 1, measures: '1 × 1 × 1', counts: { doors: 0, drawers: 0, open: 0 } }
  return { step: 0, label, request: null, outcome: 'applied' as const, design, proposal: null, expectations, ...over }
}
