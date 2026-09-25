import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: { __APP_COMMIT__: JSON.stringify('test') },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // What makes decisions; the UI and the 3D are checked in the browser.
      include: ['src/domain/**', 'src/application/**'],
      reporter: ['text-summary', 'text'],
    },
  },
})
