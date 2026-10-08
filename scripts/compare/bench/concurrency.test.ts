import { afterAll, expect, it, vi } from 'vitest'
import { concurrencyTable } from '../../../src/application/bench/concurrency'
import { measureLevels } from './concurrencyRun'
import { compareOptions, tempDir } from './runs.test-util'
import { readManifests } from '../shared/store'

// These tests run whole scenarios: a CI runner is slower than the default limit allows.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

const dir = tempDir()
afterAll(() => dir.remove())

it('runs the same battery at each level one after another, labelled with the level, and tabulates them', async () => {
  const { parallel: _parallel, ...base } = compareOptions(dir.path, [], { repeat: 2, label: 'sim' })
  const { inputs, exitCode } = await measureLevels([1, 2], base)
  expect(exitCode).toBe(0)
  expect(inputs.map((i) => [i.level, i.manifest.jobs.length])).toEqual([[1, 4], [2, 4]])
  expect(readManifests(dir.path).map((m) => [m.label, m.config.concurrency.perHost.simulated])).toEqual([['sim c1', 1], ['sim c2', 2]])
  const table = concurrencyTable(inputs)
  expect(table[0]).toBe('| | 1 a la vez | 2 a la vez |')
  expect(table).toContain('| Trabajos terminados | 4/4 | 4/4 |')
  expect(table.find((l) => l.startsWith('| Tiempo total'))).not.toMatch(/—/)
})
