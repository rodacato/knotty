import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// No third-party scripts or eval: an injected script can neither run nor read the keys.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  // https: and loopback stay open for SheLLM, which runs wherever the user wants.
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'knotty-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  }
}

const PLACEHOLDER = 'knotty-__BUILD__:'

/** Names the worker's cache after the content of the whole build: a deploy that changes any file gets a fresh cache and a new worker. */
function serviceWorkerCache(): Plugin {
  let outDir = 'dist'
  return {
    name: 'knotty-sw-cache',
    apply: 'build',
    configResolved: (config) => { outDir = resolve(config.root, config.build.outDir) },
    closeBundle() {
      const worker = join(outDir, 'sw.js')
      const hash = createHash('sha256')
      for (const file of readdirSync(outDir, { recursive: true, withFileTypes: true }).filter((f) => f.isFile()).map((f) => join(f.parentPath, f.name)).filter((f) => f !== worker).sort()) hash.update(relative(outDir, file)).update(readFileSync(file))
      const source = readFileSync(worker, 'utf8')
      if (!source.includes(PLACEHOLDER)) throw new Error(`sw.js lost its ${PLACEHOLDER} placeholder`)
      writeFileSync(worker, source.replace(PLACEHOLDER, `knotty-${hash.digest('hex').slice(0, 12)}:`))
    },
  }
}

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), tailwindcss(), contentSecurityPolicy(), serviceWorkerCache()],
  build: { rolldownOptions: { input: { landing: resolve('index.html'), app: resolve('catalog/index.html'), presentation: resolve('presentacion/index.html'), brand: resolve('marca/index.html') } } },
  server: { port: Number(process.env.PORT) || 5173 },
}))
