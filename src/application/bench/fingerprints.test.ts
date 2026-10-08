import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { analyze } from '../../domain/checks/analysis'
import { Design } from '../../domain/design/schema'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { buildPlan } from '../../domain/furniture/modules/plan'
import { createBench } from './bench'
import { fingerprint, type Fingerprint } from './fingerprint'

// The furniture the modules build, kept as a fingerprint per variant. A change that moves a piece, a joint or what there is to buy fails here with the variants it touched;
// when the change is on purpose, `UPDATE_FINGERPRINTS=1 npx vitest run src/application/bench/fingerprints.test.ts` rewrites the file and the diff of the PR shows what moved.

const FILE = join(import.meta.dirname, 'fingerprints.json')
const bench = createBench({ llm: () => createSimulated(0), catalog: testCatalog })

function current(): Record<string, Fingerprint> {
  const out: Record<string, Fingerprint> = {}
  for (const { module, variant, plan } of bench.variants()) {
    const design = buildPlan(plan, testCatalog).design
    const analysis = analyze(design, testCatalog)
    if (!analysis.valid) throw new Error(`${module} · ${variant} no es válida: ${analysis.errors[0].message}`)
    out[`${module} · ${variant}`] = fingerprint(design, analysis, testCatalog)
  }
  return out
}

/** One variant per line, so a change moves a line and nothing else. */
const render = (all: Record<string, Fingerprint>) => `{\n${Object.keys(all).sort().map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(all[k])}`).join(',\n')}\n}\n`

describe('the fingerprints of the variants', () => {
  it('match the file: any change to what a variant builds is on purpose', () => {
    const now = current()
    if (process.env.UPDATE_FINGERPRINTS) {
      writeFileSync(FILE, render(now))
      return
    }
    expect(existsSync(FILE), 'falta fingerprints.json: corre con UPDATE_FINGERPRINTS=1').toBe(true)
    const before = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, Fingerprint>
    const moved = Object.keys({ ...before, ...now }).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(now[k]))
    const lines = moved.map((k) => `${k}\n   antes: ${JSON.stringify(before[k]) ?? 'no estaba'}\n   ahora: ${JSON.stringify(now[k]) ?? 'ya no está'}`)
    expect(lines, 'variantes que cambiaron (si es a propósito: UPDATE_FINGERPRINTS=1 npx vitest run src/application/bench/fingerprints.test.ts)').toEqual([])
  })

  it('has one entry for every variant of every module', () => {
    expect(Object.keys(current()).length).toBe(bench.variants().length)
  })

  it('builds designs that pass their own schema: one that does not is saved and never loads back', () => {
    const refused = bench.variants().filter(({ plan }) => !Design.safeParse(buildPlan(plan, testCatalog).design).success)
    expect(refused.map(({ module, variant }) => `${module} · ${variant}`)).toEqual([])
  })
})
