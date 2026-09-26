import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import data from '../../public/catalog/catalog.json'
import { createAnthropic } from '../../src/adapters/llm/anthropic'
import { createCompatible } from '../../src/adapters/llm/compatibleOpenAI'
import { createSimulated } from '../../src/adapters/llm/simulated/simulated'
import { createBench } from '../../src/application/bench/bench'
import { caseLine, problemsOf, reportMarkdown, terminalSummary, toBaseline, type Baseline, type ReportRow, type RunMeta } from '../../src/application/bench/report'
import { Catalog } from '../../src/domain/materials/catalog'
import type { DesignState } from '../../src/domain/session/state'
import type { LLMProvider } from '../../src/ports/LLMProvider'

// Runs the bench's fixed cases against each model and grades them with Knotty's own checks. Run by hand: npm run compare.
// The same cases and grading live in the app's hidden bench (application/bench).

// Keys go in .env (ignored by git), never on the command line or in the code.
if (existsSync('.env')) process.loadEnvFile('.env')

/** Settings come from the environment; the Spanish names older .env files use still work. */
const setting = (name: string, older: string) => process.env[name] ?? process.env[older]

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

const git = (args: string) => {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

/** What is off about the code being measured, against the last fetch of origin/main: twice a run measured code that was not what it meant to. */
function checkoutNote(): string | null {
  const behind = Number(git('rev-list --count HEAD..origin/main') ?? 0)
  const ahead = Number(git('rev-list --count origin/main..HEAD') ?? 0)
  const dirty = (git('status --porcelain -- . ":(exclude)scripts/compare"') ?? '').split('\n').filter(Boolean).length
  const off = [
    ...(behind ? [`${behind} ${behind === 1 ? 'commit' : 'commits'} detrás de origin/main (según el último fetch)`] : []),
    ...(ahead ? [`${ahead} ${ahead === 1 ? 'commit' : 'commits'} que no están en origin/main`] : []),
    ...(dirty ? [`cambios sin commit en ${dirty} ${dirty === 1 ? 'archivo' : 'archivos'}`] : []),
  ]
  return off.length ? `Mide un checkout que no es origin/main: ${off.join('; ')}.` : null
}

/** A file-name-safe version of a label: accents dropped, everything else non-alphanumeric turned into dashes. */
const slug = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\W+/g, '-')
const stamp = (iso: string) => iso.slice(0, 16).replace(/[:T]/g, '-')

const RESULTS = join(import.meta.dirname, 'results')
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

/** Each design is saved (outside git) to look at later what the model built. */
function saveDesign(spec: string, caseId: string, state: DesignState) {
  const folder = join(RESULTS, 'designs')
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, `${stamp(new Date().toISOString())}-${slug(spec)}-${caseId}.json`), JSON.stringify(state, null, 2))
}

const models = (setting('KNOTTY_MODELS', 'KNOTTY_MODELOS') ?? '').split(',').filter(Boolean)
preflight(models)
const only = setting('KNOTTY_CASES', 'KNOTTY_CASOS')?.split(',')
const repetitions = Number(setting('KNOTTY_REPEAT', 'KNOTTY_REPETICIONES') ?? 1)
const jobs = models.flatMap((model) => {
  const bench = createBench({ llm: () => provider(model), catalog })
  const cases = bench.cases.filter((c) => !only || only.includes(c.id))
  return Array.from({ length: repetitions }, (_, rep) => cases.map((c) => ({ model, c, bench, title: `${model} · ${c.id}${repetitions > 1 ? ` (${rep + 1}/${repetitions})` : ''}` }))).flat()
})
if (!jobs.length) throw new Error(`No case matches KNOTTY_CASES=${only?.join(',')}.`)

const meta: RunMeta = { label: setting('KNOTTY_LABEL', 'KNOTTY_ETIQUETA') ?? 'current format', commit: git('rev-parse --short HEAD') ?? '—', date: new Date().toISOString(), checkout: checkoutNote() }
const baseline = loadBaseline()
const file = join(RESULTS, `${stamp(meta.date)}-${slug(meta.label)}`)
/** By the order of the jobs, not of arrival: the report reads the same however the cases finish. */
const done: (ReportRow | undefined)[] = []

/** Written after every case: a run cut short keeps what it did. */
function write() {
  const rows = done.filter((r): r is ReportRow => !!r)
  mkdirSync(RESULTS, { recursive: true })
  writeFileSync(`${file}.md`, reportMarkdown(rows, meta, baseline, jobs.length))
  writeFileSync(`${file}.json`, JSON.stringify(toBaseline(rows, meta), null, 2))
}

beforeAll(() => {
  console.log([`${jobs.length} ${jobs.length === 1 ? 'caso' : 'casos'} · base: ${baseline ? `«${baseline.label}» (${baseline.commit})` : 'ninguna'} · reporte: ${file}.md`, ...(meta.checkout ? [`⚠ ${meta.checkout}`] : [])].join('\n'))
})

describe(`${meta.label}`, () => {
  it.concurrent.each(jobs.map((job, index) => ({ ...job, index })))('$title', async ({ model, c, bench, title, index }) => {
    const { state, ...result } = await bench.runCase(c, AbortSignal.timeout(15 * 60_000))
    if (state) saveDesign(model, c.id, state)
    const row: ReportRow = { ...result, model, prompt: state?.versions[0].origin?.promptId ?? null }
    done[index] = row
    write()
    // Straight to stdout: Vitest's console attributes a line to whichever concurrent case is running.
    process.stdout.write(`  ${title} → ${caseLine(row)}\n`)
    expect({ caso: caseLine(row), problemas: problemsOf(row) }).toEqual({ caso: caseLine(row), problemas: [] })
  })
})

afterAll(() => {
  write()
  const rows = done.filter((r): r is ReportRow => !!r)
  const save = setting('KNOTTY_SAVE_BASELINE', 'KNOTTY_GUARDAR_BASE')
  if (save) writeFileSync(BASELINE, `${JSON.stringify(toBaseline(rows, meta), null, 2)}\n`)
  process.stdout.write(`\n${terminalSummary(rows, baseline)}\nReporte: ${file}.md${save ? ` · nueva base: ${BASELINE}` : ''}\n`)
})
