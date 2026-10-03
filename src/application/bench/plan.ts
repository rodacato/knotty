import { compatibility, type JobRecord, type Manifest, type ManifestIdentity } from './manifest'

export type PlanMode = 'resume' | 'retry-infra' | 'retry-failed'

export type PlanReason = 'pending' | 'interrupted' | 'cancelled' | 'retry-infra' | 'retry-failed'

export interface PlannedJob {
  job: JobRecord
  reason: PlanReason
}

export type Plan = { ok: true; jobs: PlannedJob[] } | { ok: false; reasons: string[] }

const RESUME_REASON: Partial<Record<JobRecord['status'], PlanReason>> = { pending: 'pending', running: 'interrupted', cancelled: 'cancelled' }

function reasonFor(job: JobRecord, mode: PlanMode): PlanReason | null {
  const unfinished = RESUME_REASON[job.status]
  if (unfinished) return unfinished
  const infrastructure = job.outcome === 'infrastructure' || (job.status === 'failed' && !job.outcome)
  if (infrastructure) return mode === 'retry-infra' ? 'retry-infra' : null
  const failed = job.outcome === 'regression' || job.outcome === 'known-failure'
  return failed && mode === 'retry-failed' ? 'retry-failed' : null
}

function refusals(manifest: Manifest, current: ManifestIdentity, caseIds: string[]): string[] {
  const compat = compatibility(manifest, current)
  const reasons = [...compat.reasons]
  if (manifest.commit !== current.commit) reasons.push(`commit ${manifest.commit.slice(0, 7)} vs ${current.commit.slice(0, 7)}`)
  if (manifest.state.stateHash !== current.state.stateHash) reasons.push('measured state differs')
  else if (manifest.state.dirty && !manifest.state.stateHash) reasons.push('the run measured a dirty tree with no state hash: it cannot be shown to be the same')
  for (const id of caseIds) {
    if (compat.cases.changed.includes(id)) reasons.push(`case ${id} changed`)
    if (compat.cases.retired.includes(id)) reasons.push(`case ${id} no longer exists`)
  }
  return reasons
}

/** `current` is the identity this process would run under: a changed setup is refused. Without it nothing is checked. */
export function pendingJobs(manifest: Manifest, mode: PlanMode, current?: ManifestIdentity): Plan {
  const jobs = manifest.jobs.flatMap((job): PlannedJob[] => {
    const reason = reasonFor(job, mode)
    return reason ? [{ job, reason }] : []
  })
  if (current) {
    const reasons = refusals(manifest, current, [...new Set(jobs.map((j) => j.job.caseId))])
    if (reasons.length) return { ok: false, reasons }
  }
  return { ok: true, jobs }
}
