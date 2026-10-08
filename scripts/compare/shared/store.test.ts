import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { emptyRecording } from '../../../src/adapters/llm/replay'
import { jobId } from '../../../src/application/bench/ids'
import { buildManifest, newJobs, updateJob } from '../../../src/application/bench/manifest'
import { createRunStore, lastRunId, listRuns, readManifests, writeAtomic } from './store'

const RUN = '20261002-154501007-abcdef12'
const NEXT = '20261002-154502000-0a0b0c0d'
const dirs: string[] = []
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'knotty-store-'))
  dirs.push(dir)
  return dir
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

const manifestOf = (runId = RUN) =>
  buildManifest({
    version: 1,
    runId,
    createdAt: '2026-10-02T15:45:01.007Z',
    label: 'test',
    commit: 'a'.repeat(40),
    state: { dirty: false, stateHash: null },
    hashes: { cases: { bed: 'h1', desk: 'h2' }, graderVersion: '2', prompts: { a: 'p' }, schemas: { b: 's' }, catalog: 'c', corpus: null },
    provider: { spec: 'simulated', host: 'simulated', requestedModel: null, effectiveModels: [] },
    config: { repeat: 1, concurrency: { default: 2, perHost: { simulated: 2 } }, casesFilter: null, timeouts: { requestMs: 1, jobMs: null } },
    jobs: newJobs(runId, ['bed', 'desk'], 1),
  })

describe('writeAtomic', () => {
  it('replaces a file whole and leaves no temporary files', () => {
    const dir = temp()
    writeAtomic(join(dir, 'x.json'), 'one')
    writeAtomic(join(dir, 'x.json'), 'two')
    expect(readFileSync(join(dir, 'x.json'), 'utf8')).toBe('two')
    expect(readdirSync(dir)).toEqual(['x.json'])
  })

  it('keeps the old content and cleans up when the write cannot finish', () => {
    const dir = temp()
    mkdirSync(join(dir, 'target'))
    writeFileSync(join(dir, 'target', 'keep'), 'old')
    expect(() => writeAtomic(join(dir, 'target'), 'new')).toThrow(/EISDIR|ENOTEMPTY|EEXIST|EPERM/)
    expect(readFileSync(join(dir, 'target', 'keep'), 'utf8')).toBe('old')
    expect(readdirSync(dir)).toEqual(['target'])
  })
})

describe('run store', () => {
  it('writes the manifest first with every job pending, and reads it back validated', () => {
    const root = temp()
    const store = createRunStore(root, RUN)
    store.writeManifest(manifestOf())
    const read = store.readManifest()
    expect(read.jobs.map((j) => j.status)).toEqual(['pending', 'pending'])
    expect(read.runId).toBe(RUN)
  })

  it('a crash after some jobs leaves a manifest that still reads, with what was finished and what was not', () => {
    const root = temp()
    const store = createRunStore(root, RUN)
    let manifest = manifestOf()
    store.writeManifest(manifest)
    manifest = updateJob(manifest, jobId(RUN, 'bed', 0), { status: 'done', outcome: 'pass' })
    manifest = updateJob(manifest, jobId(RUN, 'desk', 0), { status: 'running' })
    store.writeManifest(manifest)
    // A write cut in half leaves a temporary file beside the manifest, never a broken manifest.
    writeFileSync(join(store.dir, 'manifest.json.123.deadbeef.tmp'), '{"version": 1, "ru')
    expect(store.readManifest().jobs.map((j) => j.status)).toEqual(['done', 'running'])
    expect(listRuns(root)).toEqual([RUN])
  })

  it('refuses a manifest that was edited into nonsense or carries a credential', () => {
    const root = temp()
    const store = createRunStore(root, RUN)
    store.writeManifest(manifestOf())
    writeFileSync(join(store.dir, 'manifest.json'), '{"version": 1}')
    expect(() => store.readManifest()).toThrow(/version|expected|Invalid|required/i)
    expect(() => store.writeManifest({ ...manifestOf(), label: 'Bearer abcdefghijklmnopqrstuvwxyz' })).toThrow(/Secret/)
  })

  it('keeps a recording and refuses to read one of another version', () => {
    const store = createRunStore(temp(), RUN)
    const id = jobId(RUN, 'bed', 0)
    store.writeRecording(id, emptyRecording('catalog-stamp'))
    expect(store.readRecording(id).catalogStamp).toBe('catalog-stamp')
    writeFileSync(join(store.dir, 'recordings', `${id}.json`), JSON.stringify({ ...emptyRecording('x'), version: 99 }))
    expect(() => store.readRecording(id)).toThrow(/version 99/)
  })

  it('refuses to write a job or telemetry that carries a credential', () => {
    const store = createRunStore(temp(), RUN)
    expect(() => store.writeJob('j', { headers: { authorization: 'Bearer x' } })).toThrow(/Secret/)
    expect(() => store.writeTelemetry('j', [{ note: 'sk-abcdefghijklmnopqrstuvwxyz' }])).toThrow(/Secret/)
  })

  it('lists runs oldest first, skips directories without a manifest, and refuses a bad run id', () => {
    const root = temp()
    createRunStore(root, NEXT).writeManifest(manifestOf(NEXT))
    createRunStore(root, RUN).writeManifest(manifestOf())
    mkdirSync(join(root, '20261002-000000000-ffffffff'))
    mkdirSync(join(root, 'raw'))
    expect(listRuns(root)).toEqual([RUN, NEXT])
    expect(lastRunId(root)).toBe(NEXT)
    expect(readManifests(root).map((m) => m.runId)).toEqual([RUN, NEXT])
    expect(() => createRunStore(root, '../escape')).toThrow(/Not a run id/)
    expect(lastRunId(join(root, 'missing'))).toBeNull()
  })
})
