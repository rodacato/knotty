import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { parseManifest } from '../../src/application/bench/manifest'
import { promoteRun } from './promoteRun'
import { RATE_LIMIT, scripted, simulatedRun, tempDir } from './runs.test-util'
import { createRunStore } from './store'

// These tests run whole scenarios: a CI runner is slower than the default limit allows.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

const dir = tempDir()
afterAll(() => dir.remove())

const target = () => join(dir.path, `baseline-${Math.random().toString(36).slice(2)}.json`)
const promote = (runId: string, baselinePath: string, accept: boolean) => promoteRun({ store: createRunStore(dir.path, runId), baselinePath, accept })

describe('promoting a complete simulated run', () => {
  it('is a dry run by default: it says it can promote and writes nothing', async () => {
    const { runId } = await simulatedRun(dir.path)
    const path = target()
    const report = promote(runId, path, false)
    expect(report).toMatchObject({ promotable: true, written: false, exitCode: 0 })
    expect(report.lines.join('\n')).toMatch(/simulacro[\s\S]*Puede promoverse[\s\S]*agrega --accept/)
    expect(existsSync(path)).toBe(false)
  })

  it('writes the baseline with its identity only with --accept, and reminds that it goes in the PR', async () => {
    const { runId, manifest } = await simulatedRun(dir.path)
    const path = target()
    const report = promote(runId, path, true)
    expect(report).toMatchObject({ promotable: true, written: true, exitCode: 0 })
    expect(report.lines.at(-1)).toMatch(/Súbela a git en el PR/)
    const saved = JSON.parse(readFileSync(path, 'utf8'))
    expect(saved.rows.map((r: { caseId: string }) => r.caseId)).toEqual(['bookcase', 'coffee-table'])
    expect(saved.commit).toBe(manifest.commit)
    expect(saved.identity).toMatchObject({ runId, hashes: { catalog: manifest.hashes.catalog }, provider: { spec: 'simulated' } })
    expect(saved.identity.jobs).toBeUndefined()
    expect(() => parseManifest({ ...saved.identity, jobs: [] })).not.toThrow()
  })

  it('shows what changes against the baseline that is already there, and the same run reads as equal', async () => {
    const first = await simulatedRun(dir.path)
    const path = target()
    promote(first.runId, path, true)
    const second = await simulatedRun(dir.path)
    const report = promote(second.runId, path, false)
    expect(report.lines.join('\n')).toMatch(/Diferencias con la base actual:[\s\S]*Comparación verificada[\s\S]*\| bookcase \| igual \|/)
  })
})

describe('refusals', () => {
  const refused = (report: ReturnType<typeof promoteRun>, path: string) => ({ promotable: report.promotable, written: report.written, exitCode: report.exitCode, exists: existsSync(path), text: report.lines.join('\n') })
  const never = { promotable: false, written: false, exitCode: 1, exists: false }

  it('an incomplete run, even with --accept', async () => {
    const stop = new AbortController()
    stop.abort()
    const { runId } = await simulatedRun(dir.path, [], { signal: stop.signal })
    const path = target()
    expect(refused(promote(runId, path, true), path)).toMatchObject({ ...never, text: expect.stringMatching(/2 jobs cancelled/) })
  })

  it('an undeclared failure', async () => {
    const { runId } = await simulatedRun(dir.path, [], { cases: ['bookcase', 'nightstand'] })
    const path = target()
    expect(refused(promote(runId, path, true), path)).toMatchObject({ ...never, text: expect.stringMatching(/nightstand trial 0: undeclared failure/) })
  })

  it('an unresolved infrastructure error', async () => {
    const { runId } = await simulatedRun(dir.path, [], { cases: ['bookcase'], makeProvider: scripted(() => RATE_LIMIT) })
    const path = target()
    expect(refused(promote(runId, path, true), path)).toMatchObject({ ...never, text: expect.stringMatching(/unresolved infrastructure error/) })
  })

  it('a dirty state with no hash', async () => {
    const { runId } = await simulatedRun(dir.path)
    const file = join(dir.path, runId, 'manifest.json')
    const manifest = JSON.parse(readFileSync(file, 'utf8'))
    writeFileSync(file, JSON.stringify({ ...manifest, state: { dirty: true, stateHash: null } }))
    const path = target()
    expect(refused(promote(runId, path, true), path)).toMatchObject({ ...never, text: expect.stringMatching(/dirty tree with no state hash/) })
  })

  it('a worse result than the verified baseline, and does not overwrite that baseline', async () => {
    const good = await simulatedRun(dir.path, [], { cases: ['bookcase'] })
    const path = target()
    promote(good.runId, path, true)
    const before = readFileSync(path, 'utf8')
    const worse = await simulatedRun(dir.path, [], { cases: ['bookcase'], makeProvider: scripted(() => 'boom') })
    expect(promote(worse.runId, path, true)).toMatchObject({ promotable: false, written: false, exitCode: 1 })
    expect(readFileSync(path, 'utf8')).toBe(before)
  })
})
