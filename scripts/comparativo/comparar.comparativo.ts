import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { it } from 'vitest'
import data from '../../public/catalogo/catalogo.json'
import { crearAnthropic } from '../../src/adapters/llm/anthropic'
import { crearCompatible } from '../../src/adapters/llm/compatibleOpenAI'
import { crearSimulado } from '../../src/adapters/llm/simulado/simulado'
import { createBench, type BenchResult } from '../../src/application/bench/bench'
import { Catalog } from '../../src/domain/materiales/catalog'
import type { DesignState } from '../../src/domain/sesion/state'
import type { LLMProvider } from '../../src/ports/LLMProvider'

// Runs the bench's fixed cases against each model and grades them with Knotty's own checks. Run by hand: npm run comparar.
// The same cases and grading live in the app's hidden bench (application/bench).

// Keys go in .env (ignored by git), never on the command line or in the code.
if (existsSync('.env')) process.loadEnvFile('.env')

// With KNOTTY_CRUDO=1 each stream is saved as it arrived, to report a broken answer to the provider.
if (process.env.KNOTTY_CRUDO) {
  const original = globalThis.fetch
  let n = 0
  globalThis.fetch = async (url, init) => {
    const r = await original(url, init)
    if (!(r.headers.get('content-type') ?? '').includes('text/event-stream')) return r
    const text = await r.text()
    const folder = join(import.meta.dirname, 'resultados', 'crudo')
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, `${Date.now()}-${++n}.sse`), text)
    return new Response(text, { status: r.status, headers: r.headers })
  }
}

const catalog = Catalog.parse(data)
const env = process.env

/** KNOTTY_MODELOS="anthropic:claude-sonnet-5,openai:gpt-5,shellm:claude" */
function provider(spec: string): LLMProvider {
  const [kind, ...rest] = spec.split(':')
  const model = rest.join(':')
  if (kind === 'anthropic') return crearAnthropic(env.ANTHROPIC_API_KEY ?? '', model)
  if (kind === 'openai') return crearCompatible({ proveedor: 'openai', host: 'https://api.openai.com', apiKey: env.OPENAI_API_KEY ?? '', modelo: model, etiqueta: spec })
  if (kind === 'simulado') return crearSimulado(0)
  if (kind === 'shellm') return crearCompatible({ proveedor: 'shellm', host: env.SHELLM_HOST ?? '', apiKey: env.SHELLM_API_KEY ?? '', modelo: model, etiqueta: spec })
  throw new Error(`Proveedor desconocido: ${spec}`)
}

const commit = () => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return '—'
  }
}

type Row = BenchResult & { model: string; prompt: string | null }

/** Each design is saved (outside git) to look at later what the model built. */
function saveDesign(spec: string, caseId: string, state: DesignState) {
  const folder = join(import.meta.dirname, 'resultados', 'disenos')
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${spec.replace(/\W+/g, '-')}-${caseId}.json`), JSON.stringify(state, null, 2))
}

/** Runs `n` at a time, to stay within each provider's limits. */
async function inBatches<T, R>(items: T[], n: number, f: (x: T) => Promise<R>) {
  const out: R[] = []
  for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(f))))
  return out
}

function report(rows: Row[], label: string) {
  const line = (r: Row) =>
    `| ${r.model} | ${r.caseId} | ${r.ok ? 'sí' : `no: ${(r.error ?? '').replace(/\|/g, '/').slice(0, 80)}`} | ${r.path === 'ficha' ? 'ficha' : r.path === 'pieces' ? 'piezas' : '—'} | ${r.seconds.toFixed(0)} | ${r.calls}${r.corrections.length ? ` (${r.corrections.join(' ')})` : ''} | ${r.repairs} | ${r.outputTokens ?? '—'} | ${r.pieces} | ${r.joints} | ${r.measures} | ${r.reasonable === null ? '—' : r.reasonable ? 'sí' : 'NO'} | ${r.criticals}${r.rules.length ? ` (${r.rules.join(' ')})` : ''} | ${r.verdict} |`
  const models = [...new Set(rows.map((r) => r.model))]
  const summary = models.map((m) => {
    const rs = rows.filter((r) => r.model === m)
    const good = rs.filter((r) => r.ok)
    const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
    const tokens = good.map((r) => r.outputTokens).filter((t): t is number => t !== null)
    return `| ${m} | ${good.length}/${rs.length} | ${mean(good.map((r) => r.seconds)).toFixed(0)} | ${tokens.length ? mean(tokens).toFixed(0) : '—'} | ${good.filter((r) => r.reasonable).length}/${good.length} | ${good.filter((r) => r.verdict === 'viable').length}/${good.length} |`
  })
  return [
    `# Comparativo de modelos: ${label}`,
    '',
    `Commit ${commit()} · prompts ${[...new Set(rows.map((r) => r.prompt).filter(Boolean))].join(', ') || '—'} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    '| Modelo | Diseños válidos | Segundos (prom.) | Tokens de salida (prom.) | Medidas razonables | Viables |',
    '|---|---|---|---|---|---|',
    ...summary,
    '',
    '| Modelo | Caso | Listo | Camino | s | Intentos | Reparaciones | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Críticos | Veredicto |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(line),
    '',
  ].join('\n')
}

it('comparativo de modelos', async () => {
  const models = (env.KNOTTY_MODELOS ?? '').split(',').filter(Boolean)
  if (!models.length) throw new Error('Define KNOTTY_MODELOS, por ejemplo "anthropic:claude-sonnet-5,shellm:claude".')
  const only = env.KNOTTY_CASOS?.split(',')
  const repetitions = Number(env.KNOTTY_REPETICIONES ?? 1)
  const jobs = models.flatMap((model) => {
    const bench = createBench({ llm: () => provider(model), catalog })
    const cases = bench.cases.filter((c) => !only || only.includes(c.id))
    return Array.from({ length: repetitions }, () => cases.map((c) => ({ model, c, bench }))).flat()
  })
  const rows = await inBatches(jobs, Number(env.KNOTTY_PARALELO ?? 2), async ({ model, c, bench }): Promise<Row> => {
    const r = await bench.runCase(c, AbortSignal.timeout(15 * 60_000))
    if (r.state) saveDesign(model, c.id, r.state)
    return { ...r, model, prompt: r.state?.versiones[0].origen?.promptId ?? null }
  })

  const label = env.KNOTTY_ETIQUETA ?? 'formato actual'
  const text = report(rows, label)
  const folder = join(import.meta.dirname, 'resultados')
  mkdirSync(folder, { recursive: true })
  const file = join(folder, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${label.replace(/\W+/g, '-')}.md`)
  writeFileSync(file, text)
  console.log(`\n${text}\nGuardado en ${file}`)
})
