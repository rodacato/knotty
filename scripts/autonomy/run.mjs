// Runs autonomy.ts through Vite, so it reads the same files the app does. Usage: npm run autonomy -- [module]
import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  define: { __APP_COMMIT__: JSON.stringify('autonomy') },
})
try {
  const { main } = await server.ssrLoadModule('/scripts/autonomy/autonomy.ts')
  process.exitCode = main(process.argv.slice(2))
} finally {
  await server.close()
}
