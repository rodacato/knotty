import { defineConfig } from 'vitest/config'
import { loadKeys } from './keys.ts'

// Apart from the tests: it calls real providers, takes minutes and costs tokens.
// One test runs the whole bench (the orchestrator caps concurrency per host); the entry point (cli.mjs) picks which file to run.
const target = process.env.KNOTTY_COMPARE_TARGET ?? 'models'
// Only the targets that call a provider need keys.
if (['models', 'resume', 'concurrency'].includes(target)) loadKeys()

export default defineConfig({
  test: {
    include: [`scripts/compare/${target}.compare.ts`],
    testTimeout: 60 * 60_000,
    reporters: ['verbose'],
  },
})
