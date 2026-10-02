import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseRecording, type Recording } from '../../src/adapters/llm/replay'
import { assertNoSecrets, parseManifest, type Manifest } from '../../src/application/bench/manifest'

// One directory per run: manifest, one file per job, its recording, telemetry and design, and the report.
//   <root>/<runId>/manifest.json  jobs/<jobId>.json  recordings/<jobId>.json  telemetry/<jobId>.json  designs/<jobId>.json  report.md

export const RUN_ID = /^\d{8}-\d{9}-[0-9a-f]{6,}$/

/** Written beside the target and renamed over it: a reader sees the old file or the new one, never half of one. */
export function writeAtomic(path: string, text: string) {
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  try {
    writeFileSync(tmp, text)
    renameSync(tmp, path)
  } catch (e) {
    rmSync(tmp, { force: true })
    throw e
  }
}

const SUBDIRS = ['jobs', 'recordings', 'telemetry', 'designs'] as const
type Kind = (typeof SUBDIRS)[number]

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

export function createRunStore(root: string, runId: string) {
  if (!RUN_ID.test(runId)) throw new Error(`Not a run id: ${runId}`)
  const dir = join(root, runId)
  const file = (kind: Kind, jobId: string) => join(dir, kind, `${jobId}.json`)
  const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown
  const write = (kind: Kind, jobId: string, value: unknown) => {
    assertNoSecrets(value)
    mkdirSync(join(dir, kind), { recursive: true })
    writeAtomic(file(kind, jobId), json(value))
  }

  return {
    runId,
    dir,
    writeManifest(manifest: Manifest) {
      const checked = parseManifest(manifest)
      mkdirSync(dir, { recursive: true })
      writeAtomic(join(dir, 'manifest.json'), json(checked))
    },
    readManifest: (): Manifest => parseManifest(read(join(dir, 'manifest.json'))),
    writeJob: (jobId: string, value: unknown) => write('jobs', jobId, value),
    readJob: (jobId: string) => read(file('jobs', jobId)),
    hasJob: (jobId: string) => existsSync(file('jobs', jobId)),
    writeRecording(jobId: string, recording: Recording) {
      write('recordings', jobId, parseRecording(recording))
    },
    readRecording: (jobId: string): Recording => parseRecording(read(file('recordings', jobId))),
    writeTelemetry: (jobId: string, value: unknown) => write('telemetry', jobId, value),
    readTelemetry: (jobId: string) => read(file('telemetry', jobId)),
    writeDesign: (jobId: string, value: unknown) => write('designs', jobId, value),
    writeReport(markdown: string) {
      mkdirSync(dir, { recursive: true })
      writeAtomic(join(dir, 'report.md'), markdown)
    },
  }
}

export type RunStore = ReturnType<typeof createRunStore>

/** Run ids that have a manifest, oldest first (the id starts with its UTC time). */
export function listRuns(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && RUN_ID.test(e.name) && existsSync(join(root, e.name, 'manifest.json')))
    .map((e) => e.name)
    .sort()
}

export const lastRunId = (root: string) => listRuns(root).at(-1) ?? null

/** Manifests of the runs that read cleanly; one that does not is skipped, since history is only a hint. */
export function readManifests(root: string): Manifest[] {
  return listRuns(root).flatMap((id) => {
    try {
      return [createRunStore(root, id).readManifest()]
    } catch {
      return []
    }
  })
}
