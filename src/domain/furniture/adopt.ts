import type { Catalog } from '../materials/catalog'
import { differences, probe, type Expect } from './probe'
import { ReferenceFile } from './references'

// Turning a candidate (a plan, or a ficha without `expect`) into the next version of a reference, or into a new one. Pure: the files are read and written by the caller.

type Raw = Record<string, unknown>

/** What the engine expects of nothing yet; it stands in for `expect` while the candidate is checked, then is replaced by what the engine makes. */
const NO_EXPECT: Expect = { valid: false, pieces: 0, findings: [], sheets: {}, hardware: {} }

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The paths where two values differ, as `plan.columns.1.cells.0.content`; a whole side that only one has counts as one path. */
export function changedPaths(a: unknown, b: unknown, path = ''): string[] {
  if (Array.isArray(a) && Array.isArray(b)) return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => changedPaths(a[i], b[i], `${path}.${i}`.replace(/^\./, ''))).flat()
  if (isObject(a) && isObject(b)) return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => changedPaths(a[k], b[k], path ? `${path}.${k}` : k))
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [path]
}

const withoutExpect = (file: Raw): Raw => Object.fromEntries(Object.entries(file).filter(([key]) => key !== 'expect'))

export type Adoption =
  | { ok: false; reasons: string[] }
  | {
      ok: true
      /** The file to write: the candidate over the current version, with `expect` as the engine makes it. */
      ficha: Raw
      version: number
      /** Where the candidate differs from the current version, without `expect`; empty when there is nothing new. */
      changes: string[]
      /** Where the engine's figures differ from the current version's `expect`. */
      expectChanges: string[]
    }

/**
 * A candidate is a ficha (has `plan`) or just a plan. Over an existing reference it inherits what it does not say and becomes the next version if
 * anything changed; a new one has to say all a ficha says. A candidate the engine cannot build is refused: it would be a reference that shows nothing.
 */
export function prepareAdoption(current: { file: Raw; version: number } | null, candidate: Raw, code: string, catalog: Catalog): Adoption {
  const draft = 'plan' in candidate ? candidate : { plan: candidate }
  const merged: Raw = { ...(current ? withoutExpect(current.file) : { format: 1 }), ...withoutExpect(draft), code }
  const parsed = ReferenceFile.safeParse({ ...merged, expect: NO_EXPECT })
  if (!parsed.success) return { ok: false, reasons: parsed.error.issues.map((i) => `${i.path.join('.') || '(file)'}: ${i.message}`) }
  const changes = current ? changedPaths(withoutExpect(current.file), merged) : ['(new reference)']
  const version = current ? current.version + (changes.length ? 1 : 0) : 1
  const actual = probe({ ...parsed.data, version }, catalog)
  if (!actual.valid) return { ok: false, reasons: ['the engine cannot build this plan:', ...actual.findings] }
  const expectChanges = current ? differences(current.file.expect as Expect, actual) : []
  return { ok: true, ficha: { ...merged, expect: actual }, version, changes, expectChanges }
}
