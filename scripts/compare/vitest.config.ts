import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// Apart from the tests: it calls real providers, takes minutes and costs tokens.
// One test per case, shown as each finishes; KNOTTY_PARALLEL cases at a time (2 by default), to stay within each provider's limits.
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  test: {
    include: ['scripts/compare/*.compare.ts'],
    testTimeout: 60 * 60_000,
    maxConcurrency: Number(process.env.KNOTTY_PARALLEL ?? process.env.KNOTTY_PARALELO ?? 2),
    reporters: ['verbose'],
  },
})
