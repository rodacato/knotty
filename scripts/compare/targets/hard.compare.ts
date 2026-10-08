import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { DEFAULT_TRIALS, listLines, runHard } from '../hard/run'
import { hardDirOf, HardDataMissing, loadHardCases } from '../hard/loader'

// The 16 hard carpentry questions against the real contract: loaded at run time from a private directory, never tracked.
// Run by hand: npm run compare:hard  (costs tokens against a real expert)  ·  npm run compare:hard -- --list  (ids and counts only, offline).

const reportExit = (code: number) => {
  if (process.env.KNOTTY_EXIT_FILE) writeFileSync(process.env.KNOTTY_EXIT_FILE, String(code))
}

const trialsFrom = (name: string, fallback: number) => {
  const n = Number(process.env[name] ?? fallback)
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be a whole number of at least 1.`)
  return n
}

it('runs the hard questions against the connected expert', async () => {
  const dir = hardDirOf(process.cwd())
  let loaded: ReturnType<typeof loadHardCases>
  try {
    loaded = loadHardCases(dir)
  } catch (e) {
    if (!(e instanceof HardDataMissing)) throw e
    process.stdout.write(`${e.message}\n`)
    reportExit(3)
    return
  }

  if (process.env.KNOTTY_HARD_LIST) {
    process.stdout.write(`${listLines(loaded.cases, { critical: trialsFrom('KNOTTY_HARD_TRIALS_CRITICAL', DEFAULT_TRIALS.critical), normal: trialsFrom('KNOTTY_HARD_TRIALS', DEFAULT_TRIALS.normal) }).join('\n')}\n`)
    reportExit(0)
    return
  }

  const { catalog, hostOf, modelsFromEnv, preflight, provider, setting } = await import('../shared/live')
  const { resultsDir } = await import('../shared/paths')
  const { defaultParallel } = await import('../bench/run')
  const { createTelemetry } = await import('../shared/telemetry')
  const telemetry = createTelemetry()
  telemetry.install()
  const models = modelsFromEnv()
  preflight(models)
  const stop = new AbortController()
  process.once('SIGINT', () => stop.abort())
  const only = setting('KNOTTY_CASES', 'KNOTTY_CASOS')?.split(',') ?? null
  let exitCode = 0
  for (const spec of models) {
    const result = await runHard({
      spec,
      host: hostOf(spec),
      makeProvider: () => provider(spec),
      catalog,
      repoRoot: process.cwd(),
      resultsDir: resultsDir(),
      dir,
      load: () => loaded,
      only,
      trials: { critical: trialsFrom('KNOTTY_HARD_TRIALS_CRITICAL', DEFAULT_TRIALS.critical), normal: trialsFrom('KNOTTY_HARD_TRIALS', DEFAULT_TRIALS.normal) },
      label: setting('KNOTTY_LABEL', 'KNOTTY_ETIQUETA') ?? 'hard questions',
      parallel: Number(setting('KNOTTY_PARALLEL', 'KNOTTY_PARALELO') ?? defaultParallel(spec)),
      telemetry,
      signal: stop.signal,
    })
    exitCode = Math.max(exitCode, result.exitCode)
  }
  reportExit(exitCode)
  expect(exitCode, 'BLOQUEADA, con fallos o con respuestas esperando revisión humana: mira el resumen').toBe(0)
})
