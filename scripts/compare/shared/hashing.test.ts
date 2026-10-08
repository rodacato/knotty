import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BENCH_CASES } from '../../../src/application/bench/cases'
import { assertNoSecrets } from '../../../src/application/bench/manifest'
import { gitIdentity, hashCases, hashCatalog, hashFiles, hashPrompts, hashSchemas, sha256 } from './hashing'

const dirs: string[] = []
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'knotty-hash-'))
  dirs.push(dir)
  return dir
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'ignore' })

describe('hashing', () => {
  it('hashes the same case to the same value and a changed case to another', () => {
    const [first] = BENCH_CASES
    expect(hashCases([first])).toEqual(hashCases([structuredClone(first)]))
    const changed = { ...first, notes: `${first.notes} más` }
    expect(hashCases([changed])[first.id]).not.toBe(hashCases([first])[first.id])
    expect(Object.keys(hashCases(BENCH_CASES))).toEqual(BENCH_CASES.map((c) => c.id))
  })

  it('hashes the catalog by content, not by key order', () => {
    expect(hashCatalog({ a: 1, b: [1, 2] })).toBe(hashCatalog({ b: [1, 2], a: 1 }))
    expect(hashCatalog({ a: 1 })).not.toBe(hashCatalog({ a: 2 }))
  })

  it('hashes the real prompt and schema files, all of them, as plain hex', () => {
    const prompts = hashPrompts(process.cwd())
    expect(Object.keys(prompts)).toEqual(expect.arrayContaining(['src/adapters/llm/prompts/system.v12.md', 'src/adapters/llm/common/promptValues.ts']))
    expect(Object.keys(prompts).some((k) => k.includes('/kinds/'))).toBe(true)
    const schemas = hashSchemas(process.cwd())
    expect(Object.keys(schemas)).toContain('src/ports/LLMProvider.ts')
    for (const h of [...Object.values(prompts), ...Object.values(schemas)]) expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('notices a changed file and a new one', () => {
    const root = temp()
    mkdirSync(join(root, 'p'))
    writeFileSync(join(root, 'p', 'a.md'), 'one')
    const before = hashFiles(root, ['p'])
    writeFileSync(join(root, 'p', 'a.md'), 'two')
    writeFileSync(join(root, 'p', 'b.md'), 'new')
    const after = hashFiles(root, ['p'])
    expect(after['p/a.md']).not.toBe(before['p/a.md'])
    expect(Object.keys(after)).toEqual(['p/a.md', 'p/b.md'])
  })

  it('keeps credentials out of everything it produces, even when they are in the environment', () => {
    const key = ['sk', 'test', '0123456789abcdefghijklmnop'].join('-')
    process.env.KNOTTY_FAKE_KEY = key
    try {
      const everything = { cases: hashCases(BENCH_CASES), prompts: hashPrompts(process.cwd()), schemas: hashSchemas(process.cwd()), git: gitIdentity(process.cwd()) }
      expect(JSON.stringify(everything)).not.toContain(key)
      expect(() => assertNoSecrets(everything)).not.toThrow()
    } finally {
      delete process.env.KNOTTY_FAKE_KEY
    }
  })

  describe('gitIdentity', () => {
    it('says clean for a committed tree and dirty, with a state hash that follows the content, for a changed one', () => {
      const root = temp()
      git(root, 'init', '-q')
      writeFileSync(join(root, 'a.txt'), 'one')
      git(root, 'add', '.')
      git(root, 'commit', '-qm', 'first')
      const clean = gitIdentity(root)
      expect(clean).toMatchObject({ dirty: false, stateHash: null })
      expect(clean.commit).toMatch(/^[0-9a-f]{40}$/)

      writeFileSync(join(root, 'a.txt'), 'two')
      const edited = gitIdentity(root)
      expect(edited).toMatchObject({ commit: clean.commit, dirty: true })
      expect(edited.stateHash).toMatch(/^[0-9a-f]{64}$/)
      expect(gitIdentity(root).stateHash).toBe(edited.stateHash)

      writeFileSync(join(root, 'new.txt'), 'untracked')
      const withNew = gitIdentity(root)
      expect(withNew.stateHash).not.toBe(edited.stateHash)
      writeFileSync(join(root, 'new.txt'), 'untracked, changed')
      expect(gitIdentity(root).stateHash).not.toBe(withNew.stateHash)
    })

    it('ignores what git ignores', () => {
      const root = temp()
      git(root, 'init', '-q')
      writeFileSync(join(root, '.gitignore'), 'out/\n')
      git(root, 'add', '.')
      git(root, 'commit', '-qm', 'first')
      mkdirSync(join(root, 'out'))
      writeFileSync(join(root, 'out', 'big.json'), '{}')
      expect(gitIdentity(root).dirty).toBe(false)
    })

    it('outside a repository is dirty and unhashed, never a made-up commit that looks real', () => {
      expect(gitIdentity(temp())).toEqual({ commit: '0'.repeat(40), dirty: true, stateHash: null })
    })
  })

  it('sha256 is the standard one', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
