import { expect, it } from 'vitest'
import type { PlanMode } from '../../src/application/bench/plan'
import { loadBaseline } from './baselineFile'
import { catalog, preflight, provider, reportExit, resultsDir, setting } from './live'
import { resumeCompare } from './run'
import { createRunStore } from './store'
import { createTelemetry } from './telemetry'

// Picks up a saved run: only its pending jobs, in a compatible checkout. Run by hand: npm run compare:resume -- <runId|--last> [--retry-infra|--retry-failed].

const telemetry = createTelemetry()
telemetry.install()

it('resumes a saved run', async () => {
  const runId = process.env.KNOTTY_RESUME_RUN
  if (!runId) throw new Error('Pass a run id or --last: npm run compare:resume -- --last')
  const mode = (process.env.KNOTTY_RESUME_MODE ?? 'resume') as PlanMode
  const { spec } = createRunStore(resultsDir(), runId).readManifest().provider
  preflight([spec])
  const stop = new AbortController()
  process.once('SIGINT', () => stop.abort())

  const result = await resumeCompare({
    runId,
    mode,
    makeProvider: provider,
    catalog,
    repoRoot: process.cwd(),
    resultsDir: resultsDir(),
    baseline: loadBaseline(setting('KNOTTY_BASELINE', 'KNOTTY_BASE'), { resultsDir: resultsDir() }),
    telemetry,
    signal: stop.signal,
  })
  if (!result.ok) {
    process.stdout.write(`No se reanuda ${runId}: la corrida y este checkout no miden lo mismo.\n${result.reasons.map((r) => `  - ${r}`).join('\n')}\nCorre de nuevo con npm run compare, o vuelve al commit de la corrida.\n`)
    reportExit(2)
    return
  }
  reportExit(result.exitCode)
  expect(result.exitCode, 'regresiones o una corrida incompleta: mira el resumen').toBe(0)
})
