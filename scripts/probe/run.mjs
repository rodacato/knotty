// Runs probe.ts through Vite, so it reads the same files the app does. Usage: npm run probe -- <code> | --all | --update <code>
import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
})
try {
  const { main } = await server.ssrLoadModule('/scripts/probe/probe.ts')
  process.exitCode = await main(process.argv.slice(2))
} finally {
  await server.close()
}
