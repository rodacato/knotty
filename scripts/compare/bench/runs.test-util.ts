import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import data from '../../../public/catalog/catalog.json'
import { createSimulated } from '../../../src/adapters/llm/simulated/simulated'
import { Catalog } from '../../../src/domain/materials/catalog'
import type { LLMProvider } from '../../../src/ports/LLMProvider'
import { runCompare, type CompareOptions } from './run'
import { createTelemetry } from '../shared/telemetry'

export const catalog = Catalog.parse(data)

export function tempDir(): { path: string; remove: () => void } {
  const path = mkdtempSync(join(tmpdir(), 'knotty-compare-test-'))
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) }
}

/** The simulated expert, except that every call throws `message()` while it returns one: a scripted provider failure. */
export function scripted(message: () => string | null): () => LLMProvider {
  return () => {
    const inner = createSimulated(0)
    const guard =
      <A extends unknown[], R>(call: ((...args: A) => Promise<R>) | null) =>
      async (...args: A): Promise<R> => {
        const failure = message()
        if (failure) throw new Error(failure)
        return call!.apply(inner, args)
      }
    return {
      ...inner,
      reconstruct: guard(inner.reconstruct),
      proposeAdjustment: guard(inner.proposeAdjustment),
      reviewPurchase: guard(inner.reviewPurchase),
      readPhoto: guard(inner.readPhoto),
      planDesign: inner.planDesign ? guard(inner.planDesign) : null,
      adjustPlan: inner.adjustPlan ? guard(inner.adjustPlan) : null,
    } as LLMProvider
  }
}

export const RATE_LIMIT = 'Límite de peticiones alcanzado; espera un momento.'

export function compareOptions(resultsDir: string, lines: string[], over: Partial<CompareOptions> = {}): CompareOptions {
  return {
    spec: 'simulated',
    host: 'simulated',
    makeProvider: () => createSimulated(0),
    catalog,
    repoRoot: process.cwd(),
    resultsDir,
    cases: ['bookcase', 'coffee-table'],
    repeat: 1,
    label: 'test run',
    parallel: 1,
    baseline: null,
    telemetry: createTelemetry(),
    out: (text) => void lines.push(text),
    ...over,
  }
}

export const simulatedRun = (resultsDir: string, lines: string[] = [], over: Partial<CompareOptions> = {}) => runCompare(compareOptions(resultsDir, lines, over))
