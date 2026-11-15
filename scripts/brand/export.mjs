import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { fontPackage, fonts } from './kit-files.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const publicDir = join(here, '../../public')
const css = readFileSync(join(here, '../../src/ui/system/tokens.css'), 'utf8')
const mark = readFileSync(join(here, '../../src/ui/system/knot.svg'), 'utf8')
const path = (name) => new RegExp(`class="${name}"[^>]*\\sd="([^"]+)"`).exec(mark)[1]
const viewBox = /viewBox="([^"]+)"/.exec(mark)[1]
const [ex, ey, size] = /data-emblem="([^"]+)"/.exec(mark)[1].split(' ').map(Number)
const token = (name) => {
  const value = new RegExp(`--${name}:\\s*(#[\\da-f]+)`, 'i').exec(css)?.[1]
  if (!value) throw new Error(`Missing color token ${name}`)
  return value
}
const ink = token('color-brand-ink')
const paper = token('bone')
const vermilion = token('action')
const shape = (name, fill) => `<path fill="${fill}" fill-rule="evenodd" d="${path(name)}"/>`
const full = (inkColor, plated) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${plated ? shape('plate', vermilion) : ''}${shape('ink', inkColor)}</svg>\n`
// The icon is a square of the knotted plank: paper behind, so the grain shows through the ink.
const square = (x, y, w) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${w}"><rect x="${x}" y="${y}" width="${w}" height="${w}" fill="${paper}"/>${shape('ink', ink)}</svg>\n`
const emblem = square(ex, ey, size)
// The maskable icon widens the crop so the knot sits inside the platform's safe circle.
const maskable = square(ex - size * 0.2, ey - size * 0.2, size * 1.4)
writeFileSync(join(here, 'knot.svg'), emblem)
writeFileSync(join(here, 'knot-favicon.svg'), emblem)
writeFileSync(join(here, 'knot-maskable.svg'), maskable)
mkdirSync(join(publicDir, 'brand'), { recursive: true })
for (const [name, body] of Object.entries({ 'knotty-mark': full(ink, true), 'knotty-mono': full(ink, false), 'knotty-inverse': full(paper, true), 'knotty-emblem': emblem, 'knotty-maskable': maskable })) {
  writeFileSync(join(publicDir, `brand/${name}.svg`), body)
}
writeFileSync(join(publicDir, 'brand/knotty.tokens.css'), css)
for (const { family, files } of fonts) {
  const source = join(here, '../../node_modules', fontPackage(family))
  for (const file of files) copyFileSync(join(source, 'files', file), join(publicDir, 'brand', file))
  copyFileSync(join(source, 'LICENSE'), join(publicDir, 'brand', `${family}.LICENSE`))
}
console.log('Brand vectors and canonical token source exported')
