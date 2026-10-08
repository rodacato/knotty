import { preservation } from '../../src/application/bench/preservation'
import { createUseCases, currentPlan } from '../../src/application/useCases'
import { valueFields } from '../../src/domain/furniture/modules/fields'
import { moduleOf, type FurnitureKind, type FurniturePlan } from '../../src/domain/furniture/modules/plan'
import type { Catalog } from '../../src/domain/materials/catalog'
import type { LLMProvider } from '../../src/ports/LLMProvider'
import { CORPUS, measure, variantOf } from './autonomy'
import type { Edit, Group } from './corpus'

// The requests Knotty does not read, put to an expert: one it changes exactly as meant is one the interpreter could learn.

/** `as meant`: the plan it left is the one the request means. `otherwise`: another plan. `no change`: it answered or asked. */
export type Answer = 'as meant' | 'otherwise' | 'no change' | 'failed'

export interface Asked {
  say: string
  on: string
  answer: Answer
  /** Where its plan differs from the one meant, or why the call failed. */
  detail: string[]
}

/** The plan a request means: each edit set on the form, in order; null when one is not a field the form sets by its key. */
export function meantPlan(plan: FurniturePlan, edits: Edit[]): FurniturePlan | null {
  return edits.reduce<FurniturePlan | null>((current, { field, value }) => {
    const found = current && valueFields(moduleOf(current).fields, current).find((f) => f.type !== 'custom' && f.key === field)
    return found ? (found.set as (p: FurniturePlan, v: string | number) => FurniturePlan)(current!, value) : null
  }, plan)
}

async function askOne(llm: LLMProvider, catalog: Catalog, plan: FurniturePlan, say: string, meant: FurniturePlan): Promise<Pick<Asked, 'answer' | 'detail'>> {
  let id = 0
  const useCases = createUseCases({ llm: () => llm, catalog, repository: { load: () => null, save: () => {}, clear: () => {} }, now: () => new Date().toISOString(), newId: () => `ask-${++id}` })
  const opened = useCases.openExample({ name: plan.name, plan, notes: '' })
  const after = await useCases.adjust(opened, say, new AbortController().signal)
  const waits = !!after.proposal && after.proposal !== opened.proposal
  const got = waits ? after.proposal!.plan : after.current !== opened.current ? currentPlan(after).plan : null
  if (!got) return { answer: 'no change', detail: [] }
  const detail = preservation({ before: { plan: meant }, after: { plan: got } }).changes.map((c) => `${c.path}: ${JSON.stringify(c.after)} (meant ${JSON.stringify(c.before)})`)
  return { answer: detail.length ? 'otherwise' : 'as meant', detail }
}

/** Every unread request that means a change the form can set, put to the expert one at a time. */
export async function ask(kind: FurnitureKind, groups: Group[], catalog: Catalog, llm: LLMProvider): Promise<Asked[]> {
  const asked: Asked[] = []
  for (const { say, on, expected, outcome } of measure(kind, groups, catalog)) {
    if (outcome !== 'unread' || expected === 'expert' || 'question' in expected) continue
    const plan = variantOf(kind, on)
    const meant = meantPlan(plan, expected.edits)
    if (!meant) continue
    const result = await askOne(llm, catalog, plan, say, meant).catch((error: unknown) => ({ answer: 'failed' as const, detail: [error instanceof Error ? error.message : String(error)] }))
    asked.push({ say, on, ...result })
  }
  return asked
}

const ANSWERS: [Answer, string][] = [
  ['as meant', 'as meant: Knotty could learn to read these'],
  ['otherwise', 'otherwise'],
  ['no change', 'no change'],
  ['failed', 'failed'],
]

export function reportAsked(kind: FurnitureKind, spec: string, asked: Asked[]): string[] {
  const of = (answer: Answer) => asked.filter((a) => a.answer === answer)
  return [
    `${kind}, ${spec} on ${asked.length} unread requests: ${ANSWERS.map(([answer]) => `${of(answer).length} ${answer}`).join(', ')}`,
    ...ANSWERS.flatMap(([answer, title]) => (of(answer).length ? [`  ${title}`, ...of(answer).flatMap((a) => [`    «${a.say}» (${a.on})`, ...a.detail.map((d) => `      ${d}`)])] : [])),
  ]
}

export async function askExpert(kinds: FurnitureKind[], catalog: Catalog): Promise<number> {
  const { modelsFromEnv, preflight, provider } = await import('../compare/shared/live')
  const [spec] = modelsFromEnv()
  preflight(spec ? [spec] : [])
  console.log(`asking ${spec}: every unread request is one call to it`)
  for (const kind of kinds) console.log(reportAsked(kind, spec, await ask(kind, CORPUS[kind]!, catalog, provider(spec))).join('\n'))
  return 0
}
