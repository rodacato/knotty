import type { Requirement } from '../../domain/checks/requirements/requirements'
import type { Decision } from '../../domain/session/history/history'

// What a request changed outside what it was allowed to: the plan field by field, requirements, decisions and extras.
// It compares two states; it runs no expert.

/** The state a request starts from or leaves: `requirements` go by `id`, `decisions` by `topic`. */
export interface Kept {
  plan: object | null
  requirements?: Requirement[]
  decisions?: Decision[]
  extras?: unknown[]
}

export interface Change {
  path: string
  before: unknown
  after: unknown
}

/** What a plan says when it leaves a field out, by module: a response that writes the default changed nothing. */
const DEFAULTS: Record<string, Record<string, unknown>> = { table: { legs: 'panel', legStyle: 'straight', assembly: 'glued' } }

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Equal by content: the order of an object's keys is not a difference, the order of a list is. */
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]))
  if (!isObject(a) || !isObject(b)) return a === b
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].every((k) => same(a[k], b[k]))
}

/** Every leaf of a value by its path: "dimensions.width"; lists are leaves, compared whole. */
function leaves(value: unknown, path = ''): [string, unknown][] {
  if (!isObject(value)) return [[path, value]]
  return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
}

function withDefaults(plan: object | null): Record<string, unknown> | null {
  if (!plan) return null
  const said = plan as Record<string, unknown>
  const unsaid = Object.entries(DEFAULTS[String(said.kind)] ?? {}).filter(([key]) => said[key] === undefined)
  return { ...said, ...Object.fromEntries(unsaid) }
}

function differing<T>(name: string, before: Map<string, T>, after: Map<string, T>): Change[] {
  return [...new Set([...before.keys(), ...after.keys()])].filter((k) => !same(before.get(k), after.get(k))).map((k) => ({ path: `${name}.${k}`, before: before.get(k) ?? null, after: after.get(k) ?? null }))
}

const covered = (path: string, allowed: string[]) => allowed.some((a) => path === a || path.startsWith(`${a}.`))

/** `allowed`: the paths the request may change ("plan.dimensions.width", "requirements.space-width", "decisions.height"); a parent covers its children. */
export function preservation({ before, after, allowed = [] }: { before: Kept; after: Kept; allowed?: string[] }) {
  const byKey = <T>(items: T[] = [], keyOf: (item: T) => string) => new Map(items.map((x) => [keyOf(x), x]))
  const [extrasBefore, extrasAfter] = [before.extras ?? [], after.extras ?? []]
  const changes: Change[] = [
    ...differing('plan', new Map(leaves(withDefaults(before.plan))), new Map(leaves(withDefaults(after.plan)))),
    ...differing('requirements', byKey(before.requirements, (r) => r.id), byKey(after.requirements, (r) => r.id)),
    ...differing('decisions', byKey(before.decisions, (d) => d.topic), byKey(after.decisions, (d) => d.topic)),
    ...(same(extrasBefore, extrasAfter) ? [] : [{ path: 'extras', before: extrasBefore, after: extrasAfter }]),
  ]
  const unauthorized = changes.filter((c) => !covered(c.path, allowed))
  return { preserved: unauthorized.length === 0, changes, unauthorized }
}
