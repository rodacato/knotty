import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import data from '../../public/catalog/catalog.json'
import { Catalog } from '../../src/domain/materials/catalog'
import { replayRun } from './replayRun'
import { createRunStore } from './store'

// Offline: replays a saved run through the app with its recorded answers. Run with: npm run compare:replay -- <runId|--last> [--regrade].

it('replays the run offline and reproduces its verdicts', async () => {
  const runId = process.env.KNOTTY_REPLAY_RUN
  if (!runId) throw new Error('Pass a run id or --last: npm run compare:replay -- --last')
  const store = createRunStore(process.env.KNOTTY_RESULTS_DIR ?? join(import.meta.dirname, 'results'), runId)
  const report = await replayRun(store, { catalog: Catalog.parse(data), regrade: !!process.env.KNOTTY_REPLAY_REGRADE })
  process.stdout.write(`${report.lines.join('\n')}\n`)
  if (process.env.KNOTTY_EXIT_FILE) writeFileSync(process.env.KNOTTY_EXIT_FILE, report.verdict === 'ok' ? '0' : '1')
  expect(report.verdict).toBe('ok')
})
