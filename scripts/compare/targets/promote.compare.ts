import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { promoteRun } from '../bench/promoteRun'
import { resultsDir, TRACKED_BASELINE } from '../shared/paths'
import { createRunStore } from '../shared/store'

// Offline: shows what promoting a run to the baseline would change and, with --accept, does it. Run by hand: npm run compare:promote -- <runId|--last> [--accept].
// KNOTTY_PROMOTE_TO names another file, so a trial never touches the tracked baseline.

it('promotes a saved run to the baseline, only when accepted', () => {
  const runId = process.env.KNOTTY_PROMOTE_RUN
  if (!runId) throw new Error('Pass a run id or --last: npm run compare:promote -- --last')
  const store = createRunStore(resultsDir(), runId)
  const report = promoteRun({ store, baselinePath: process.env.KNOTTY_PROMOTE_TO ?? TRACKED_BASELINE, accept: process.env.KNOTTY_PROMOTE_ACCEPT === '1' })
  process.stdout.write(`${report.lines.join('\n')}\n`)
  expect(report.lines[0]).toContain('Promoción')
  if (process.env.KNOTTY_EXIT_FILE) writeFileSync(process.env.KNOTTY_EXIT_FILE, String(report.exitCode))
})
