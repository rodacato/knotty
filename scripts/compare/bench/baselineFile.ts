import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { TrialRecord } from '../../../src/application/bench/classify'
import type { Manifest } from '../../../src/application/bench/manifest'
import { baselineOf, type PromotedBaseline } from '../../../src/application/bench/promote'
import type { Baseline, ReportRow } from '../../../src/application/bench/report'
import { TRACKED_BASELINE } from '../shared/paths'
import { createRunStore, RUN_ID, writeAtomic, type RunStore, type StoredJob } from '../shared/store'

// The baseline as a file, and as the finished jobs of a run. Writing the tracked file is the promote command's, nobody else's.

export const readBaselineFile = (path: string): Baseline | PromotedBaseline => JSON.parse(readFileSync(path, 'utf8')) as Baseline | PromotedBaseline

export function writeBaselineFile(path: string, document: PromotedBaseline) {
  mkdirSync(dirname(path), { recursive: true })
  writeAtomic(path, `${JSON.stringify(document, null, 2)}\n`)
}

export interface RunResults {
  manifest: Manifest
  results: TrialRecord[]
  rows: ReportRow[]
}

/** The finished jobs of a run as they were saved, in the manifest's order; a done job whose file is missing is left out, and the promotion then says so. */
export function readRunResults(store: RunStore): RunResults {
  const manifest = store.readManifest()
  if (manifest.suite === 'hard') throw new Error(`La corrida ${manifest.runId} es de la suite difícil: no tiene filas del banco y no se compara ni se promueve como base.`)
  const saved = manifest.jobs.filter((j) => j.status === 'done' && store.hasJob(j.jobId)).map((j) => store.readJob(j.jobId) as StoredJob)
  return {
    manifest,
    rows: saved.map((s) => s.row),
    results: saved.map((s) => ({ caseId: s.caseId, trial: s.trial, result: s.row, classification: s.classification, error: s.stepErrors.join('\n') || undefined })),
  }
}

/** KNOTTY_BASELINE: `none`, a run id (that run as it was saved), a file, or nothing for the tracked baseline. */
export function loadBaseline(choice: string | undefined, options: { resultsDir: string; defaultPath?: string }): Baseline | PromotedBaseline | null {
  if (choice === 'none') return null
  if (choice && RUN_ID.test(choice)) {
    if (!existsSync(join(options.resultsDir, choice, 'manifest.json'))) throw new Error(`KNOTTY_BASELINE: no existe la corrida ${choice} en ${options.resultsDir}.`)
    const { manifest, rows } = readRunResults(createRunStore(options.resultsDir, choice))
    return baselineOf(manifest, rows)
  }
  const path = choice ?? options.defaultPath ?? TRACKED_BASELINE
  if (!existsSync(path)) {
    if (choice) throw new Error(`KNOTTY_BASELINE: ${path} no existe.`)
    return null
  }
  return readBaselineFile(path)
}
