import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Sin scripts de terceros ni eval: un script inyectado no puede correr ni leer las llaves. Solo se conecta a los dos proveedores.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.anthropic.com https://api.openai.com",
  "worker-src 'self' blob:",
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

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  server: { port: Number(process.env.PORT) || 5173 },
}))
