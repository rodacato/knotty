import { describe, expect, it } from 'vitest'
import { manifestOf } from './fixtures.test-util'
import { historyOf, orderJobs, runPool } from './schedule'

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

describe('historyOf', () => {
  it('derives durations from the finished jobs only', () => {
    const m = manifestOf({}, ['a', 'b', 'c'])
    const at = (s: number) => new Date(Date.UTC(2026, 9, 2, 12, 0, s)).toISOString()
    const jobs = [
      { ...m.jobs[0], startedAt: at(0), endedAt: at(30) },
      { ...m.jobs[0], trial: 1, jobId: 'x', startedAt: at(0), endedAt: at(50) },
      { ...m.jobs[1], status: 'failed' as const, startedAt: at(0), endedAt: at(99) },
      { ...m.jobs[2], startedAt: undefined },
    ]
    expect(historyOf([{ jobs }])).toEqual({ a: [30_000, 50_000] })
  })
})

describe('orderJobs', () => {
  const job = (caseId: string) => ({ caseId })

  it('puts the longest case first by its median', () => {
    const out = orderJobs([job('fast'), job('slow'), job('mid')], { fast: [1000], slow: [90_000, 100_000, 2000], mid: [20_000] })
    expect(out.map((j) => j.caseId)).toEqual(['slow', 'mid', 'fast'])
  })

  it('treats an unknown case as the median of the known ones, and keeps ties in their order', () => {
    const out = orderJobs([job('new1'), job('fast'), job('slow'), job('new2')], { fast: [1000], slow: [9000] })
    expect(out.map((j) => j.caseId)).toEqual(['slow', 'new1', 'new2', 'fast'])
  })

  it('without any history leaves the order alone', () => {
    expect(orderJobs([job('b'), job('a'), job('c')], {}).map((j) => j.caseId)).toEqual(['b', 'a', 'c'])
  })

  it('does not change the input', () => {
    const input = [job('a'), job('b')]
    orderJobs(input, { b: [5] })
    expect(input.map((j) => j.caseId)).toEqual(['a', 'b'])
  })
})

