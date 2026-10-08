import { readFileSync } from 'node:fs'
import { parseIntent, type Intent } from '../../src/domain/furniture/intent/intent'
import { MODULES, buildPlan, type FurnitureKind, type FurniturePlan } from '../../src/domain/furniture/modules/plan'
import { Catalog } from '../../src/domain/materials/catalog'
import type { Expected, Group } from './corpus'
import { table } from './corpus/table'

// How much of what a person asks Knotty reads without the expert; it calls nobody. Usage: npm run autonomy -- [module]
// A misread request exits 1; an unread one is only what is left to do.

export const CORPUS: Partial<Record<FurnitureKind, Group[]>> = { table }

/** `unread`: left to the expert though Knotty could. `misread`: read as something else. `left`: the expert's, and left to it. */
export type Outcome = 'read' | 'unread' | 'misread' | 'left'

export interface Result {
  say: string
  on: string
  expected: Expected
  got: string | null
  outcome: Outcome
}

const gotOf = (intent: Intent | null) => (!intent ? null : intent.kind === 'question' ? `question ${intent.topic}` : `${intent.field} = ${intent.value}`)

export function classify(expected: Expected, intent: Intent | null): Outcome {
  if (expected === 'expert') return intent ? 'misread' : 'left'
  if (!intent) return 'unread'
  if ('question' in expected) return intent.kind === 'question' && intent.topic === expected.question ? 'read' : 'misread'
  const [only, ...more] = expected.edits
  return intent.kind === 'edit' && !more.length && intent.field === only.field && intent.value === only.value ? 'read' : 'misread'
}

export function measure(kind: FurnitureKind, catalog: Catalog): Result[] {
  const variants = new Map(MODULES[kind].benchVariants() as [string, FurniturePlan][])
  return (CORPUS[kind] ?? []).flatMap(({ on, cases }) => {
    const plan = variants.get(on)
    if (!plan) throw new Error(`${kind}: no bench variant «${on}»`)
    const { design } = buildPlan(plan, catalog)
    return cases.map(([say, expected]): Result => {
      const intent = parseIntent(say, plan, design)
      return { say, on, expected, got: gotOf(intent), outcome: classify(expected, intent) }
    })
  })
}

const count = (results: Result[], outcome: Outcome) => results.filter((r) => r.outcome === outcome).length

/** What a request is counted under: its field, `question`, or `several` when it asks for more than one change. */
const rowOf = (expected: Expected) => (expected === 'expert' ? 'expert' : 'question' in expected ? 'question' : expected.edits.length > 1 ? 'several' : expected.edits[0].field)

function report(kind: FurnitureKind, results: Result[]): string[] {
  const meant = results.filter((r) => r.expected !== 'expert')
  const rows = new Map<string, Result[]>()
  for (const r of meant) rows.set(rowOf(r.expected), [...(rows.get(rowOf(r.expected)) ?? []), r])
  const width = Math.max(...[...rows.keys()].map((k) => k.length))
  const listed = (outcome: Outcome) => results.filter((r) => r.outcome === outcome).map((r) => `    «${r.say}» (${r.on})${r.got ? ` → ${r.got}` : ''}`)
  const section = (title: string, lines: string[]) => (lines.length ? [`  ${title}`, ...lines] : [])
  return [
    `${kind}: ${count(meant, 'read')} of ${meant.length} read, ${count(meant, 'unread')} unread, ${count(results, 'misread')} misread; ${count(results, 'left')} of ${results.length - meant.length} left to the expert`,
    ...[...rows].map(([row, of]) => `  ${row.padEnd(width)}  ${count(of, 'read')}/${of.length}`),
    ...section('misread', listed('misread')),
    ...section('unread', listed('unread')),
  ]
}

export function main(args: string[]): number {
  const catalog = Catalog.parse(JSON.parse(readFileSync('public/catalog/catalog.json', 'utf8')))
  const kinds = (args.length ? args : Object.keys(CORPUS)) as FurnitureKind[]
  const unknown = kinds.filter((k) => !CORPUS[k])
  if (unknown.length) {
    console.error(`no corpus for ${unknown.join(', ')}; there is one for ${Object.keys(CORPUS).join(', ')}`)
    return 2
  }
  let misread = 0
  for (const kind of kinds) {
    const results = measure(kind, catalog)
    misread += count(results, 'misread')
    console.log(report(kind, results).join('\n'))
  }
  return misread ? 1 : 0
}
