import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { loadBaseline } from '../bench/baselineFile'
import { catalog, hostOf, modelsFromEnv, preflight, provider, reportExit, setting } from '../shared/live'
import { DEFAULT_RESULTS_DIR, resultsDir } from '../shared/paths'
import { defaultParallel, runCompare } from '../bench/run'
import { createTelemetry } from '../shared/telemetry'

// Runs the bench's fixed cases against each model and grades them with Knotty's own checks. Run by hand: npm run compare.
// The same cases and grading live in the app's hidden bench (application/bench).

const telemetry = createTelemetry()
telemetry.install()

// With KNOTTY_RAW=1 each stream is saved as it arrived, to report a broken answer to the provider.
if (setting('KNOTTY_RAW', 'KNOTTY_CRUDO')) {
  const original = globalThis.fetch
  let n = 0
  globalThis.fetch = async (url, init) => {
    const r = await original(url, init)
    if (!(r.headers.get('content-type') ?? '').includes('text/event-stream')) return r
    const text = await r.text()
    const folder = join(DEFAULT_RESULTS_DIR, 'raw')
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, `${Date.now()}-${++n}.sse`), text)
    return new Response(text, { status: r.status, headers: r.headers })
  }
}

it('runs the bench against each expert', async () => {
  if (setting('KNOTTY_SAVE_BASELINE', 'KNOTTY_GUARDAR_BASE')) {
    process.stdout.write('KNOTTY_SAVE_BASELINE ya no escribe nada: la base se fija a propósito con npm run compare:promote, a partir de una corrida completa y guardada. No se corrió nada.\n')
    reportExit(2)
    throw new Error('KNOTTY_SAVE_BASELINE is no longer supported: promotion is explicit.')
  }
  const models = modelsFromEnv()
  preflight(models)
  const only = setting('KNOTTY_CASES', 'KNOTTY_CASOS')?.split(',') ?? null
  const repeat = Number(setting('KNOTTY_REPEAT', 'KNOTTY_REPETICIONES') ?? 1)
  const parallelFor = (spec: string) => Number(setting('KNOTTY_PARALLEL', 'KNOTTY_PARALELO') ?? defaultParallel(spec))
  const label = setting('KNOTTY_LABEL', 'KNOTTY_ETIQUETA') ?? 'current format'
  const baseline = loadBaseline(setting('KNOTTY_BASELINE', 'KNOTTY_BASE'), { resultsDir: resultsDir() })

  const stop = new AbortController()
  process.once('SIGINT', () => stop.abort())
  let exitCode = 0
  for (const spec of models) {
    const result = await runCompare({
      spec,
      host: hostOf(spec),
      makeProvider: () => provider(spec),
      catalog,
      repoRoot: process.cwd(),
      resultsDir: resultsDir(),
      cases: only,
      repeat,
      label,
      parallel: parallelFor(spec),
      baseline,
      telemetry,
      signal: stop.signal,
    })
    exitCode = Math.max(exitCode, result.exitCode)
  }
  reportExit(exitCode)
  expect(exitCode, 'regresiones o una corrida incompleta: mira el resumen').toBe(0)
})
