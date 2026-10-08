import { expect, it } from 'vitest'
import type { PlanMode } from '../../../src/application/bench/plan'
import { loadBaseline } from '../bench/baselineFile'
import { catalog, preflight, provider, reportExit, setting } from '../shared/live'
import { resultsDir } from '../shared/paths'
import { HardDataMissing, hardDirOf } from '../hard/loader'
import { resumeHard } from '../hard/run'
import { resumeCompare } from '../bench/run'
import { createRunStore } from '../shared/store'
import { createTelemetry } from '../shared/telemetry'

// Picks up a saved run: only its pending jobs, in a compatible checkout. Run by hand: npm run compare:resume -- <runId|--last> [--retry-infra|--retry-failed].

const telemetry = createTelemetry()
telemetry.install()

it('resumes a saved run', async () => {
  const runId = process.env.KNOTTY_RESUME_RUN
  if (!runId) throw new Error('Pass a run id or --last: npm run compare:resume -- --last')
  const mode = (process.env.KNOTTY_RESUME_MODE ?? 'resume') as PlanMode
  const manifest = createRunStore(resultsDir(), runId).readManifest()
  const { spec } = manifest.provider
  preflight([spec])
  const stop = new AbortController()
  process.once('SIGINT', () => stop.abort())

  const resumed = async () =>
    manifest.suite === 'hard'
      ? resumeHard({ runId, mode, makeProvider: provider, catalog, repoRoot: process.cwd(), resultsDir: resultsDir(), dir: hardDirOf(process.cwd()), telemetry, signal: stop.signal })
      : resumeCompare({
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
  let result
  try {
    result = await resumed()
  } catch (e) {
    if (!(e instanceof HardDataMissing)) throw e
    process.stdout.write(`${e.message}\n`)
    reportExit(3)
    return
  }
  if (!result.ok) {
    process.stdout.write(`No se reanuda ${runId}: la corrida y este checkout no miden lo mismo.\n${result.reasons.map((r) => `  - ${r}`).join('\n')}\nCorre de nuevo con npm run compare, o vuelve al commit de la corrida.\n`)
    reportExit(2)
    return
  }
  reportExit(result.exitCode)
  expect(result.exitCode, 'regresiones o una corrida incompleta: mira el resumen').toBe(0)
})
