import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// The boundaries of the hexagonal architecture, checked by reading each file's imports.

const SRC = join(import.meta.dirname)

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.tsx?$/.test(name) && !/\.test(-util)?\.tsx?$/.test(name) ? [path] : []
  })
}

function imports(path: string) {
  const code = readFileSync(path, 'utf8')
  return [...code.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
}

const layer = (path: string) => relative(SRC, path).split('/')[0]

/** What each layer may import, besides itself. */
const ALLOWED: Record<string, { layers: string[]; packages: RegExp }> = {
  domain: { layers: [], packages: /^zod$/ },
  application: { layers: ['domain', 'ports'], packages: /^zod$/ },
  ports: { layers: ['domain'], packages: /^zod$/ },
  adapters: { layers: ['domain', 'ports'], packages: /./ },
  ui: { layers: ['domain', 'application', 'ports'], packages: /./ },
}

describe('architecture', () => {
  for (const [name, rule] of Object.entries(ALLOWED)) {
    it(`${name}/ only imports what is allowed`, () => {
      const violations: string[] = []
      for (const file of files(join(SRC, name))) {
        for (const target of imports(file)) {
          if (target.startsWith('.')) {
            const other = layer(join(file, '..', target))
            if (other !== name && !rule.layers.includes(other)) violations.push(`${relative(SRC, file)} → ${target}`)
          } else if (!rule.packages.test(target)) {
            violations.push(`${relative(SRC, file)} → ${target}`)
          }
        }
      }
      expect(violations).toEqual([])
    })
  }

  it('domain/ does not touch the browser', () => {
    const uses = files(join(SRC, 'domain')).filter((f) => /\b(window|document|localStorage|fetch)\b/.test(readFileSync(f, 'utf8')))
    expect(uses.map((f) => relative(SRC, f))).toEqual([])
  })
})