describe('runPool', () => {
  type J = { id: string; host: string }
  const jobs = (...spec: [string, string][]): J[] => spec.map(([id, host]) => ({ id, host }))

  function harness() {
    let clock = 0
    const started: string[] = []
    const gates = new Map<string, { resolve: (v: string) => void; reject: (e: unknown) => void }>()
    let live = 0
    const liveByHost = new Map<string, number>()
    let maxLive = 0
    let maxByHost = 0
    const run = (job: J) =>
      new Promise<string>((resolve, reject) => {
        started.push(job.id)
        live++
        liveByHost.set(job.host, (liveByHost.get(job.host) ?? 0) + 1)
        maxLive = Math.max(maxLive, live)
        maxByHost = Math.max(maxByHost, liveByHost.get(job.host)!)
        const leave = () => {
          live--
          liveByHost.set(job.host, liveByHost.get(job.host)! - 1)
        }
        gates.set(job.id, { resolve: (v) => (leave(), resolve(v)), reject: (e) => (leave(), reject(e)) })
      })
    return { run, started, gates, tick: (ms: number) => (clock += ms), now: () => clock, stats: () => ({ maxLive, maxByHost }) }
  }

  const limits = (over: Partial<{ default: number; global: number; perHost: Record<string, number> }> = {}) => ({ default: 2, perHost: {}, ...over })

  it('never exceeds the cap per host and launches the rest as slots free up', async () => {
    const h = harness()
    const all = jobs(['a', 'h'], ['b', 'h'], ['c', 'h'], ['d', 'h'])
    const pool = runPool(all, h.run, { limits: limits({ default: 2 }), now: h.now })
    await flush()
    expect(h.started).toEqual(['a', 'b'])
    h.gates.get('a')!.resolve('A')
    await flush()
    expect(h.started).toEqual(['a', 'b', 'c'])
    h.gates.get('b')!.resolve('B')
    h.gates.get('c')!.resolve('C')
    await flush()
    h.gates.get('d')!.resolve('D')
    const out = await pool
    expect(out.map((o) => o.status)).toEqual(['done', 'done', 'done', 'done'])
    expect(h.stats().maxByHost).toBe(2)
  })

  it('caps each host on its own, a host can have its own limit, and a global cap holds over all', async () => {
    const h = harness()
    const all = jobs(['a1', 'a'], ['a2', 'a'], ['b1', 'b'], ['b2', 'b'], ['b3', 'b'])
    const pool = runPool(all, h.run, { limits: limits({ default: 3, perHost: { a: 1 }, global: 3 }), now: h.now })
    await flush()
    expect(h.started).toEqual(['a1', 'b1', 'b2'])
    expect(h.stats().maxLive).toBeLessThanOrEqual(3)
    for (const id of ['a1', 'b1', 'b2']) h.gates.get(id)!.resolve(id)
    await flush()
    for (const id of ['a2', 'b3']) h.gates.get(id)!.resolve(id)
    await pool
    expect(h.stats().maxLive).toBeLessThanOrEqual(3)
  })

  it('a host that is full does not block the jobs of another host behind it', async () => {
    const h = harness()
    const pool = runPool(jobs(['a1', 'a'], ['a2', 'a'], ['b1', 'b']), h.run, { limits: limits({ default: 1 }), now: h.now })
    await flush()
    expect(h.started).toEqual(['a1', 'b1'])
    for (const id of ['a1', 'b1']) h.gates.get(id)!.resolve(id)
    await flush()
    h.gates.get('a2')!.resolve('a2')
    await pool
  })

  it('launches in the order it is given, so longest-first ordering is what runs first', async () => {
    const h = harness()
    const ordered = orderJobs(jobs(['fast', 'h'], ['slow', 'h'], ['mid', 'h']).map((j) => ({ ...j, caseId: j.id })), { fast: [1], slow: [100], mid: [10] })
    const pool = runPool(ordered, h.run, { limits: limits({ default: 1 }), now: h.now })
    for (let i = 0; i < 3; i++) {
      await flush()
      h.gates.get(h.started.at(-1)!)!.resolve('ok')
    }
    await pool
    expect(h.started).toEqual(['slow', 'mid', 'fast'])
  })

  it('returns the results in the original order, not the order they completed', async () => {
    const h = harness()
    const pool = runPool(jobs(['a', 'h'], ['b', 'h'], ['c', 'h']), h.run, { limits: limits({ default: 3 }), now: h.now })
    await flush()
    h.gates.get('c')!.resolve('C')
    h.gates.get('a')!.resolve('A')
    h.gates.get('b')!.resolve('B')
    expect((await pool).map((o) => [o.job.id, o.value])).toEqual([['a', 'A'], ['b', 'B'], ['c', 'C']])
  })

  it('measures how long each job waited between ready and started', async () => {
    const h = harness()
    const pool = runPool(jobs(['a', 'h'], ['b', 'h']), h.run, { limits: limits({ default: 1 }), now: h.now })
    await flush()
    h.tick(5000)
    h.gates.get('a')!.resolve('A')
    await flush()
    h.tick(3000)
    h.gates.get('b')!.resolve('B')
    const out = await pool
    expect(out.map((o) => o.queuedMs)).toEqual([0, 5000])
    expect(out[1]).toMatchObject({ startedAt: 5000, endedAt: 8000 })
  })

  it('one failing job does not stop the others', async () => {
    const h = harness()
    const pool = runPool(jobs(['a', 'h'], ['b', 'h'], ['c', 'h']), h.run, { limits: limits({ default: 1 }), now: h.now })
    await flush()
    h.gates.get('a')!.reject(new Error('boom'))
    await flush()
    h.gates.get('b')!.resolve('B')
    await flush()
    h.gates.get('c')!.resolve('C')
    const out = await pool
    expect(out.map((o) => o.status)).toEqual(['failed', 'done', 'done'])
    expect((out[0].error as Error).message).toBe('boom')
  })

  it('a job that throws before returning a promise is a failure, not a crash', async () => {
    const out = await runPool(jobs(['a', 'h']), () => { throw new Error('sync') }, { limits: limits(), now: () => 0 })
    expect(out[0]).toMatchObject({ status: 'failed' })
  })

  it('abort stops launching, marks the unlaunched as cancelled and lets the running ones finish', async () => {
    const h = harness()
    const abort = new AbortController()
    const pool = runPool(jobs(['a', 'h'], ['b', 'h'], ['c', 'h'], ['d', 'h']), h.run, { limits: limits({ default: 2 }), now: h.now, signal: abort.signal })
    await flush()
    h.tick(700)
    abort.abort()
    await flush()
    h.gates.get('a')!.resolve('A')
    h.gates.get('b')!.resolve('B')
    const out = await pool
    expect(h.started).toEqual(['a', 'b'])
    expect(out.map((o) => o.status)).toEqual(['done', 'done', 'cancelled', 'cancelled'])
    expect(out[2].queuedMs).toBe(700)
  })

  it('an abort error from a running job after the signal fired is cancelled; any other error stays failed', async () => {
    const h = harness()
    const abort = new AbortController()
    const pool = runPool(jobs(['a', 'h'], ['b', 'h']), h.run, { limits: limits({ default: 2 }), now: h.now, signal: abort.signal })
    await flush()
    abort.abort()
    h.gates.get('a')!.reject(Object.assign(new Error('Cancelado.'), { name: 'AbortError' }))
    h.gates.get('b')!.reject(new Error('boom'))
    expect((await pool).map((o) => o.status)).toEqual(['cancelled', 'failed'])
  })

  it('an already aborted signal launches nothing', async () => {
    const h = harness()
    const out = await runPool(jobs(['a', 'h'], ['b', 'h']), h.run, { limits: limits(), now: h.now, signal: AbortSignal.abort() })
    expect(h.started).toEqual([])
    expect(out.map((o) => o.status)).toEqual(['cancelled', 'cancelled'])
  })

  it('no jobs resolves to nothing, and a limit below 1 is refused', async () => {
    expect(await runPool([], async () => 1, { limits: limits(), now: () => 0 })).toEqual([])
    expect(() => runPool(jobs(['a', 'h']), async () => 1, { limits: limits({ default: 0 }), now: () => 0 })).toThrow(RangeError)
    expect(() => runPool(jobs(['a', 'h']), async () => 1, { limits: limits({ perHost: { h: 0 } }), now: () => 0 })).toThrow(RangeError)
  })
})
