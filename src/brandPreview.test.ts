import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const preview = (...args: string[]) => spawnSync(process.execPath, ['scripts/brand/preview.mjs', ...args], { encoding: 'utf8' })

describe('standalone brand preview files', () => {
  it('exports both pages in a new private temporary directory', () => {
    const result = preview()
    const target = /Standalone preview: (.*)\/presentacion.html and /.exec(result.stdout)?.[1]
    try {
      expect(result.status).toBe(0)
      expect(target).toBeTruthy()
      expect(statSync(target!).mode & 0o777).toBe(0o700)
      for (const name of ['presentacion', 'marca']) {
        const file = join(target!, `${name}.html`)
        expect(statSync(file).mode & 0o777).toBe(0o600)
        expect(readFileSync(file, 'utf8')).toContain('lang="es-MX"')
      }
    } finally {
      if (target) rmSync(target, { recursive: true })
    }
  }, 15000)

  it('rejects an existing destination without following a preview-file symlink', () => {
    const target = mkdtempSync(join(tmpdir(), 'knotty-preview-guard-'))
    const protectedFile = join(target, 'keep.txt')
    try {
      writeFileSync(protectedFile, 'keep this file', { mode: 0o600 })
      symlinkSync(protectedFile, join(target, 'presentacion.html'))
      const result = preview(target)
      expect(result.status).not.toBe(0)
      expect(readFileSync(protectedFile, 'utf8')).toBe('keep this file')
    } finally {
      rmSync(target, { recursive: true })
    }
  })
})
