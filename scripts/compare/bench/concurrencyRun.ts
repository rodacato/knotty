import type { JobDetail, LevelInput } from '../../../src/application/bench/concurrency'
import { createRunStore, type StoredJob } from '../shared/store'
import { runCompare, type CompareOptions } from './run'

// Runs the same battery at each level one after another, so the levels never compete with each other, and reads each run back from disk.

export async function measureLevels(levels: number[], base: Omit<CompareOptions, 'parallel'>): Promise<{ inputs: LevelInput[]; exitCode: number }> {
  const inputs: LevelInput[] = []
  let exitCode = 0
  for (const level of levels) {
    const run = await runCompare({ ...base, parallel: level, label: `${base.label} c${level}` })
    exitCode = Math.max(exitCode, run.exitCode)
    const store = createRunStore(base.resultsDir, run.runId)
    const details: Record<string, JobDetail> = {}
    for (const job of run.manifest.jobs) {
      if (!store.hasJob(job.jobId)) continue
      const stored = store.readJob(job.jobId) as StoredJob
      const requests = store.readTelemetry(job.jobId) as JobDetail['requests']
      details[job.jobId] = { row: stored.row, stepErrors: stored.stepErrors, requests }
    }
    inputs.push({ level, manifest: run.manifest, details })
  }
  return { inputs, exitCode }
}
