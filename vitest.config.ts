import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: { __APP_COMMIT__: JSON.stringify('test'), __APP_VERSION__: JSON.stringify('0.0.0') },
  test: {
    // The compare harness (orchestrator, store, replay) is checked offline with the simulated expert.
    include: ['src/**/*.test.ts', 'scripts/compare/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // What makes decisions; the UI and the 3D are checked in the browser.
      include: ['src/domain/**', 'src/application/**'],
      reporter: ['text-summary', 'text'],
    },
  },
})
