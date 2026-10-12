import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const target = resolve(process.argv[2] || `${tmpdir()}/knotty-brand-preview`)
mkdirSync(target, { recursive: true })
cpSync('public/brand', `${target}/brand`, { recursive: true })

for (const [name, entry] of [['presentacion', 'src/presentation-main.tsx'], ['marca', 'src/brand-main.tsx']]) {
  const result = await build({
    configFile: false,
    plugins: [react(), tailwindcss()],
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: true, lib: { entry: resolve(entry), formats: ['iife'], name: 'KnottyPreview' } },
  })
  const files = Array.isArray(result) ? result.flatMap((r) => r.output) : result.output
  const js = files.filter((f) => f.type === 'chunk').map((f) => f.code).join('\n')
  const css = files.filter((f) => f.type === 'asset' && f.fileName.endsWith('.css')).map((f) => f.source).join('\n')
  const redirect = `const updateLinks = () => {
    for (const element of document.querySelectorAll('[href], [src]')) {
      for (const attr of ['href', 'src']) {
        const value = element.getAttribute(attr);
        if (!value) continue;
        if (value.startsWith('../brand/')) element.setAttribute(attr, value.replace('../brand/', './brand/'));
        else if (value === '../marca/' || value === '../presentacion/') element.setAttribute(attr, value.includes('marca') ? './marca.html' : './presentacion.html');
        else if (value.startsWith('../')) element.setAttribute(attr, value.replace('../', 'https://rodacato.github.io/knotty/'));
      }
    }
  };
  const observer = new MutationObserver(() => {
    if (!document.querySelector('.brand-page')) return;
    updateLinks();
    observer.disconnect();
  });
  observer.observe(document.getElementById('root'), { childList: true, subtree: true });
  updateLinks();`
  const title = /<title>(.*?)<\/title>/.exec(readFileSync(`${name}/index.html`, 'utf8'))[1]
  writeFileSync(`${target}/${name}.html`, `<!doctype html><html lang="es-MX"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style><body><div id="root"></div><script>${js.replaceAll('</script', '<\\/script')}\n${redirect}</script></body></html>`)
}
console.log(`Standalone preview: ${target}/presentacion.html and ${target}/marca.html`)
