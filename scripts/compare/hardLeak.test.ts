import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hardDirOf, leakNeedles } from './hardLoader'

// G9, leak protection: when the private bank is on this machine, none of its questions, key phrases or solution numbers may appear in a file git tracks.
// The needles are read at run time and never printed: a failure names the file and the needle's position, not its text.

const root = process.cwd()
const dir = hardDirOf(root)
const hasBank = existsSync(join(dir, 'preguntas.json')) && existsSync(join(dir, 'rubrica.json'))

const norm = (s: string) => s.replace(/\s+/g, ' ').toLowerCase()
const isNumber = (needle: string) => /^\d+(?:\.\d+)?$/.test(needle)

/** The files git tracks or would track (new and not ignored) that can be read as text. */
function trackedTexts(): { path: string; text: string }[] {
  const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).split('\0').filter(Boolean)
  return listed.flatMap((path) => {
    const full = join(root, path)
    if (!existsSync(full) || !statSync(full).isFile() || statSync(full).size > 4_000_000) return []
    const buffer = readFileSync(full)
    return buffer.includes(0) ? [] : [{ path, text: norm(buffer.toString('utf8')) }]
  })
}

/** Which needles occur in which files, as positions: never the needle itself. */
export function leaks(needles: string[], files: { path: string; text: string }[]): { path: string; needle: number }[] {
  return needles.flatMap((needle, index) => {
    const wanted = norm(needle)
    const found = isNumber(needle) ? new RegExp(`(?<![\\d.])${wanted.replace('.', '\\.')}(?![\\d])`) : null
    return files.filter((f) => (found ? found.test(f.text) : f.text.includes(wanted))).map((f) => ({ path: f.path, needle: index }))
  })
}

describe('the leak check itself', () => {
  const files = [{ path: 'a.md', text: norm('Una frase   inventada\ncon dos líneas y un valor 12.75 mm') }]

  it('finds a phrase across line breaks and case, and a number only as a whole number', () => {
    expect(leaks(['una FRASE inventada con dos líneas'], files)).toEqual([{ path: 'a.md', needle: 0 }])
    expect(leaks(['12.75'], files)).toEqual([{ path: 'a.md', needle: 0 }])
    expect(leaks(['2.75'], files)).toEqual([])
    expect(leaks(['otra frase que no está'], files)).toEqual([])
  })

  it('reports positions and paths, never the needle', () => {
    expect(JSON.stringify(leaks(['una frase inventada'], files))).not.toContain('inventada')
  })
})

describe('the tracked tree', () => {
  it('keeps the suite’s run directory out of git, where the review queue and the recordings live', () => {
    expect(() => execFileSync('git', ['check-ignore', '-q', 'scripts/compare/results/some-run/review-queue.md'], { cwd: root })).not.toThrow()
  })
})

describe.skipIf(!hasBank)('with the private bank on this machine', () => {
  it('has no question, key phrase or solution number in any tracked file', () => {
    const needles = leakNeedles(dir)
    expect(needles.length).toBeGreaterThan(16)
    const found = leaks(needles, trackedTexts())
    expect(found, `private material found in tracked files (needle positions): ${JSON.stringify(found)}`).toEqual([])
  })
})
