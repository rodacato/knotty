import { defineConfig, devices } from '@playwright/test'

const PORT = 4317

// The built app, not the dev server: the CSP and the service worker are the ones that ship.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Each browser draws the 3D on the CPU: more than two at once starve one another past the assertion timeout.
  workers: 2,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/report' }]],
  outputDir: 'e2e/results',
  use: {
    baseURL: `http://localhost:${PORT}/catalog/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-MX',
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/catalog/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
