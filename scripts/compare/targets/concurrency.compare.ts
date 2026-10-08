import { expect, it } from 'vitest'
import { concurrencyTable, parseLevels } from '../../../src/application/bench/concurrency'
import { loadBaseline } from '../bench/baselineFile'
import { measureLevels } from '../bench/concurrencyRun'
import { catalog, hostOf, modelsFromEnv, preflight, provider, reportExit, setting } from '../shared/live'
import { resultsDir } from '../shared/paths'
import { createTelemetry } from '../shared/telemetry'

// The same battery at each concurrency level, one run after another, then one table. Run by hand: npm run compare:concurrency -- 2,4 (cuesta tokens).

const telemetry = createTelemetry()
telemetry.install()

it('measures the battery at each concurrency level', async () => {
  const levels = parseLevels(process.env.KNOTTY_CONCURRENCY_LEVELS ?? '', process.env.KNOTTY_ALLOW_6 === '1')
  if (!levels.ok) {
    process.stderr.write(`${levels.error}\n`)
    reportExit(3)
    return
  }
  const models = modelsFromEnv()
  preflight(models)
  if (models.length !== 1) throw new Error('La medición de concurrencia usa un solo experto: pon uno solo en KNOTTY_MODELS.')
  const [spec] = models

  const stop = new AbortController()
  process.once('SIGINT', () => stop.abort())
  const { inputs, exitCode } = await measureLevels(levels.levels, {
    spec,
    host: hostOf(spec),
    makeProvider: () => provider(spec),
    catalog,
    repoRoot: process.cwd(),
    resultsDir: resultsDir(),
    cases: setting('KNOTTY_CASES', 'KNOTTY_CASOS')?.split(',') ?? null,
    repeat: Number(setting('KNOTTY_REPEAT', 'KNOTTY_REPETICIONES') ?? 1),
    label: setting('KNOTTY_LABEL', 'KNOTTY_ETIQUETA') ?? 'concurrency',
    baseline: loadBaseline(setting('KNOTTY_BASELINE', 'KNOTTY_BASE'), { resultsDir: resultsDir() }),
    telemetry,
    signal: stop.signal,
  })
  process.stdout.write(`\nConcurrencia de ${spec}\n${concurrencyTable(inputs).join('\n')}\n`)
  reportExit(exitCode)
  expect(exitCode, 'regresiones o una corrida incompleta: mira el resumen de cada nivel').toBe(0)
})
