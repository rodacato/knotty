import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// Apart from the tests: it calls real providers, takes minutes and costs tokens.
// One test runs the whole bench (the orchestrator caps concurrency per host); the entry point (cli.mjs) picks the live file or the offline replay.
const target = process.env.KNOTTY_COMPARE_TARGET ?? 'models'
// The replay never calls a provider, so it never loads the keys.
if (target === 'models' && existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  test: {
    include: [`scripts/compare/${target}.compare.ts`],
    testTimeout: 60 * 60_000,
    reporters: ['verbose'],
  },
})
