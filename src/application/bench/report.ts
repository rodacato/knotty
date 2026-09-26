import { byCallKind, describeAdjustments, describeStructure, type BenchResult, type CallStep } from './bench'

// The comparison report of npm run compare: what each case did, the calls by kind and prompt, and the change against a saved baseline.
// Pure: the script runs the cases and writes the files.

/** A case as the report keeps it: without the session, which is saved apart. */
export type ReportRow = Omit<BenchResult, 'state'> & { model: string; prompt: string | null }

export interface RunMeta {
  label: string
  commit: string
  /** ISO, UTC. */
  date: string
  /** What is off about the checkout the run measured, if anything («3 commits detrás de origin/main»). */
  checkout: string | null
}

/** A run kept to compare later runs against: scripts/compare/baseline.json, the only result kept in git. */
export interface Baseline extends RunMeta {
  rows: ReportRow[]
}

export const toBaseline = (rows: ReportRow[], meta: RunMeta): Baseline => ({ ...meta, rows })

/** What is wrong with a case, for its ✓ or × while the run goes: empty when it came out valid, sensible, as asked and viable. */
export function problemsOf(r: ReportRow): string[] {
  if (!r.ok) return [`falló: ${r.error ?? 'sin mensaje'}`]
  return [
    ...(r.reasonable === false ? [`no razonable (${r.measures}, ${r.path === 'plan' ? 'ficha' : 'piezas'})`] : []),
    ...(r.structure?.ok === false ? [`estructura: ${describeStructure(r.structure)}`] : []),
    ...(r.criticals ? [`${r.criticals} ${r.criticals === 1 ? 'crítico' : 'críticos'} (${r.rules.join(' ')})`] : []),
  ]
}

/** One line per case while the run goes: «ficha · 28 s · 1 intento · 3/3/3 · viable». */
export const caseLine = (r: ReportRow) =>
  r.ok
    ? [r.path === 'plan' ? 'ficha' : 'piezas', `${r.seconds.toFixed(0)} s`, `${r.calls} ${r.calls === 1 ? 'intento' : 'intentos'}`, ...(r.structure ? [describeStructure(r.structure)] : []), r.verdict].join(' · ')
    : `falló en ${r.seconds.toFixed(0)} s`

const CALL_LABEL: Record<CallStep, string> = {
  skeleton: 'esqueleto',
  pieces: 'pieza por pieza',
  'plan-adjust': 'ajuste por ficha',
  adjust: 'ajuste pieza por pieza',
  review: 'revisión de compra',
  reading: 'lectura de foto',
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
const known = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null)
const whole = (x: number | null) => (x === null ? '—' : x.toFixed(0))
const cell = (text: string) => text.replace(/\|/g, '/')

const structureCell = (r: ReportRow) => (r.structure ? `${r.structure.ok === false ? 'NO: ' : ''}${describeStructure(r.structure)}` : '—')

/** What a group of runs of one case came to: the numbers the baseline section compares. */
interface Tally {
  runs: number
  ok: number
  reasonable: number
  structure: [number, number]
  viable: number
  seconds: number | null
  output: number | null
  input: number | null
}

function tally(rows: ReportRow[]): Tally {
  const good = rows.filter((r) => r.ok)
  const graded = good.filter((r) => r.structure && r.structure.ok !== null)
  const inputs = known(good.map((r) => r.inputTokens))
  return {
    runs: rows.length,
    ok: good.length,
    reasonable: good.filter((r) => r.reasonable).length,
    structure: [graded.filter((r) => r.structure!.ok).length, graded.length],
    viable: good.filter((r) => r.verdict === 'viable').length,
    seconds: mean(good.map((r) => r.seconds)),
    output: mean(known(good.map((r) => r.outputTokens))),
    input: inputs.length ? Math.min(...inputs) : null,
  }
}

const groupKey = (r: ReportRow) => `${r.model} ${r.caseId}`

function byCase(rows: ReportRow[]) {
  const groups = new Map<string, ReportRow[]>()
  for (const r of rows) groups.set(groupKey(r), [...(groups.get(groupKey(r)) ?? []), r])
  return groups
}

const ratio = (n: number, of: number) => `${n}/${of}`

/** «2/2 → 3/3»: the baseline, then this run; the same value once. */
const change = (before: string, now: string) => (before === now ? now : `${before} → ${now}`)

/** Every case of this run against the same model and case in the baseline; a case the baseline did not run says so. */
export function againstBaseline(rows: ReportRow[], baseline: Baseline): string[] {
  const base = byCase(baseline.rows)
  const lines = [...byCase(rows)].map(([key, group]) => {
    const [model, caseId] = [group[0].model, group[0].caseId]
    const now = tally(group)
    const was = base.get(key)
    if (!was) return `| ${model} | ${caseId} | sin base | ${ratio(now.viable, now.ok)} | ${ratio(now.reasonable, now.ok)} | ${ratio(...now.structure)} | ${whole(now.seconds)} | ${whole(now.output)} | ${whole(now.input)} |`
    const before = tally(was)
    return `| ${model} | ${caseId} | ${change(String(before.runs), String(now.runs))} | ${change(ratio(before.viable, before.ok), ratio(now.viable, now.ok))} | ${change(ratio(before.reasonable, before.ok), ratio(now.reasonable, now.ok))} | ${change(ratio(...before.structure), ratio(...now.structure))} | ${change(whole(before.seconds), whole(now.seconds))} | ${change(whole(before.output), whole(now.output))} | ${change(whole(before.input), whole(now.input))} |`
  })
  return [
    `## Contra la base`,
    '',
    `Base: «${baseline.label}», commit ${baseline.commit}, ${baseline.date.slice(0, 16).replace('T', ' ')} UTC. Cada celda dice la base → esta corrida (una sola cifra si no cambió); estructura sobre los casos que la piden y se pudieron contar; segundos y tokens de salida en promedio; entrada, la más baja (la de SheLLM se infla con su propio prompt).`,
    '',
    '| Modelo | Caso | Corridas | Viables | Razonables | Estructura | s (prom.) | Tokens salida (prom.) | Tokens entrada (mín.) |',
    '|---|---|---|---|---|---|---|---|---|',
    ...lines,
    '',
  ]
}

