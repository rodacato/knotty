import type { Concurrency, Manifest } from './manifest'

export type History = Record<string, number[]>

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Durations in ms of the jobs that finished, by case. */
export function historyOf(manifests: Pick<Manifest, 'jobs'>[]): History {
  const history: History = {}
  for (const job of manifests.flatMap((m) => m.jobs)) {
    if (job.status !== 'done' || !job.startedAt || !job.endedAt) continue
    const ms = Date.parse(job.endedAt) - Date.parse(job.startedAt)
    if (Number.isFinite(ms) && ms >= 0) (history[job.caseId] ??= []).push(ms)
  }
  return history
}

/** Longest first by the case's median duration; a case with no history counts as the median of all, and ties keep their order. */
export function orderJobs<T extends { caseId: string }>(jobs: T[], history: History): T[] {
  const typical = median(Object.values(history).flatMap((d) => (d.length ? [median(d)] : [])))
  const weight = (caseId: string) => (history[caseId]?.length ? median(history[caseId]) : Number.isFinite(typical) ? typical : 0)
  return jobs
    .map((job, index) => ({ job, index, w: weight(job.caseId) }))
    .sort((a, b) => b.w - a.w || a.index - b.index)
    .map((x) => x.job)
}

export interface PoolJob {
  host: string
}

export interface PoolOutcome<J, R> {
  job: J
  status: 'done' | 'failed' | 'cancelled'
  value?: R
  error?: unknown
  /** Time between the job being ready and starting, or until it was cancelled. */
  queuedMs: number
  startedAt?: number
  endedAt?: number
}

const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError'

/** Runs whole jobs under a cap per host and a global one, launching in the given order; results come back in that order, not by completion. */
export function runPool<J extends PoolJob, R>(
  jobs: J[],
  run: (job: J, signal: AbortSignal | undefined) => Promise<R>,
  options: { limits: Concurrency; now: () => number; signal?: AbortSignal },
): Promise<PoolOutcome<J, R>[]> {
  const { limits, now, signal } = options
  const caps = [limits.default, limits.global ?? Infinity, ...Object.values(limits.perHost)]
  if (caps.some((c) => !(c >= 1))) throw new RangeError('runPool: every concurrency limit must be at least 1')

  const hostCap = (host: string) => limits.perHost[host] ?? limits.default
  const globalCap = limits.global ?? Infinity
  const ready = now()
  const outcomes = Array.from<PoolOutcome<J, R>>({ length: jobs.length })
  const waiting = jobs.map((_, i) => i)
  const active = new Map<string, number>()
  let running = 0
  let left = jobs.length

  return new Promise((resolve) => {
    if (!left) return resolve([])

    const settle = (i: number, outcome: PoolOutcome<J, R>) => {
      outcomes[i] = outcome
      if (--left === 0) resolve(outcomes)
    }

    const launch = (i: number) => {
      const job = jobs[i]
      const startedAt = now()
      const queuedMs = startedAt - ready
      active.set(job.host, (active.get(job.host) ?? 0) + 1)
      running++
      const done = () => {
        active.set(job.host, active.get(job.host)! - 1)
        running--
      }
      void (async () => run(job, signal))().then(
        (value) => {
          done()
          settle(i, { job, status: 'done', value, queuedMs, startedAt, endedAt: now() })
          pump()
        },
        (error) => {
          done()
          settle(i, { job, status: signal?.aborted && isAbort(error) ? 'cancelled' : 'failed', error, queuedMs, startedAt, endedAt: now() })
          pump()
        },
      )
    }

    const pump = () => {
      if (signal?.aborted) {
        for (const i of waiting.splice(0)) settle(i, { job: jobs[i], status: 'cancelled', queuedMs: now() - ready })
        return
      }
      for (let k = 0; k < waiting.length && running < globalCap; ) {
        const host = jobs[waiting[k]].host
        if ((active.get(host) ?? 0) >= hostCap(host)) k++
        else launch(waiting.splice(k, 1)[0])
      }
    }

    signal?.addEventListener('abort', pump, { once: true })
    pump()
  })
}
