import { execSync } from 'node:child_process'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Sin scripts de terceros ni eval: un script inyectado no puede correr ni leer las llaves.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  // https: y loopback abiertos para SheLLM, que corre donde el usuario quiera.
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'despiece-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  }
}

/** Which code a debug export came from. */
function commit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'desconocido'
  }
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  define: { __APP_COMMIT__: JSON.stringify(commit()) },
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  server: { port: Number(process.env.PORT) || 5173 },
}))
