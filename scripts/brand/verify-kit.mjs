import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { basename } from 'node:path'
import { kitArchive, kitDir, kitFiles } from './kit-files.mjs'

const names = Object.keys(kitFiles).sort()
assert.deepEqual(readdirSync(kitDir).filter((name) => name !== basename(kitArchive)).sort(), names, 'Served kit has missing or unlisted files')
for (const [name, source] of Object.entries(kitFiles)) {
  const exported = readFileSync(`${kitDir}/${name}`)
  assert.deepEqual(exported, readFileSync(source), `${name}: served kit differs from ${source}`)
  if (name.endsWith('.md')) {
    for (const [, link] of exported.toString().matchAll(/\]\(([^)]+)\)/g)) {
      const file = link.split('#')[0]
      if (!/^https?:\/\//.test(link) && file) assert(names.includes(file), `${name}: broken portable link ${link}`)
    }
  }
}

execFileSync(process.env.BRAND_PYTHON || 'python3', ['-c', `
import pathlib, sys, zipfile
folder = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2]) as archive:
    assert archive.testzip() is None, 'Corrupt kit archive'
    names = sorted(sys.argv[3:])
    assert archive.namelist() == ['knotty-brand-kit/' + n for n in names], 'Archive inventory differs'
    for name in names:
        assert archive.read('knotty-brand-kit/' + name) == (folder / name).read_bytes(), name
`, kitDir, kitArchive, ...Object.keys(kitFiles)], { stdio: 'inherit' })

console.log(`Brand kit verified: ${names.length} files, portable links and matching archive`)
