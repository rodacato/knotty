import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve, relative } from 'node:path'
import { execFileSync } from 'node:child_process'
import './verify-kit.mjs'

const distFlag = process.argv.indexOf('--dist')
assert(distFlag < 0 || process.argv[distFlag + 1], '--dist requires a build directory')
const dist = resolve(distFlag < 0 ? 'dist' : process.argv[distFlag + 1])
const pages = ['index.html', 'catalog/index.html', 'presentacion/index.html', 'marca/index.html']
const assets = new Set(['manifest.webmanifest', 'favicon.svg', 'sw.js', 'icon-192.png', 'icon-512.png', 'share.png', 'catalog/catalog.json'])
const read = (file) => readFile(resolve(dist, file))

for (const page of pages) {
  const html = (await read(page)).toString()
  assert.match(html, /lang="es-MX"/, `${page}: missing product language`)
  assert.match(html, /Content-Security-Policy/, `${page}: missing CSP`)
  assert.match(html, /theme-color" content="#1D1A17"/, `${page}: stale theme`)
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^https?:/.test(ref)) continue
    const target = resolve(dist, dirname(page), ref)
    const file = relative(dist, ref.endsWith('/') ? resolve(target, 'index.html') : target)
    assert(!file.startsWith('..'), `${page}: reference escapes hosting base`)
    await read(file)
    assets.add(file)
  }
  if (page === 'presentacion/index.html') {
    assert(html.includes('href="../"'), 'Legacy presentation must offer a root link')
    assert(!html.includes('id="root"'), 'Legacy presentation must redirect rather than render a duplicate landing')
  }
  if (page !== 'index.html' && page !== 'catalog/index.html') {
    assert(!html.includes('rel="manifest"'), `${page}: creates another install destination`)
  }
}

assert.deepEqual(await read('catalog/catalog.json'), await readFile('public/catalog/catalog.json'), 'Catalog page must coexist with its material data')

const manifest = JSON.parse(await read('manifest.webmanifest'))
for (const field of ['id', 'scope']) assert.equal(manifest[field], './', `PWA ${field} changed`)
assert.equal(manifest.start_url, './catalog/#studio', 'PWA must reopen the saved studio, not the landing')
const entryScript = (html) => /<script[^>]+src="([^"]+)"/.exec(html.toString())?.[1]
assert.notEqual(entryScript(await read('index.html')), entryScript(await read('catalog/index.html')), 'Landing and catalog must have separate boot entries')
for (const icon of manifest.icons) { await read(icon.src); assets.add(icon.src) }

const mark = await readFile('src/ui/system/knot.svg', 'utf8')
const paths = [...mark.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1])
assert.equal(paths.length, 2, 'The approved assembly has two strokes')
const kit = await readdir(resolve(dist, 'brand'))
assert(kit.includes('knotty-brand-kit.zip'), 'Missing downloadable kit')
for (const name of kit) {
  const file = `brand/${name}`
  assets.add(file)
  assert.deepEqual(await read(file), await readFile(`public/${file}`), `${file}: stale build export`)
  if (name.endsWith('.svg')) {
    const svg = (await read(file)).toString()
    for (const path of paths) assert(svg.includes(`d="${path}"`), `${file}: wrong mark`)
  }
}
assert.deepEqual(await read('brand/knotty.tokens.css'), await readFile('src/ui/system/tokens.css'), 'Download tokens drift from canonical source')
for (const path of paths) assert((await read('favicon.svg')).toString().includes(`d="${path}"`), 'Favicon has stale mark')
execFileSync('python3', ['-c', `
import pathlib, zipfile
import sys
folder = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(folder / 'knotty-brand-kit.zip') as archive:
    files = [p for p in folder.iterdir() if p.suffix != '.zip']
    assert set(archive.namelist()) == {'knotty-brand-kit/' + p.name for p in files}
    for p in files:
        assert archive.read('knotty-brand-kit/' + p.name) == p.read_bytes(), p.name
`, resolve(dist, 'brand')], { stdio: 'pipe' })

if (process.argv.includes('--live')) {
  const base = 'https://rodacato.github.io/knotty/'
  for (const file of [...pages, ...assets]) {
    const url = new URL(file === 'index.html' ? './' : file, base)
    const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000) })
    assert.equal(response.status, 200, `${url}: unavailable`)
    assert(Buffer.from(await response.arrayBuffer()).equals(await read(file)), `${url}: does not match this build`)
  }
  console.log('Published Pages verified: landing, catalog, presentation redirect, guide, PWA and downloadable assets match this build')
} else {
  console.log('Brand build verified: four entries, PWA identity, canonical vectors, fonts and downloadable kit')
}
