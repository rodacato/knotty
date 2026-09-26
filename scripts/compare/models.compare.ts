import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import data from '../../public/catalog/catalog.json'
import { createAnthropic } from '../../src/adapters/llm/anthropic'
import { createCompatible } from '../../src/adapters/llm/compatibleOpenAI'
import { createSimulated } from '../../src/adapters/llm/simulated/simulated'
import { byCallKind, createBench, describeAdjustments, describeStructure, type BenchResult } from '../../src/application/bench/bench'
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

const commit = () => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return '—'
  }
}

/** A file-name-safe version of a label: accents dropped, everything else non-alphanumeric turned into dashes. */
const slug = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\W+/g, '-')

type Row = BenchResult & { model: string; prompt: string | null }

/** Each design is saved (outside git) to look at later what the model built. */
function saveDesign(spec: string, caseId: string, state: DesignState) {
  const folder = join(import.meta.dirname, 'results', 'designs')
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${slug(spec)}-${caseId}.json`), JSON.stringify(state, null, 2))
}

/** Runs `n` at a time, to stay within each provider's limits. */
async function inBatches<T, R>(items: T[], n: number, f: (x: T) => Promise<R>) {
  const out: R[] = []
  for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(f))))
  return out
}

const CALL_LABEL: Record<BenchResult['callLog'][number]['step'], string> = {
  skeleton: 'esqueleto',
  pieces: 'pieza por pieza',
  'plan-adjust': 'ajuste por ficha',
  adjust: 'ajuste pieza por pieza',
  review: 'revisión de compra',
  reading: 'lectura de foto',
}

const structureCell = (r: Row) => (r.structure ? `${r.structure.ok === false ? 'NO: ' : ''}${describeStructure(r.structure)}` : '—')

function report(rows: Row[], label: string) {
  const line = (r: Row) =>
    `| ${r.model} | ${r.caseId} | ${r.ok ? 'sí' : `no: ${(r.error ?? '').replace(/\|/g, '/').slice(0, 80)}`} | ${r.path === 'plan' ? 'ficha' : r.path === 'pieces' ? 'piezas' : '—'} | ${r.seconds.toFixed(0)} | ${r.calls}${r.corrections.length ? ` (${r.corrections.join(' ')})` : ''} | ${r.repairs} | ${r.inputTokens ?? '—'} | ${r.outputTokens ?? '—'} | ${r.pieces} | ${r.joints} | ${r.measures} | ${r.reasonable === null ? '—' : r.reasonable ? 'sí' : 'NO'} | ${structureCell(r)} | ${r.criticals}${r.rules.length ? ` (${r.rules.join(' ')})` : ''} | ${r.verdict} | ${r.adjustments.length ? describeAdjustments(r.adjustments).replace(/\|/g, '/') : '—'} |`
  const models = [...new Set(rows.map((r) => r.model))]
  const summary = models.map((m) => {
    const rs = rows.filter((r) => r.model === m)
    const good = rs.filter((r) => r.ok)
    const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
    const tokens = good.map((r) => r.outputTokens).filter((t): t is number => t !== null)
    const input = good.map((r) => r.inputTokens).filter((t): t is number => t !== null)
    const graded = good.filter((r) => r.structure && r.structure.ok !== null)
    return `| ${m} | ${good.length}/${rs.length} | ${mean(good.map((r) => r.seconds)).toFixed(0)} | ${input.length ? mean(input).toFixed(0) : '—'} | ${tokens.length ? mean(tokens).toFixed(0) : '—'} | ${good.filter((r) => r.reasonable).length}/${good.length} | ${graded.filter((r) => r.structure!.ok).length}/${graded.length} | ${good.filter((r) => r.verdict === 'viable').length}/${good.length} |`
  })
  return [
    `# Comparativo de modelos: ${label}`,
    '',
    `Commit ${commit()} · prompts ${[...new Set(rows.map((r) => r.prompt).filter(Boolean))].join(', ') || '—'} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    '| Modelo | Diseños válidos | Segundos (prom.) | Tokens de entrada (prom.) | Tokens de salida (prom.) | Medidas razonables | Estructura como se pidió | Viables |',
    '|---|---|---|---|---|---|---|---|',
    ...summary,
    '',
    'Intentos cuenta las llamadas del diseño; cada pedido de después dice si lo hizo Knotty sin experto (0 llamadas) o el experto, y cuántas llamadas hizo. Estructura compara las puertas, cajones y huecos abiertos que pide el caso con los del diseño (los abiertos solo se cuentan en la ficha del gabinete; «?» si no se pueden contar); el resumen cuenta solo los casos que la piden y se pudieron contar.',
    '',
    '| Modelo | Caso | Listo | Camino | s | Intentos | Reparaciones | Tokens entrada | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Estructura | Críticos | Veredicto | Pedidos después (quién los hizo) |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(line),
    '',
    '## Por tipo de llamada',
    '',
    'Todas las llamadas de los casos, las del diseño y las de los pedidos de después, por tipo y por prompt; promedios de las que el proveedor reportó. La entrada incluye prompt, esquema y contexto.',
    '',
    '| Modelo | Llamada | Prompt | Llamadas | Entrada (prom.) | Salida (prom.) | s (prom.) |',
    '|---|---|---|---|---|---|---|',
    ...models.flatMap((m) =>
      byCallKind(rows.filter((r) => r.model === m).flatMap((r) => r.callLog)).map(
        (k) => `| ${m} | ${CALL_LABEL[k.step]} | ${k.promptId ?? '— (falló)'} | ${k.calls} | ${k.input === null ? '—' : k.input.toFixed(0)} | ${k.output === null ? '—' : k.output.toFixed(0)} | ${k.seconds.toFixed(0)} |`,
      ),
    ),
    '',
  ].join('\n')
}

it('model comparison', async () => {
  const models = (setting('KNOTTY_MODELS', 'KNOTTY_MODELOS') ?? '').split(',').filter(Boolean)
  if (!models.length) throw new Error('Set KNOTTY_MODELS, for example "anthropic:claude-sonnet-5,shellm:claude".')
  const only = setting('KNOTTY_CASES', 'KNOTTY_CASOS')?.split(',')
  const repetitions = Number(setting('KNOTTY_REPEAT', 'KNOTTY_REPETICIONES') ?? 1)
  const jobs = models.flatMap((model) => {
    const bench = createBench({ llm: () => provider(model), catalog })
    const cases = bench.cases.filter((c) => !only || only.includes(c.id))
    return Array.from({ length: repetitions }, () => cases.map((c) => ({ model, c, bench }))).flat()
  })
  const rows = await inBatches(jobs, Number(setting('KNOTTY_PARALLEL', 'KNOTTY_PARALELO') ?? 2), async ({ model, c, bench }): Promise<Row> => {
    const r = await bench.runCase(c, AbortSignal.timeout(15 * 60_000))
    if (r.state) saveDesign(model, c.id, r.state)
    return { ...r, model, prompt: r.state?.versions[0].origin?.promptId ?? null }
  })
  expect(rows).toHaveLength(jobs.length)

  const label = setting('KNOTTY_LABEL', 'KNOTTY_ETIQUETA') ?? 'current format'
  const text = report(rows, label)
  const folder = join(import.meta.dirname, 'results')
  mkdirSync(folder, { recursive: true })
  const file = join(folder, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${slug(label)}.md`)
  writeFileSync(file, text)
  console.log(`\n${text}\nSaved to ${file}`)
})
