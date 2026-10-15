import { copyFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { kitArchive, kitDir, kitFiles } from './kit-files.mjs'

mkdirSync(kitDir, { recursive: true })
for (const [name, source] of Object.entries(kitFiles)) {
  const target = `${kitDir}/${name}`
  if (resolve(source) !== resolve(target)) copyFileSync(source, target)
}

execFileSync(process.env.BRAND_PYTHON || 'python3', ['-c', `
import pathlib, sys, zipfile
folder = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2], 'w') as archive:
    for name in sorted(sys.argv[3:]):
        entry = zipfile.ZipInfo('knotty-brand-kit/' + name)
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o644 << 16
        archive.writestr(entry, (folder / name).read_bytes())
`, kitDir, kitArchive, ...Object.keys(kitFiles)], { stdio: 'inherit' })

console.log(`Brand kit assembled: ${kitDir}/ and ${kitArchive}`)
