import { join } from 'node:path'

// Where the compare keeps what it writes, said once: the folders under scripts/compare can move without the results moving.

const ROOT = join(import.meta.dirname, '..')

export const TRACKED_BASELINE = join(ROOT, 'baseline.json')
export const DEFAULT_RESULTS_DIR = join(ROOT, 'results')

export const resultsDir = () => process.env.KNOTTY_RESULTS_DIR ?? DEFAULT_RESULTS_DIR
