import { defineConfig } from 'vitest/config'

// Apart from the tests: it calls real providers, takes minutes and costs tokens.
export default defineConfig({
  test: { include: ['scripts/compare/*.compare.ts'], testTimeout: 60 * 60_000 },
})
