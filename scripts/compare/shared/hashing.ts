import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { canonicalJson } from '../../../src/adapters/llm/replay'
import { caseFingerprint } from '../../../src/application/bench/grading'
import type { BenchCase } from '../../../src/application/bench/cases'

// What a run measured, as hashes. Only code, cases and the catalog go in: never the environment, never a key.

export const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex')

export const hashCases = (cases: BenchCase[]): Record<string, string> => Object.fromEntries(cases.map((c) => [c.id, sha256(caseFingerprint(c))]))

export const hashCatalog = (parsedCatalog: unknown) => sha256(canonicalJson(parsedCatalog))

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)]))
    .sort()
}

/** Hash of each file by its path relative to `root`; a directory is walked, a file is taken as is. */
export function hashFiles(root: string, paths: string[]): Record<string, string> {
  const files = paths.flatMap((p) => (statSync(join(root, p)).isDirectory() ? filesUnder(join(root, p)) : [join(root, p)]))
  return Object.fromEntries(files.map((f) => [relative(root, f).split('\\').join('/'), sha256(readFileSync(f))]))
}

export const PROMPT_PATHS = ['src/adapters/llm/prompts', 'src/adapters/llm/common/promptValues.ts']
export const SCHEMA_PATHS = ['src/ports/LLMProvider.ts', 'src/domain/design/schema.ts', 'src/domain/editing/operations/schema.ts', 'src/adapters/llm/common/jsonSchema.ts']

export const hashPrompts = (root: string) => hashFiles(root, PROMPT_PATHS)
export const hashSchemas = (root: string) => hashFiles(root, SCHEMA_PATHS)

const git = (root: string, args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 })

/** Trimmed output of a git command, or null when it fails (no repo, no origin). */
export function gitText(root: string, args: string[]): string | null {
  try {
    return git(root, args).trim()
  } catch {
    return null
  }
}

export interface GitIdentity {
  commit: string
  dirty: boolean
  /** Hash of the uncommitted diff plus the untracked files it does not ignore; null when the tree is clean or git could not say. */
  stateHash: string | null
}

const NO_COMMIT = '0'.repeat(40)

/** The measured code: a commit alone says nothing about a dirty tree, so its diff is hashed too. */
export function gitIdentity(root: string): GitIdentity {
  try {
    const commit = git(root, ['rev-parse', 'HEAD']).trim()
    const diff = git(root, ['diff', 'HEAD', '--', '.', ':(exclude)scripts/compare/results'])
    const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean).sort()
    if (!diff && !untracked.length) return { commit, dirty: false, stateHash: null }
    const parts = untracked.map((f) => `${f}\0${sha256(readFileSync(join(root, f)))}`)
    return { commit, dirty: true, stateHash: sha256([diff, ...parts].join('\n')) }
  } catch {
    return { commit: NO_COMMIT, dirty: true, stateHash: null }
  }
}
