import { defineConfig } from '@playwright/test'
import base from './playwright.config'

const VIEWPORT = { width: 1280, height: 800 }

// The demo GIFs: the same app and helpers as the flows, recorded one at a time so the 3D never stutters.
export default defineConfig({
  ...base,
  testMatch: 'demo/demos.ts',
  workers: 1,
  timeout: 90_000,
  reporter: [['list'], ['json', { outputFile: 'e2e/demo-results/run.json' }]],
  outputDir: 'e2e/demo-results',
  use: { ...base.use, trace: 'off', screenshot: 'off', video: { mode: 'on', size: VIEWPORT } },
  projects: [
    {
      name: 'demo',
      use: {
        browserName: 'chromium',
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        // The machine's GPU, not the CPU renderer: the 3D then appears at once instead of after seconds of blank canvas.
        launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] },
      },
    },
  ],
})
