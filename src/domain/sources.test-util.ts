import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Checks a source the way CONTRIBUTING asks every craft number to have one: a row of docs/carpinteria that exists, or why there is none.

export const ROOT = join(import.meta.dirname, '../..')
export const REFERENCED = /^(docs\/carpinteria\/[\w-]+\.md)#(\S+) «(.+)»$/
const NO_REFERENCE = /^no reference: .{10,}/

/** The anchor a heading gets on GitHub: "7.3 Camas" → "73-camas". */
export const slug = (heading: string) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-')

/** What is wrong with a source, or null: the file, its heading and the row are there, or it says why there is no reference. */
export function sourceProblem(source: string): string | null {
  if (NO_REFERENCE.test(source)) return null
  const match = source.match(REFERENCED)
  if (!match) return `not a reference nor "no reference: why": ${source}`
  const [, path, anchor, row] = match
  if (!existsSync(join(ROOT, path))) return `${path} does not exist`
  const doc = readFileSync(join(ROOT, path), 'utf8')
  if (![...doc.matchAll(/^#+ (.+)$/gm)].some((m) => slug(m[1]) === anchor)) return `${path} has no heading #${anchor}`
  if (!doc.includes(row)) return `${path} does not say «${row}»`
  return null
}
