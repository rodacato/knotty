import { classifyTrial, compareRuns, trialsOfRows, type TrialRecord } from './classify'
import { KNOWN_FAILURES, type KnownFailure } from './knownFailures'
import { assertNoSecrets, Manifest, summarizeJobs, type ManifestIdentity } from './manifest'
import { toBaseline, type Baseline, type ReportRow } from './report'

/** The baseline document: the report's rows plus what they were measured under. A row set from before manifests has no identity. */
export interface PromotedBaseline extends Baseline {
  identity: ManifestIdentity | null
}

/** Builds the document to save; writing it is somebody else's decision. */
export function baselineOf(manifest: Manifest, rows: ReportRow[]): PromotedBaseline {
  const { jobs: _jobs, ...identity } = manifest
  const document = {
    ...toBaseline(rows, { label: manifest.label, commit: manifest.commit, date: manifest.createdAt, checkout: manifest.state.dirty ? `dirty tree, state ${manifest.state.stateHash ?? 'unhashed'}` : null }),
    identity,
  }
  assertNoSecrets(document)
  return document
}

export interface Promotion {
  ok: boolean
  reasons: string[]
  /** What does not block but the person accepting should know. */
  notes: string[]
}

const blank = (h: string | Record<string, string>) => (typeof h === 'string' ? !h : !Object.keys(h).length || Object.values(h).some((v) => !v))

/** `accept` has to be passed as true by the caller on purpose: nothing here implies it. */
export function canPromote(p: { manifest: Manifest; results: TrialRecord[]; baseline?: Baseline | PromotedBaseline | null; accept: boolean; known?: KnownFailure[] }): Promotion {
  const { manifest, results, accept } = p
  const known = p.known ?? KNOWN_FAILURES
  const reasons: string[] = []
  const notes: string[] = []

  if (accept !== true) reasons.push('not accepted: promotion needs an explicit accept')

  const parsed = Manifest.safeParse(manifest)
  if (!parsed.success) reasons.push(...parsed.error.issues.map((i) => `manifest invalid at ${i.path.join('.')}: ${i.message}`))

  const summary = summarizeJobs(manifest)
  if (!summary.planned) reasons.push('the run planned no jobs')
  if (summary.pending) reasons.push(`${summary.pending} jobs still pending`)
  if (summary.running) reasons.push(`${summary.running} jobs still running`)
  if (summary.cancelled) reasons.push(`${summary.cancelled} jobs cancelled`)
  if (summary.failed) reasons.push(`${summary.failed} jobs failed without a result`)

  if (manifest.state.dirty && !manifest.state.stateHash) reasons.push('dirty tree with no state hash: the run cannot be reproduced')

  const { hashes } = manifest
  if (blank(hashes.graderVersion)) reasons.push('missing grader version')
  for (const part of ['prompts', 'schemas', 'catalog'] as const) if (blank(hashes[part])) reasons.push(`missing ${part} hash`)
  for (const caseId of new Set(manifest.jobs.map((j) => j.caseId))) if (!hashes.cases[caseId]) reasons.push(`missing hash for case ${caseId}`)

  const classified = new Map<string, TrialRecord['classification']>()
  for (const job of manifest.jobs.filter((j) => j.status === 'done')) {
    const found = results.find((r) => r.caseId === job.caseId && r.trial === job.trial)
    if (!found) {
      reasons.push(`no result for ${job.caseId} trial ${job.trial}`)
      continue
    }
    const classification = classifyTrial(found.result, { known, error: found.error })
    classified.set(`${job.caseId}:${job.trial}`, classification)
    if (classification === 'infrastructure') reasons.push(`${job.caseId} trial ${job.trial}: unresolved infrastructure error`)
    if (classification === 'regression') reasons.push(`${job.caseId} trial ${job.trial}: undeclared failure`)
    if (classification === 'known-failure') notes.push(`${job.caseId} trial ${job.trial}: declared known failure, still failing`)
  }

  if (p.baseline) {
    const identity = 'identity' in p.baseline ? p.baseline.identity : null
    const trials = results.map((t) => ({ ...t, classification: classified.get(`${t.caseId}:${t.trial}`) ?? t.classification }))
    const comparison = compareRuns({ manifest: identity ?? manifest, trials: trialsOfRows(p.baseline.rows, known) }, { manifest, trials })
    if (!identity) notes.push('the current baseline has no identity: compared by case only, versions unverified')
    if (!comparison.compatible) notes.push(`not compared with the current baseline: ${comparison.reasons.join('; ')}`)
    else {
      for (const c of comparison.cases) {
        for (const r of c.requirements.filter((r) => r.status === 'regression')) reasons.push(`regression against the baseline: ${c.caseId} ${r.id}`)
        if (c.status === 'incompatible') notes.push(`case ${c.caseId} changed since the baseline: not compared`)
      }
    }
  }

  return { ok: reasons.length === 0, reasons, notes }
}
