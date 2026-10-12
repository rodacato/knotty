import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const here = fileURLToPath(new URL('.', import.meta.url))
const publicDir = join(here, '../../public')
const css = readFileSync(join(here, '../../src/ui/system/tokens.css'), 'utf8')
const mark = readFileSync(join(here, '../../src/ui/system/knot.svg'), 'utf8')
const drawing = /<g[\s\S]*<\/g>/.exec(mark)[0]
const strokeWidth = /stroke-width="([^"]+)"/.exec(mark)[1]
const token = (name) => {
  const value = new RegExp(`--${name}:\\s*(#[\\da-f]+)`, 'i').exec(css)?.[1]
  if (!value) throw new Error(`Missing color token ${name}`)
  return value
}
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>\n`
const ink = (color, scale = 1) => `<g fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" transform="translate(32 32) scale(${scale}) translate(-32 -32)">${drawing}</g>`
const pine = token('color-pine')
const walnut = token('color-walnut')
const emblem = svg(`<rect width="64" height="64" rx="14" fill="${pine}"/>${ink(walnut, 0.85)}`)
const maskable = svg(`<rect width="64" height="64" fill="${pine}"/>${ink(walnut, 0.72)}`)
writeFileSync(join(here, 'knot.svg'), emblem)
writeFileSync(join(here, 'knot-favicon.svg'), emblem)
writeFileSync(join(here, 'knot-maskable.svg'), maskable)
mkdirSync(join(publicDir, 'brand'), { recursive: true })
for (const [name, body] of Object.entries({ 'knotty-mark': svg(ink(walnut)), 'knotty-mono': svg(ink(token('color-brand-ink'))), 'knotty-inverse': svg(ink(token('color-brand-paper'))), 'knotty-emblem': emblem, 'knotty-maskable': maskable })) {
  writeFileSync(join(publicDir, `brand/${name}.svg`), body)
}
writeFileSync(join(publicDir, 'brand/knotty.tokens.css'), css)
for (const [family, file] of [['fraunces', 'fraunces-latin-full-normal.woff2'], ['inter', 'inter-latin-wght-normal.woff2'], ['jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2']]) {
  const source = join(here, '../../node_modules/@fontsource-variable', family)
  copyFileSync(join(source, 'files', file), join(publicDir, 'brand', file))
  copyFileSync(join(source, 'LICENSE'), join(publicDir, 'brand', `${family}.LICENSE`))
}
console.log('Brand vectors and canonical token source exported')