/** One row per model: valid, seconds, tokens, sensible, structure, viable. */
function summaryTable(rows: ReportRow[]): string[] {
  const models = [...new Set(rows.map((r) => r.model))]
  return [
    '| Modelo | Diseños válidos | Segundos (prom.) | Tokens de entrada (prom.) | Tokens de salida (prom.) | Medidas razonables | Estructura como se pidió | Viables |',
    '|---|---|---|---|---|---|---|---|',
    ...models.map((m) => {
      const t = tally(rows.filter((r) => r.model === m))
      const input = mean(known(rows.filter((r) => r.model === m && r.ok).map((r) => r.inputTokens)))
      return `| ${m} | ${ratio(t.ok, t.runs)} | ${whole(t.seconds)} | ${whole(input)} | ${whole(t.output)} | ${ratio(t.reasonable, t.ok)} | ${ratio(...t.structure)} | ${ratio(t.viable, t.ok)} |`
    }),
  ]
}

/** What the terminal shows when the run ends, so the report does not have to be opened to know how it went. */
export const terminalSummary = (rows: ReportRow[], baseline: Baseline | null) => [...summaryTable(rows), '', ...(baseline ? againstBaseline(rows, baseline) : ['Sin base: KNOTTY_SAVE_BASELINE=1 fija esta corrida.', ''])].join('\n')

/** The whole report; `total` says how many cases the run has, so a report written halfway says so. */
export function reportMarkdown(rows: ReportRow[], meta: RunMeta, baseline: Baseline | null, total: number = rows.length): string {
  const models = [...new Set(rows.map((r) => r.model))]
  const line = (r: ReportRow) =>
    `| ${r.model} | ${r.caseId} | ${r.ok ? 'sí' : `no: ${cell(r.error ?? '').slice(0, 80)}`} | ${r.path === 'plan' ? 'ficha' : r.path === 'pieces' ? 'piezas' : '—'} | ${r.seconds.toFixed(0)} | ${r.calls}${r.corrections.length ? ` (${r.corrections.join(' ')})` : ''} | ${r.repairs} | ${r.inputTokens ?? '—'} | ${r.outputTokens ?? '—'} | ${r.pieces} | ${r.joints} | ${r.measures} | ${r.reasonable === null ? '—' : r.reasonable ? 'sí' : 'NO'} | ${structureCell(r)} | ${r.criticals}${r.rules.length ? ` (${r.rules.join(' ')})` : ''} | ${r.verdict} | ${r.adjustments.length ? cell(describeAdjustments(r.adjustments)) : '—'} |`
  const prompts = [...new Set(rows.map((r) => r.prompt).filter(Boolean))].join(', ') || '—'
  return [
    `# Comparativo de modelos: ${meta.label}`,
    '',
    `Commit ${meta.commit} · prompts ${prompts} · ${meta.date.slice(0, 16).replace('T', ' ')} UTC`,
    ...(meta.checkout ? ['', `⚠ ${meta.checkout}`] : []),
    ...(rows.length < total ? ['', `En curso: ${rows.length} de ${total} casos.`] : []),
    '',
    ...summaryTable(rows),
    '',
    ...(baseline ? againstBaseline(rows, baseline) : []),
    'Intentos cuenta las llamadas del diseño; cada pedido de después dice si lo hizo Knotty sin experto (0 llamadas) o el experto, y cuántas llamadas hizo. Estructura compara las puertas, cajones y huecos abiertos que pide el caso con los del diseño (los abiertos solo se cuentan en la ficha del gabinete; «?» si no se pueden contar); el resumen cuenta solo los casos que la piden y se pudieron contar.',
    '',
    '| Modelo | Caso | Listo | Camino | s | Intentos | Reparaciones | Tokens entrada | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Estructura | Críticos | Veredicto | Pedidos después (quién los hizo) |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(line),
    '',
    '## Por tipo de llamada',
    '',
    'Todas las llamadas de los casos, las del diseño y las de los pedidos de después, por tipo y por prompt. La entrada incluye prompt, esquema y contexto; con SheLLM la más baja es la que cuenta, porque su CLI a veces suma su propio prompt.',
    '',
    '| Modelo | Llamada | Prompt | Llamadas | Entrada (mín.) | Entrada (prom.) | Salida (prom.) | s (prom.) |',
    '|---|---|---|---|---|---|---|---|',
    ...models.flatMap((m) =>
      byCallKind(rows.filter((r) => r.model === m).flatMap((r) => r.callLog)).map(
        (k) => `| ${m} | ${CALL_LABEL[k.step]} | ${k.promptId ?? '— (falló)'} | ${k.calls} | ${whole(k.minInput)} | ${whole(k.input)} | ${whole(k.output)} | ${k.seconds.toFixed(0)} |`,
      ),
    ),
    '',
  ].join('\n')
}
