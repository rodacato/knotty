import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import data from '../../public/catalog/catalog.json'
import { createAnthropic } from '../../src/adapters/llm/anthropic'
import { createCompatible } from '../../src/adapters/llm/compatibleOpenAI'
import { createSimulated } from '../../src/adapters/llm/simulated/simulated'
import type { Baseline } from '../../src/application/bench/report'
import { Catalog } from '../../src/domain/materials/catalog'
import type { LLMProvider } from '../../src/ports/LLMProvider'
import { DEFAULT_PARALLEL, runCompare } from './run'
import { createTelemetry } from './telemetry'

// Runs the bench's fixed cases against each model and grades them with Knotty's own checks. Run by hand: npm run compare.
// The same cases and grading live in the app's hidden bench (application/bench).

// Keys go in .env (ignored by git), never on the command line or in the code.
if (existsSync('.env')) process.loadEnvFile('.env')

/** Settings come from the environment; the Spanish names older .env files use still work. */
const setting = (name: string, older: string) => process.env[name] ?? process.env[older]

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
    const folder = join(import.meta.dirname, 'results', 'raw')
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, `${Date.now()}-${++n}.sse`), text)
    return new Response(text, { status: r.status, headers: r.headers })
  }
}

const catalog = Catalog.parse(data)
const env = process.env

/** KNOTTY_MODELS="anthropic:claude-sonnet-5,openai:gpt-5,shellm:claude" */
function provider(spec: string): LLMProvider {
  const [kind, ...rest] = spec.split(':')
  const model = rest.join(':')
  if (kind === 'anthropic') return createAnthropic(env.ANTHROPIC_API_KEY ?? '', model)
  if (kind === 'openai') return createCompatible({ provider: 'openai', host: 'https://api.openai.com', apiKey: env.OPENAI_API_KEY ?? '', model: model, label: spec })
  if (kind === 'simulated') return createSimulated(0)
  if (kind === 'shellm') return createCompatible({ provider: 'shellm', host: env.SHELLM_HOST ?? '', apiKey: env.SHELLM_API_KEY ?? '', model: model, label: spec })
  throw new Error(`Unknown provider: ${spec}`)
}

/** Where the calls go, for the manifest and the per-host limit: the host alone, never a path, key or credentials. */
function hostOf(spec: string): string {
  const kind = spec.split(':')[0]
  if (kind === 'anthropic') return 'api.anthropic.com'
  if (kind === 'openai') return 'api.openai.com'
  if (kind === 'simulated') return 'simulated'
  try {
    return new URL(env.SHELLM_HOST ?? '').host || 'unknown'
  } catch {
    return 'unknown'
  }
}

/** What each provider needs from the environment: checked before any case runs, so a missing key fails in a second and not once per case. */
const NEEDS: Record<string, string[]> = { anthropic: ['ANTHROPIC_API_KEY'], openai: ['OPENAI_API_KEY'], shellm: ['SHELLM_HOST'], simulated: [] }

function preflight(models: string[]) {
  if (!models.length) throw new Error('Set KNOTTY_MODELS, for example "anthropic:claude-sonnet-5,shellm:claude".')
  for (const spec of models) {
    const kind = spec.split(':')[0]
    if (!(kind in NEEDS)) throw new Error(`Unknown provider: ${spec}`)
    const missing = NEEDS[kind].filter((name) => !env[name])
    if (missing.length) throw new Error(`${spec} needs ${missing.join(' and ')} in .env (or the environment); nothing was run.`)
  }
}

/** The run kept to compare against; the only result in git. KNOTTY_BASELINE names another file, or `none`. */
const BASELINE = join(import.meta.dirname, 'baseline.json')

function loadBaseline(): Baseline | null {
  const chosen = setting('KNOTTY_BASELINE', 'KNOTTY_BASE')
  if (chosen === 'none') return null
  const path = chosen ?? BASELINE
  if (!existsSync(path)) {
    if (chosen) throw new Error(`KNOTTY_BASELINE: ${path} does not exist.`)
    return null
  }
  return JSON.parse(readFileSync(path, 'utf8')) as Baseline
}

/** The code is the only exit code vitest cannot carry: the entry point reads it from here. */
function reportExit(code: number) {
  if (env.KNOTTY_EXIT_FILE) writeFileSync(env.KNOTTY_EXIT_FILE, String(code))
}

it('runs the bench against each expert', async () => {
  if (setting('KNOTTY_SAVE_BASELINE', 'KNOTTY_GUARDAR_BASE')) {
    process.stdout.write('KNOTTY_SAVE_BASELINE ya no escribe nada: la base se fija a propósito, con un comando de promoción aparte, a partir de una corrida completa y guardada. No se corrió nada.\n')
    reportExit(2)
    throw new Error('KNOTTY_SAVE_BASELINE is no longer supported: promotion is explicit.')
  }
  const models = (setting('KNOTTY_MODELS', 'KNOTTY_MODELOS') ?? '').split(',').filter(Boolean)
  preflight(models)
  const only = setting('KNOTTY_CASES', 'KNOTTY_CASOS')?.split(',') ?? null
  const repeat = Number(setting('KNOTTY_REPEAT', 'KNOTTY_REPETICIONES') ?? 1)
  const parallel = Number(setting('KNOTTY_PARALLEL', 'KNOTTY_PARALELO') ?? DEFAULT_PARALLEL)
  const label = setting('KNOTTY_LABEL', 'KNOTTY_ETIQUETA') ?? 'current format'
  const baseline = loadBaseline()

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
      resultsDir: join(import.meta.dirname, 'results'),
      cases: only,
      repeat,
      label,
      parallel,
      baseline,
      telemetry,
      signal: stop.signal,
    })
    exitCode = Math.max(exitCode, result.exitCode)
  }
  reportExit(exitCode)
  expect(exitCode, 'regresiones o una corrida incompleta: mira el resumen').toBe(0)
})
